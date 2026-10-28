import type { PGlite, Transaction } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HOUSEHOLDS, USERS, seedTwoHouseholds, type SeededData } from "./support/fixtures";
import { createTestDatabase, errorAs, runAs } from "./support/test-database";

let db: PGlite;
let data: SeededData;

beforeAll(async () => {
  db = await createTestDatabase();
  data = await seedTwoHouseholds(db);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

async function count(tx: Transaction, sql: string, params: unknown[] = []): Promise<number> {
  const { rows } = await tx.query<{ n: number }>(`select count(*)::int as n from (${sql}) as q`, params);
  return rows[0].n;
}

function insertExpense(tx: Transaction, householdId: string, categoryId: string, extra = "") {
  return tx.query<{ id: string }>(
    `insert into public.transactions (household_id, kind, description, amount, category_id, occurred_on${extra ? `, ${extra}` : ""})
     values ($1, 'expense', 'Padaria', 12.50, $2, '2026-10-20'${extra ? ", $3" : ""})
     returning id`,
    extra ? [householdId, categoryId, USERS.bobAdmin] : [householdId, categoryId],
  );
}

describe("migrations", () => {
  it("creates the default categories for every new household", async () => {
    const { rows } = await db.query<{ household_id: string; n: number }>(
      "select household_id, count(*)::int as n from public.categories group by household_id order by household_id",
    );
    expect(rows).toEqual([
      { household_id: HOUSEHOLDS.silva, n: 25 },
      { household_id: HOUSEHOLDS.costa, n: 25 },
    ]);
  });

  it("creates a profile, contacts and preferences for each auth user", async () => {
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from public.profiles p
       join public.profile_contacts c on c.profile_id = p.id
       join public.user_preferences u on u.profile_id = p.id`,
    );
    expect(rows[0].n).toBe(5);
  });
});

describe("function privileges", () => {
  async function executableBy(role: string, schema: string): Promise<string[]> {
    const { rows } = await db.query<{ proname: string }>(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = $1 and has_function_privilege($2, p.oid, 'execute')
       order by p.proname`,
      [schema, role],
    );
    return rows.map((r) => r.proname);
  }

  it("gives anon no internal function", async () => {
    expect(await executableBy("anon", "private")).toEqual([]);
  });

  it("gives signed-in users only the helpers RLS and constraints evaluate", async () => {
    expect(await executableBy("authenticated", "private")).toEqual([
      "has_permission",
      "households_with_permission",
      "month_start",
      "my_household_ids",
      "normalize_search",
      "visible_profile_ids",
    ]);
  });

  it("exposes no RPC to anon", async () => {
    expect(await executableBy("anon", "public")).toEqual([]);
  });
});

describe("anonymous access", () => {
  it.each(["households", "transactions", "profiles", "categories", "audit_logs"])(
    "cannot read %s",
    async (table) => {
      const message = await errorAs(db, null, (tx) => tx.query(`select * from public.${table}`));
      expect(message).toMatch(/permission denied/);
    },
  );
});

describe("household isolation", () => {
  it("members only see their own household", async () => {
    const seen = await runAs(db, USERS.aliceOwner, (tx) =>
      tx.query<{ id: string }>("select id from public.households"),
    );
    expect(seen.rows.map((r) => r.id)).toEqual([HOUSEHOLDS.silva]);
  });

  it("cannot read another household's transaction even knowing its id", async () => {
    const n = await runAs(db, USERS.aliceOwner, (tx) =>
      count(tx, "select id from public.transactions where id = $1", [data.transactions.costaGrocery]),
    );
    expect(n).toBe(0);
  });

  it("cannot insert into another household", async () => {
    const message = await errorAs(db, USERS.aliceOwner, (tx) =>
      tx.query(
        `insert into public.transactions (household_id, kind, description, amount, occurred_on)
         values ($1, 'expense', 'Intrusa', 10, '2026-10-20')`,
        [HOUSEHOLDS.costa],
      ),
    );
    expect(message).toMatch(/row-level security/);
  });

  it("cannot reference another household's category", async () => {
    const message = await errorAs(db, USERS.aliceOwner, (tx) =>
      insertExpense(tx, HOUSEHOLDS.silva, data.categories.costaFood),
    );
    expect(message).toMatch(/category_not_found/);
  });

  it("rejects a foreign category even when the check runs with elevated privileges", async () => {
    // service_role bypasses RLS; the composite FK is the last line of defense.
    await expect(
      db.query(
        `insert into public.transactions (household_id, kind, description, amount, category_id, occurred_on)
         values ($1, 'expense', 'Cruzada', 10, $2, '2026-10-20')`,
        [HOUSEHOLDS.silva, data.categories.costaFood],
      ),
    ).rejects.toThrow(/transactions_category_fk/);
  });

  it("cannot move a record to another household", async () => {
    const message = await errorAs(db, USERS.aliceOwner, (tx) =>
      tx.query("update public.transactions set household_id = $1 where id = $2", [
        HOUSEHOLDS.costa,
        data.transactions.silvaGrocery,
      ]),
    );
    expect(message).toMatch(/permission denied/);
  });

  it("cannot update another household's rows (silently matches nothing)", async () => {
    const result = await runAs(db, USERS.aliceOwner, (tx) =>
      tx.query("update public.transactions set amount = 1 where id = $1", [data.transactions.costaGrocery]),
    );
    expect(result.affectedRows).toBe(0);
  });

  it("only sees profiles of people who share a household", async () => {
    const { rows } = await runAs(db, USERS.aliceOwner, (tx) =>
      tx.query<{ username: string }>("select username from public.profiles order by username"),
    );
    expect(rows.map((r) => r.username)).toEqual(["alice", "bob", "carol", "dave"]);
  });

  it("never exposes another member's phone number", async () => {
    const { rows } = await runAs(db, USERS.aliceOwner, (tx) =>
      tx.query<{ profile_id: string }>("select profile_id from public.profile_contacts"),
    );
    expect(rows.map((r) => r.profile_id)).toEqual([USERS.aliceOwner]);
  });

  it("cannot point the default household at a foreign household", async () => {
    const message = await errorAs(db, USERS.aliceOwner, (tx) =>
      tx.query("update public.user_preferences set default_household_id = $1", [HOUSEHOLDS.costa]),
    );
    expect(message).toMatch(/row-level security/);
  });
});

describe("roles and permissions", () => {
  it("lets a member add an expense, attributed to themselves", async () => {
    const createdBy = await runAs(db, USERS.daveMember, async (tx) => {
      const { rows } = await insertExpense(tx, HOUSEHOLDS.silva, data.categories.silvaFood);
      const created = await tx.query<{ created_by: string }>(
        "select created_by from public.transactions where id = $1",
        [rows[0].id],
      );
      return created.rows[0].created_by;
    });
    expect(createdBy).toBe(USERS.daveMember);
  });

  it("does not let anyone forge created_by", async () => {
    const message = await errorAs(db, USERS.daveMember, (tx) =>
      insertExpense(tx, HOUSEHOLDS.silva, data.categories.silvaFood, "created_by"),
    );
    expect(message).toMatch(/permission denied/);
  });

  it("does not let a viewer write", async () => {
    const message = await errorAs(db, USERS.carolViewer, (tx) =>
      insertExpense(tx, HOUSEHOLDS.silva, data.categories.silvaFood),
    );
    expect(message).toMatch(/row-level security/);
  });

  it("does not let a member manage planning", async () => {
    const message = await errorAs(db, USERS.daveMember, (tx) =>
      tx.query("insert into public.budgets (household_id, month) values ($1, '2026-11-01')", [HOUSEHOLDS.silva]),
    );
    expect(message).toMatch(/row-level security/);
  });

  it("respects a per-member override that revokes a role default", async () => {
    await db.query(
      "insert into public.member_permissions (household_id, member_id, permission, granted) values ($1, $2, 'finance.create', false)",
      [HOUSEHOLDS.silva, data.members.daveMember],
    );
    try {
      const message = await errorAs(db, USERS.daveMember, (tx) =>
        insertExpense(tx, HOUSEHOLDS.silva, data.categories.silvaFood),
      );
      expect(message).toMatch(/row-level security/);
    } finally {
      await db.query("delete from public.member_permissions where member_id = $1", [data.members.daveMember]);
    }
  });

  it("does not let clients change roles directly", async () => {
    const message = await errorAs(db, USERS.aliceOwner, (tx) =>
      tx.query("update public.household_members set role = 'owner' where id = $1", [data.members.bobAdmin]),
    );
    expect(message).toMatch(/permission denied/);
  });

  it("never leaves a household without an owner", async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.query("update public.household_members set role = 'admin' where id = $1", [
          data.members.aliceOwner,
        ]);
        await tx.exec("set constraints all immediate");
      }),
    ).rejects.toThrow(/household_owner_required/);
  });
});

