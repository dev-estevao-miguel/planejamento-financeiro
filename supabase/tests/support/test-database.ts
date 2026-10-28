import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";

const SUPABASE_DIR = path.resolve(import.meta.dirname, "../..");
const MIGRATIONS_DIR = path.join(SUPABASE_DIR, "migrations");

/**
 * Boots an in-memory Postgres (PGlite), applies a Supabase shim and then every
 * migration in supabase/migrations, in order — the same files `supabase db push`
 * applies to the real project.
 */
export async function createTestDatabase(): Promise<PGlite> {
  const db = await PGlite.create({ extensions: { pg_trgm, pgcrypto, unaccent } });
  await db.exec(readFileSync(path.join(import.meta.dirname, "supabase-shim.sql"), "utf8"));

  const migrations = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of migrations) {
    try {
      await db.exec(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
    }
  }
  return db;
}

type Role = "anon" | "authenticated";

/**
 * Runs `fn` inside a transaction as an API role, with the JWT claims Supabase
 * would set for that request. The transaction always rolls back afterwards, so
 * tests cannot leak state into each other.
 */
export async function runAs<T>(
  db: PGlite,
  userId: string | null,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  const role: Role = userId ? "authenticated" : "anon";
  const claims = JSON.stringify(userId ? { sub: userId, role } : { role });
  let result: T | undefined;
  const rollback = new Error("rollback");

  try {
    await db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claims', $1, true)", [claims]);
      await tx.exec(`set local role ${role}`);
      result = await fn(tx);
      // Fire deferred constraint triggers before discarding the work.
      await tx.exec("set constraints all immediate");
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  return result as T;
}

/** Runs `fn` as an API role and returns the error message it raised. */
export async function errorAs(
  db: PGlite,
  userId: string | null,
  fn: (tx: Transaction) => Promise<unknown>,
): Promise<string> {
  try {
    await runAs(db, userId, fn);
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error("Expected the operation to fail, but it succeeded");
}
