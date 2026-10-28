import type { PGlite, Transaction } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HOUSEHOLDS, USERS, seedTwoHouseholds, type SeededData } from "./support/fixtures";
import { createTestDatabase, errorAs, runAs } from "./support/test-database";

let db: PGlite;
let data: SeededData;
/** First day of the month `offset` months from the current one, in the households' time zone. */
const months = new Map<number, string>();

beforeAll(async () => {
  db = await createTestDatabase();
  data = await seedTwoHouseholds(db);
  for (let offset = -3; offset <= 1; offset++) {
    const { rows } = await db.query<{ d: string }>(
      "select (date_trunc('month', now() at time zone 'America/Recife') + make_interval(months => $1))::date::text as d",
      [offset],
    );
    months.set(offset, rows[0].d);
  }
}, 60_000);

afterAll(async () => {
  await db?.close();
});

async function occurrences(
  frequency: "weekly" | "monthly" | "yearly",
  interval: number,
  dayOfMonth: number | null,
  startsOn: string,
  from: string,
  to: string,
): Promise<string[]> {
  const { rows } = await db.query<{ d: string }>(
    "select d::text from private.rule_occurrences($1, $2, $3, $4, $5, $6) as d",
    [frequency, interval, dayOfMonth, startsOn, from, to],
  );
  return rows.map((row) => row.d);
}

function monthFromNow(offset: number): string {
  const month = months.get(offset);
  if (!month) throw new Error(`month ${offset} not prepared`);
  return month;
}

async function insertRule(tx: Transaction, extra: { startsOn: string; endsOn?: string; paused?: boolean }) {
  const { rows } = await tx.query<{ id: string }>(
    `insert into public.recurring_rules (household_id, kind, description, amount, category_id, day_of_month, starts_on, ends_on)
     values ($1, 'income', 'Salário', 3000, $2, 5, $3, $4)
     returning id`,
    [HOUSEHOLDS.silva, data.categories.silvaSalary, extra.startsOn, extra.endsOn ?? null],
  );
  const id = rows[0].id;
  if (extra.paused) await tx.query("update public.recurring_rules set paused_at = now() where id = $1", [id]);
  return id;
}

async function ensure(tx: Transaction, householdId: string = HOUSEHOLDS.silva): Promise<number> {
  const { rows } = await tx.query<{ n: number }>("select public.ensure_recurring_transactions($1) as n", [householdId]);
  return rows[0].n;
}

async function generatedDates(tx: Transaction, ruleId: string): Promise<string[]> {
  const { rows } = await tx.query<{ d: string }>(
    "select occurred_on::text as d from public.transactions where recurring_rule_id = $1 and deleted_at is null order by 1",
    [ruleId],
  );
  return rows.map((row) => row.d);
}

describe("occurrence dates", () => {
  it("falls on the last day of shorter months", async () => {
    expect(await occurrences("monthly", 1, 31, "2027-01-31", "2027-01-01", "2027-04-30")).toEqual([
      "2027-01-31",
      "2027-02-28",
      "2027-03-31",
      "2027-04-30",
    ]);
  });

  it("never starts before the rule does", async () => {
    expect(await occurrences("monthly", 1, 5, "2026-10-15", "2026-10-01", "2026-12-31")).toEqual([
      "2026-11-05",
      "2026-12-05",
    ]);
  });

  it("supports intervals, weeks and years", async () => {
    expect(await occurrences("monthly", 3, null, "2026-01-10", "2026-01-01", "2026-12-31")).toEqual([
      "2026-01-10",
      "2026-04-10",
      "2026-07-10",
      "2026-10-10",
    ]);
    expect(await occurrences("weekly", 2, null, "2026-10-01", "2026-10-20", "2026-11-30")).toEqual([
      "2026-10-29",
      "2026-11-12",
      "2026-11-26",
    ]);
    expect(await occurrences("yearly", 1, null, "2024-02-29", "2024-01-01", "2026-12-31")).toEqual([
      "2024-02-29",
      "2025-02-28",
      "2026-02-28",
    ]);
  });
});

