import { describe, expect, it } from "vitest";
import { formatMoney, parseMoneyInput, sumCents, toCents, toDecimalString } from "./money";

const NBSP = " ";

describe("toCents", () => {
  it.each([
    [199.99, 19999],
    [0.1 + 0.2, 30],
    [2700, 270000],
    ["163.06", 16306],
    ["1302.55", 130255],
    ["0.5", 50],
    ["-12.30", -1230],
  ])("converts %s to %i cents", (input, expected) => {
    expect(toCents(input)).toBe(expected);
  });

  it("rejects malformed values", () => {
    expect(() => toCents("12,30")).toThrow(RangeError);
    expect(() => toCents(Number.NaN)).toThrow(RangeError);
  });
});

describe("toDecimalString", () => {
  it.each([
    [19999, "199.99"],
    [5, "0.05"],
    [270000, "2700.00"],
    [-1230, "-12.30"],
  ])("formats %i as %s", (cents, expected) => {
    expect(toDecimalString(cents)).toBe(expected);
  });
});

describe("formatMoney", () => {
  it("uses the Brazilian format", () => {
    expect(formatMoney(123456)).toBe(`R$${NBSP}1.234,56`);
    expect(formatMoney(270000)).toBe(`R$${NBSP}2.700,00`);
  });

  it("formats negative balances", () => {
    expect(formatMoney(-469650)).toBe(`-R$${NBSP}4.696,50`);
  });
});

describe("parseMoneyInput", () => {
  it.each([
    ["2700", 270000],
    ["2.700", 270000],
    ["2.700,50", 270050],
    ["1.234.567,89", 123456789],
    ["85,9", 8590],
    ["85,90", 8590],
    ["R$ 85,90", 8590],
    [`R$${NBSP}1.234,56`, 123456],
    ["85.90", 8590],
    ["0,05", 5],
  ])("parses %s", (input, expected) => {
    expect(parseMoneyInput(input)).toBe(expected);
  });

  it.each(["", "abc", "-10", "1,2,3", "12,345", "27.00.0", "1.2345", "1,000.50"])("rejects %s", (input) => {
    expect(parseMoneyInput(input)).toBeNull();
  });
});

describe("sumCents", () => {
  it("adds without floating point drift", () => {
    // The spreadsheet's "Total cartões" for Nov/26 showed 1302.5500000000002.
    expect(sumCents([58272, 71983, 0, 0])).toBe(130255);
  });
});
