import type { PGlite } from "@electric-sql/pglite";

/** Fictitious people only — real household data never goes into tests. */
export const USERS = {
  aliceOwner: "00000000-0000-4000-a000-000000000001",
  bobAdmin: "00000000-0000-4000-a000-000000000002",
  carolViewer: "00000000-0000-4000-a000-000000000003",
  daveMember: "00000000-0000-4000-a000-000000000004",
  erinOtherOwner: "00000000-0000-4000-a000-000000000005",
} as const;

export const HOUSEHOLDS = {
  silva: "10000000-0000-4000-a000-000000000001",
  costa: "10000000-0000-4000-a000-000000000002",
} as const;

export interface SeededData {
  members: Record<keyof typeof USERS, string>;
  categories: {
    silvaFood: string;
    silvaSalary: string;
    costaFood: string;
  };
  transactions: {
    silvaGrocery: string;
    costaGrocery: string;
  };
}

async function createUser(db: PGlite, id: string, username: string, displayName: string) {
  await db.query(
    "insert into auth.users (id, email, raw_app_meta_data) values ($1, $2, $3)",
    [id, `${id}@accounts.invalid`, JSON.stringify({ username, display_name: displayName })],
  );
}

async function addMember(
  db: PGlite,
  householdId: string,
  profileId: string,
  role: "owner" | "admin" | "member" | "viewer",
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    "insert into public.household_members (household_id, profile_id, role) values ($1, $2, $3) returning id",
    [householdId, profileId, role],
  );
  return rows[0].id;
}

async function categoryId(db: PGlite, householdId: string, name: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    "select id from public.categories where household_id = $1 and name = $2 and parent_id is null",
    [householdId, name],
  );
  return rows[0].id;
}

async function insertTransaction(
  db: PGlite,
  householdId: string,
  category: string,
  createdBy: string,
  description: string,
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `insert into public.transactions
       (household_id, kind, description, amount, category_id, occurred_on, created_by)
     values ($1, 'expense', $2, 85.90, $3, '2026-10-23', $4)
     returning id`,
    [householdId, description, category, createdBy],
  );
  return rows[0].id;
}

/**
 * Two independent households:
 *   Família Silva: alice (owner), bob (admin), carol (viewer), dave (member)
 *   Família Costa: erin (owner)
 */
export async function seedTwoHouseholds(db: PGlite): Promise<SeededData> {
  await createUser(db, USERS.aliceOwner, "alice", "Alice");
  await createUser(db, USERS.bobAdmin, "bob", "Bob");
  await createUser(db, USERS.carolViewer, "carol", "Carol");
  await createUser(db, USERS.daveMember, "dave", "Dave");
  await createUser(db, USERS.erinOtherOwner, "erin", "Erin");

  await db.query("update public.profile_contacts set phone_e164 = '+5500000000001' where profile_id = $1", [
    USERS.bobAdmin,
  ]);

  await db.query("insert into public.households (id, name) values ($1, 'Família Silva'), ($2, 'Família Costa')", [
    HOUSEHOLDS.silva,
    HOUSEHOLDS.costa,
  ]);

  const members = {
    aliceOwner: await addMember(db, HOUSEHOLDS.silva, USERS.aliceOwner, "owner"),
    bobAdmin: await addMember(db, HOUSEHOLDS.silva, USERS.bobAdmin, "admin"),
    carolViewer: await addMember(db, HOUSEHOLDS.silva, USERS.carolViewer, "viewer"),
    daveMember: await addMember(db, HOUSEHOLDS.silva, USERS.daveMember, "member"),
    erinOtherOwner: await addMember(db, HOUSEHOLDS.costa, USERS.erinOtherOwner, "owner"),
  };

  const categories = {
    silvaFood: await categoryId(db, HOUSEHOLDS.silva, "Alimentação"),
    silvaSalary: await categoryId(db, HOUSEHOLDS.silva, "Salário"),
    costaFood: await categoryId(db, HOUSEHOLDS.costa, "Alimentação"),
  };

  const transactions = {
    silvaGrocery: await insertTransaction(db, HOUSEHOLDS.silva, categories.silvaFood, USERS.aliceOwner, "Supermercado"),
    costaGrocery: await insertTransaction(db, HOUSEHOLDS.costa, categories.costaFood, USERS.erinOtherOwner, "Mercado Extra"),
  };

  return { members, categories, transactions };
}