describe("recurring transactions generator", () => {
  it("materializes occurrences up to the end of next month, as pending planned entries", async () => {
    const result = await runAs(db, USERS.aliceOwner, async (tx) => {
      const ruleId = await insertRule(tx, { startsOn: monthFromNow(-2) });
      const created = await ensure(tx);
      const { rows } = await tx.query<{ status: string; is_planned: boolean; created_by: string }>(
        "select distinct status::text, is_planned, created_by from public.transactions where recurring_rule_id = $1",
        [ruleId],
      );
      return { created, dates: await generatedDates(tx, ruleId), rows };
    });

    const expected = [-2, -1, 0, 1].map((offset) => monthFromNow(offset).replace(/01$/, "05"));
    expect(result.created).toBe(4);
    expect(result.dates).toEqual(expected);
    expect(result.rows).toEqual([{ status: "pending", is_planned: true, created_by: USERS.aliceOwner }]);
  });

  it("is idempotent and never brings back a deleted occurrence", async () => {
    const result = await runAs(db, USERS.aliceOwner, async (tx) => {
      const ruleId = await insertRule(tx, { startsOn: monthFromNow(0) });
      await ensure(tx);
      const second = await ensure(tx);
      const { rows } = await tx.query<{ id: string }>(
        "select id from public.transactions where recurring_rule_id = $1 order by occurred_on limit 1",
        [ruleId],
      );
      await tx.query("select public.soft_delete_transaction($1)", [rows[0].id]);
      const third = await ensure(tx);
      return { second, third, remaining: (await generatedDates(tx, ruleId)).length };
    });
    expect(result).toEqual({ second: 0, third: 0, remaining: 1 });
  });

  it("respects the end date and skips paused rules", async () => {
    const result = await runAs(db, USERS.aliceOwner, async (tx) => {
      const ended = await insertRule(tx, { startsOn: monthFromNow(-3), endsOn: monthFromNow(-2) });
      const paused = await insertRule(tx, { startsOn: monthFromNow(-1), paused: true });
      await ensure(tx);
      return { ended: (await generatedDates(tx, ended)).length, paused: (await generatedDates(tx, paused)).length };
    });
    expect(result).toEqual({ ended: 1, paused: 0 });
  });

  it("does not back-fill the months a rule was paused", async () => {
    const dates = await runAs(db, USERS.aliceOwner, async (tx) => {
      const ruleId = await insertRule(tx, { startsOn: monthFromNow(-3), paused: true });
      await tx.query("update public.recurring_rules set paused_at = null where id = $1", [ruleId]);
      await ensure(tx);
      return generatedDates(tx, ruleId);
    });
    const thisMonth = monthFromNow(0);
    expect(dates.every((date) => date >= thisMonth)).toBe(true);
  });

  it("does not let clients write generated_until", async () => {
    const message = await errorAs(db, USERS.aliceOwner, async (tx) => {
      const ruleId = await insertRule(tx, { startsOn: monthFromNow(0) });
      await tx.query("update public.recurring_rules set generated_until = '2030-01-01' where id = $1", [ruleId]);
    });
    expect(message).toMatch(/permission denied/);
  });

  it("only runs for members of the household", async () => {
    expect(await errorAs(db, USERS.erinOtherOwner, (tx) => ensure(tx, HOUSEHOLDS.silva))).toBe("not_found_or_forbidden");
    expect(await errorAs(db, null, (tx) => ensure(tx, HOUSEHOLDS.silva))).toMatch(/permission denied/);
  });

  it("keeps the daily generated_until bump out of the audit trail", async () => {
    const actions = await runAs(db, USERS.aliceOwner, async (tx) => {
      const ruleId = await insertRule(tx, { startsOn: monthFromNow(0) });
      await ensure(tx);
      const { rows } = await tx.query<{ action: string }>(
        "select action from public.audit_logs where entity_id = $1 order by id",
        [ruleId],
      );
      return rows.map((row) => row.action);
    });
    expect(actions).toEqual(["recurring_rule.created"]);
  });
});