describe("deletion safety", () => {
  it("blocks hard deletes of transactions", async () => {
    const message = await errorAs(db, USERS.aliceOwner, (tx) =>
      tx.query("delete from public.transactions where id = $1", [data.transactions.silvaGrocery]),
    );
    expect(message).toMatch(/permission denied/);
  });

  it("blocks writing deleted_at directly", async () => {
    const message = await errorAs(db, USERS.aliceOwner, (tx) =>
      tx.query("update public.transactions set deleted_at = now() where id = $1", [data.transactions.silvaGrocery]),
    );
    expect(message).toMatch(/permission denied/);
  });

  it("soft-deletes through the RPC and keeps the audit trail", async () => {
    const actions = await runAs(db, USERS.bobAdmin, async (tx) => {
      await tx.query("select public.soft_delete_transaction($1)", [data.transactions.silvaGrocery]);
      const { rows } = await tx.query<{ action: string; actor_id: string }>(
        "select action, actor_id from public.audit_logs where entity_id = $1 order by id",
        [data.transactions.silvaGrocery],
      );
      return rows;
    });
    expect(actions.at(-1)).toEqual({ action: "transaction.deleted", actor_id: USERS.bobAdmin });
  });

  it("does not let a member without finance.delete soft-delete", async () => {
    const message = await errorAs(db, USERS.daveMember, (tx) =>
      tx.query("select public.soft_delete_transaction($1)", [data.transactions.silvaGrocery]),
    );
    expect(message).toMatch(/not_found_or_forbidden/);
  });

  it("answers the same for foreign ids, so ids cannot be probed", async () => {
    const message = await errorAs(db, USERS.aliceOwner, (tx) =>
      tx.query("select public.soft_delete_transaction($1)", [data.transactions.costaGrocery]),
    );
    expect(message).toMatch(/not_found_or_forbidden/);
  });
});

