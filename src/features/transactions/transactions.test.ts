import { describe, expect, it } from "vitest";
import { effectivePermissions } from "@/features/auth/permissions";
import { formatAmountInput, formatSignedAmount } from "./format";
import { splitInstallments } from "./installments";
import { databaseErrorMessage, TRANSACTION_MESSAGES } from "./labels";
import { readTransactionForm, transactionFormSchema } from "./schemas";
import { searchPattern } from "./search";

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const VALID = {
  kind: "expense",
  description: "  Supermercado ",
  amount: "85,9",
  occurredOn: "2026-10-23",
  status: "paid",
};

describe("transaction form", () => {
  it("parses pt-BR amounts and normalizes empty optionals", () => {
    const parsed = transactionFormSchema.parse(readTransactionForm(form(VALID)));
    expect(parsed).toMatchObject({
      id: null,
      kind: "expense",
      description: "Supermercado",
      amount: 8590,
      categoryId: null,
      memberId: null,
      notes: null,
      isPrivate: false,
      installments: 1,
      repeatMonthly: false,
      repeatUntil: null,
    });
  });

  it("reads checkboxes", () => {
    const repeating = transactionFormSchema.parse(
      readTransactionForm(form({ ...VALID, repeatMonthly: "on", repeatUntil: "2027-06-23" })),
    );
    expect(repeating).toMatchObject({ isPrivate: false, repeatMonthly: true, repeatUntil: "2027-06-23" });
    expect(transactionFormSchema.parse(readTransactionForm(form({ ...VALID, isPrivate: "on" }))).isPrivate).toBe(true);
  });

  it.each([
    [{ amount: "0" }, "amount"],
    [{ amount: "abc" }, "amount"],
    [{ description: "   " }, "description"],
    [{ occurredOn: "2026-02-30" }, "occurredOn"],
    [{ kind: "transfer" }, "kind"],
    [{ categoryId: "not-a-uuid" }, "categoryId"],
    [{ installments: "0" }, "installments"],
    [{ installments: "3", repeatMonthly: "on" }, "installments"],
    [{ amount: "0,02", installments: "3" }, "amount"],
    [{ repeatMonthly: "on", repeatUntil: "2026-01-01" }, "repeatUntil"],
    [{ repeatMonthly: "on", isPrivate: "on" }, "repeatUntil"],
  ])("rejects %o", (override, field) => {
    const result = transactionFormSchema.safeParse(readTransactionForm(form({ ...VALID, ...override })));
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path[0])).toContain(field);
  });
});

describe("installments", () => {
  it("adds up to the total exactly and moves month by month", () => {
    const parts = splitInstallments(10000, 3, "2027-01-31");
    expect(parts.map((part) => part.amountCents)).toEqual([3334, 3333, 3333]);
    expect(parts.map((part) => part.occurredOn)).toEqual(["2027-01-31", "2027-02-28", "2027-03-31"]);
    expect(parts.map((part) => part.number)).toEqual([1, 2, 3]);
  });

  it("refuses impossible splits", () => {
    expect(() => splitInstallments(2, 3, "2026-10-01")).toThrow(RangeError);
    expect(() => splitInstallments(100, 0, "2026-10-01")).toThrow(RangeError);
  });
});

describe("database errors", () => {
  it("translates stable codes and permission failures, hiding everything else", () => {
    expect(databaseErrorMessage({ message: "category_kind_mismatch" })).toMatch(/categoria/);
    expect(databaseErrorMessage({ code: "42501", message: "new row violates row-level security policy" })).toBe(
      TRANSACTION_MESSAGES.forbidden,
    );
    expect(databaseErrorMessage({ code: "XX000", message: "relation secret_table does not exist" })).toBe(
      TRANSACTION_MESSAGES.unavailable,
    );
  });
});

describe("effective permissions", () => {
  it("applies role defaults and per-member overrides; the owner holds everything", () => {
    expect(effectivePermissions("viewer", [])).toEqual(["finance.view"]);
    expect(
      effectivePermissions("member", [
        { permission: "finance.delete", granted: true },
        { permission: "finance.create", granted: false },
      ]),
    ).toEqual(["finance.view", "finance.edit", "finance.delete"]);
    expect(effectivePermissions("owner", [{ permission: "finance.view", granted: false }])).toHaveLength(7);
  });
});

describe("search", () => {
  it("normalizes like search_text and escapes LIKE wildcards", () => {
    expect(searchPattern("  Farmácia ")).toBe("%farmacia%");
    expect(searchPattern("50%_off")).toBe(String.raw`%50\%\_off%`);
  });
});

describe("formatting", () => {
  it("signs amounts by kind and round-trips the input format", () => {
    expect(formatSignedAmount("income", 270000)).toBe("+ R$ 2.700,00");
    expect(formatSignedAmount("expense", 8590)).toBe("− R$ 85,90");
    expect(formatSignedAmount("investment", 100)).toBe("R$ 1,00");
    expect(formatAmountInput(8590)).toBe("85,90");
    expect(formatAmountInput(270000)).toBe("2700,00");
  });
});
