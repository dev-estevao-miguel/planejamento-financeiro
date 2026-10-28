import type { PGlite, Transaction } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { USERS, seedTwoHouseholds } from "./support/fixtures";
import { createTestDatabase, errorAs } from "./support/test-database";

let db: PGlite;

beforeAll(async () => {
  db = await createTestDatabase();
  await seedTwoHouseholds(db);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

const CODE = "ABCD2345";

/** Runs as service_role (our server code) inside a transaction that rolls back. */
async function asServer<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
  let result: T | undefined;
  const rollback = new Error("rollback");
  try {
    await db.transaction(async (tx) => {
      await tx.exec("set local role service_role");
      result = await fn(tx);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  return result as T;
}

async function check(tx: Transaction, username: string, code: string): Promise<string | null> {
  const { rows } = await tx.query<{ id: string | null }>("select public.auth_check_activation($1, $2) as id", [
    username,
    code,
  ]);
  return rows[0].id;
}

async function issue(tx: Transaction, profileId: string, validFor = "72 hours") {
  await tx.query("select public.auth_issue_activation($1, $2, $3::interval)", [profileId, CODE, validFor]);
}

describe("profile creation from Supabase Auth", () => {
  it("follows the admin createUser order: insert first, app_metadata in a later update", async () => {
    const id = "00000000-0000-4000-a000-0000000000aa";
    const result = await asServer(async (tx) => {
      await tx.exec("reset role");
      // 1. GoTrue inserts with provider-only app_metadata (no username yet).
      await tx.query(
        `insert into auth.users (id, email, raw_app_meta_data)
         values ($1, 'x@accounts.invalid', '{"provider":"email","providers":["email"]}')`,
        [id],
      );
      const before = await tx.query("select 1 from public.profiles where id = $1", [id]);
      // 2. ...then applies the caller's app_metadata in the same transaction.
      await tx.query(
        `update auth.users
            set raw_app_meta_data = raw_app_meta_data || '{"username":"Novo.Membro","display_name":"Novo Membro"}'
          where id = $1`,
        [id],
      );
      const { rows } = await tx.query<{ username: string; display_name: string; status: string }>(
        `select p.username, p.display_name, p.status
           from public.profiles p
           join public.profile_contacts c on c.profile_id = p.id
           join public.user_preferences u on u.profile_id = p.id
          where p.id = $1`,
        [id],
      );
      // 3. Later metadata updates must not try to recreate the profile.
      await tx.query(`update auth.users set raw_app_meta_data = raw_app_meta_data || '{"x":1}' where id = $1`, [id]);
      return { before: before.rows.length, profile: rows[0] };
    });
    expect(result).toEqual({
      before: 0,
      profile: { username: "novo.membro", display_name: "Novo Membro", status: "pending_activation" },
    });
  });

  it("ignores user_metadata, which users can edit themselves", async () => {
    const id = "00000000-0000-4000-a000-0000000000ab";
    const created = await asServer(async (tx) => {
      await tx.exec("reset role");
      await tx.query(
        `insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
         values ($1, 'y@accounts.invalid', '{"provider":"email"}', '{"username":"intruso"}')`,
        [id],
      );
      const { rows } = await tx.query("select 1 from public.profiles where id = $1", [id]);
      return rows.length;
    });
    expect(created).toBe(0);
  });
});

describe("activation codes", () => {
  it("stores only a hash of the code", async () => {
    const stored = await asServer(async (tx) => {
      await issue(tx, USERS.daveMember);
      await tx.exec("reset role");
      const { rows } = await tx.query<{ code_hash: string }>(
        "select code_hash from private.account_activations where profile_id = $1",
        [USERS.daveMember],
      );
      return rows[0].code_hash;
    });
    expect(stored).not.toContain(CODE);
    expect(stored).toMatch(/^\$2[aby]\$/);
  });

  it("accepts the right code for the right username (case-insensitive username)", async () => {
    const result = await asServer(async (tx) => {
      await issue(tx, USERS.daveMember);
      return { wrongUser: await check(tx, "alice", CODE), right: await check(tx, " DAVE ", CODE) };
    });
    expect(result).toEqual({ wrongUser: null, right: USERS.daveMember });
  });

  it("burns the code after 5 wrong attempts", async () => {
    const result = await asServer(async (tx) => {
      await issue(tx, USERS.daveMember);
      for (let i = 0; i < 5; i++) await check(tx, "dave", "WRONG999");
      return check(tx, "dave", CODE);
    });
    expect(result).toBeNull();
  });

  it("rejects expired codes", async () => {
    const result = await asServer(async (tx) => {
      await issue(tx, USERS.daveMember, "-1 second");
      return check(tx, "dave", CODE);
    });
    expect(result).toBeNull();
  });

  it("activates the account and makes the code single-use", async () => {
    const result = await asServer(async (tx) => {
      await issue(tx, USERS.daveMember);
      await tx.query("select public.auth_complete_activation($1)", [USERS.daveMember]);
      const { rows } = await tx.query<{ status: string; activated: boolean }>(
        "select status, activated_at is not null as activated from public.profiles where id = $1",
        [USERS.daveMember],
      );
      return { profile: rows[0], reuse: await check(tx, "dave", CODE) };
    });
    expect(result).toEqual({ profile: { status: "active", activated: true }, reuse: null });
  });

  it("never activates a disabled account", async () => {
    const result = await asServer(async (tx) => {
      await tx.query("update public.profiles set status = 'disabled' where id = $1", [USERS.daveMember]);
      await issue(tx, USERS.daveMember);
      return check(tx, "dave", CODE);
    });
    expect(result).toBeNull();
  });
});

describe("login throttling", () => {
  async function lockedUntil(tx: Transaction, keys: string[]): Promise<Date | null> {
    const { rows } = await tx.query<{ until: Date | null }>("select public.auth_throttle_locked_until($1) as until", [
      keys,
    ]);
    return rows[0].until;
  }

  it("locks a key after 5 failures and unlocks when cleared", async () => {
    const result = await asServer(async (tx) => {
      const keys = ["user-key", "ip-key"];
      for (let i = 0; i < 4; i++) await tx.query("select public.auth_throttle_register_failure($1)", [keys]);
      const afterFour = await lockedUntil(tx, keys);
      await tx.query("select public.auth_throttle_register_failure($1)", [keys]);
      const afterFive = await lockedUntil(tx, ["ip-key"]);
      await tx.query("select public.auth_throttle_clear($1)", [["ip-key"]]);
      const ipAfterClear = await lockedUntil(tx, ["ip-key"]);
      const userAfterClear = await lockedUntil(tx, ["user-key"]);
      return { afterFour, afterFive, ipAfterClear, userAfterClear };
    });
    expect(result.afterFour).toBeNull();
    expect(result.afterFive).toBeInstanceOf(Date);
    expect(result.ipAfterClear).toBeNull();
    expect(result.userAfterClear).toBeInstanceOf(Date);
  });
});

describe("auth functions are server-only", () => {
  it.each([
    ["anon", null],
    ["authenticated", USERS.aliceOwner],
  ])("%s cannot call them", async (_role, userId) => {
    for (const sql of [
      "select public.auth_check_activation('alice', 'ABCD2345')",
      "select public.auth_issue_activation(gen_random_uuid(), 'ABCD2345')",
      "select public.auth_complete_activation(gen_random_uuid())",
      "select public.auth_throttle_clear(array['x'])",
    ]) {
      const message = await errorAs(db, userId, (tx) => tx.query(sql));
      expect(message).toMatch(/permission denied/);
    }
  });
});