describe("audit trail", () => {
  it("records who changed what, with before/after values", async () => {
    const changes = await runAs(db, USERS.bobAdmin, async (tx) => {
      await tx.query("update public.transactions set amount = 99.90 where id = $1", [data.transactions.silvaGrocery]);
      const { rows } = await tx.query<{ action: string; changes: Record<string, unknown> }>(
        "select action, changes from public.audit_logs where entity_id = $1 order by id desc limit 1",
        [data.transactions.silvaGrocery],
      );
      return rows[0];
    });
    expect(changes.action).toBe("transaction.updated");
    expect(changes.changes).toEqual({ amount: { from: 85.9, to: 99.9 } });
  });

  it("is append-only for clients", async () => {
    const message = await errorAs(db, USERS.aliceOwner, (tx) =>
      tx.query(
        "insert into public.audit_logs (household_id, action, entity_type) values ($1, 'transaction.created', 'transaction')",
        [HOUSEHOLDS.silva],
      ),
    );
    expect(message).toMatch(/permission denied/);
  });

  it("is isolated per household", async () => {
    const n = await runAs(db, USERS.erinOtherOwner, (tx) =>
      count(tx, "select id from public.audit_logs where household_id = $1", [HOUSEHOLDS.silva]),
    );
    expect(n).toBe(0);
  });
});

describe("privacy between members", () => {
  it("keeps private transactions visible only to their creator", async () => {
    const visibility = await runAs(db, USERS.bobAdmin, async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        `insert into public.transactions (household_id, kind, description, amount, category_id, occurred_on, visibility)
         values ($1, 'expense', 'Presente surpresa', 150, $2, '2026-10-21', 'private') returning id`,
        [HOUSEHOLDS.silva, data.categories.silvaFood],
      );
      const id = rows[0].id;
      const bobSees = await count(tx, "select 1 from public.transactions where id = $1", [id]);
      // Same transaction, now as Alice (the owner).
      await tx.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: USERS.aliceOwner, role: "authenticated" }),
      ]);
      const aliceSees = await count(tx, "select 1 from public.transactions where id = $1", [id]);
      return { bobSees, aliceSees };
    });
    expect(visibility).toEqual({ bobSees: 1, aliceSees: 0 });
  });
});

describe("data integrity", () => {
  it("derives the monthly competence from the date", async () => {
    const competence = await runAs(db, USERS.aliceOwner, async (tx) => {
      const { rows } = await insertExpense(tx, HOUSEHOLDS.silva, data.categories.silvaFood);
      const result = await tx.query<{ competence_month: Date }>(
        "select competence_month::text as competence_month from public.transactions where id = $1",
        [rows[0].id],
      );
      return result.rows[0].competence_month;
    });
    expect(competence).toBe("2026-10-01");
  });

  it("rejects an expense filed under an income category", async () => {
    const message = await errorAs(db, USERS.aliceOwner, (tx) =>
      insertExpense(tx, HOUSEHOLDS.silva, data.categories.silvaSalary),
    );
    expect(message).toMatch(/category_kind_mismatch/);
  });

  it("rejects non-positive amounts", async () => {
    const message = await errorAs(db, USERS.aliceOwner, (tx) =>
      tx.query(
        `insert into public.transactions (household_id, kind, description, amount, occurred_on)
         values ($1, 'expense', 'Erro', -10, '2026-10-20')`,
        [HOUSEHOLDS.silva],
      ),
    );
    expect(message).toMatch(/transactions_amount_positive/);
  });

  it("keeps money exact (no floating point drift)", async () => {
    const { rows } = await db.query<{ total: string }>(
      "select (0.1::numeric(14,2) + 0.2::numeric(14,2))::text as total",
    );
    expect(rows[0].total).toBe("0.30");
  });
});

describe("search", () => {
  it("matches accent- and case-insensitively", async () => {
    const found = await runAs(db, USERS.aliceOwner, async (tx) => {
      for (const description of ["Mercado Extra", "Compra MERCADO", "Farmácia"]) {
        await tx.query(
          `insert into public.transactions (household_id, kind, description, amount, occurred_on)
           values ($1, 'expense', $2, 10, '2026-10-22')`,
          [HOUSEHOLDS.silva, description],
        );
      }
      const mercado = await tx.query<{ description: string }>(
        "select description from public.transactions where search_text like '%' || private.normalize_search($1) || '%' order by description",
        ["mercado"],
      );
      const farmacia = await count(
        tx,
        "select 1 from public.transactions where search_text like '%' || private.normalize_search($1) || '%'",
        ["FARMACIA"],
      );
      return { mercado: mercado.rows.map((r) => r.description), farmacia };
    });
    expect(found.mercado).toEqual(["Compra MERCADO", "Mercado Extra", "Supermercado"]);
    expect(found.farmacia).toBe(1);
  });
});

describe("notifications", () => {
  it("are only visible to their recipient", async () => {
    await db.query(
      "insert into public.notifications (household_id, recipient_id, actor_id, type) values ($1, $2, $3, 'transaction_created')",
      [HOUSEHOLDS.silva, USERS.bobAdmin, USERS.aliceOwner],
    );
    const bob = await runAs(db, USERS.bobAdmin, (tx) => count(tx, "select 1 from public.notifications"));
    const alice = await runAs(db, USERS.aliceOwner, (tx) => count(tx, "select 1 from public.notifications"));
    expect({ bob, alice }).toEqual({ bob: 1, alice: 0 });
  });
});
