import { describe, expect, it } from "vitest";
import {
  addMonthsKeepingDay,
  formatDayLabel,
  parseMonthParam,
  toMonthParam,
  addMonths,
  daysInMonth,
  formatDate,
  formatMonth,
  hourIn,
  monthElapsedRatio,
  monthStart,
  monthsInRange,
  parseIsoDate,
  partOfDay,
  resolvePeriod,
  todayIn,
} from "./dates";

describe("todayIn", () => {
  it("uses the household time zone, not UTC", () => {
    // 02:30 UTC on 24 Oct is still 23 Oct in Recife (UTC-3).
    const now = new Date("2026-10-24T02:30:00Z");
    expect(todayIn("America/Recife", now)).toBe("2026-10-23");
    expect(todayIn("UTC", now)).toBe("2026-10-24");
  });
});

describe("hourIn / partOfDay", () => {
  it("reads the hour in the household time zone", () => {
    expect(hourIn("America/Recife", new Date("2026-10-23T15:30:00Z"))).toBe(12);
    expect(hourIn("America/Recife", new Date("2026-10-24T02:30:00Z"))).toBe(23);
  });

  it.each([
    [4, "evening"],
    [5, "morning"],
    [11, "morning"],
    [12, "afternoon"],
    [17, "afternoon"],
    [18, "evening"],
  ] as const)("%i h -> %s", (hour, expected) => {
    expect(partOfDay(hour)).toBe(expected);
  });
});

describe("formatting", () => {
  it("formats dates as dd/mm/yyyy without timezone shifts", () => {
    expect(formatDate("2026-10-23")).toBe("23/10/2026");
    expect(formatDate("2027-01-01")).toBe("01/01/2027");
  });

  it("formats monthly competences", () => {
    expect(formatMonth("2026-10-01")).toBe("Outubro/2026");
    expect(formatMonth("2026-09-01", "short")).toBe("Set/2026");
    expect(formatMonth("2027-03-01")).toBe("Março/2027");
  });
});

describe("month arithmetic", () => {
  it("normalizes to the first day", () => {
    expect(monthStart("2026-10-23")).toBe("2026-10-01");
  });

  it("crosses year boundaries", () => {
    expect(addMonths("2026-12-01", 1)).toBe("2027-01-01");
    expect(addMonths("2026-01-15", -1)).toBe("2025-12-01");
    expect(addMonths("2026-10-01", -11)).toBe("2025-11-01");
  });

  it("knows month lengths, including leap years", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 10)).toBe(31);
  });

  it("computes how much of the month has elapsed", () => {
    expect(monthElapsedRatio("2026-10-23")).toBeCloseTo(23 / 31);
  });

  it("rejects impossible dates", () => {
    expect(() => parseIsoDate("2026-02-30")).toThrow(RangeError);
    expect(() => parseIsoDate("23/10/2026")).toThrow(RangeError);
  });
});

describe("resolvePeriod", () => {
  const today = "2026-10-23";

  it.each([
    ["current_month", "2026-10-01", "2026-10-01"],
    ["previous_month", "2026-09-01", "2026-09-01"],
    ["last_3_months", "2026-08-01", "2026-10-01"],
    ["last_6_months", "2026-05-01", "2026-10-01"],
    ["last_12_months", "2025-11-01", "2026-10-01"],
    ["current_year", "2026-01-01", "2026-10-01"],
  ] as const)("%s", (preset, from, to) => {
    expect(resolvePeriod(preset, today)).toEqual({ from, to });
  });

  it("lists the months of a range", () => {
    expect(monthsInRange({ from: "2026-11-01", to: "2027-01-01" })).toEqual([
      "2026-11-01",
      "2026-12-01",
      "2027-01-01",
    ]);
  });
});

describe("day-preserving month arithmetic and URL months", () => {
  it("keeps the day, clamped to shorter months", () => {
    expect(addMonthsKeepingDay("2027-01-31", 1)).toBe("2027-02-28");
    expect(addMonthsKeepingDay("2026-10-15", 3)).toBe("2027-01-15");
    expect(addMonthsKeepingDay("2028-03-31", -1)).toBe("2028-02-29");
  });

  it("reads and writes ?mes=YYYY-MM", () => {
    expect(parseMonthParam("2026-09", "2026-10-23")).toBe("2026-09-01");
    expect(parseMonthParam("2026-13", "2026-10-23")).toBe("2026-10-01");
    expect(parseMonthParam(undefined, "2026-10-23")).toBe("2026-10-01");
    expect(parseMonthParam(["2026-09"], "2026-10-23")).toBe("2026-10-01");
    expect(toMonthParam("2026-09-01")).toBe("2026-09");
  });
});

describe("formatDayLabel", () => {
  it("names nearby days and abbreviates the rest", () => {
    expect(formatDayLabel("2026-10-23", "2026-10-23")).toBe("Hoje");
    expect(formatDayLabel("2026-10-22", "2026-10-23")).toBe("Ontem");
    expect(formatDayLabel("2026-10-24", "2026-10-23")).toBe("Amanhã");
    expect(formatDayLabel("2026-10-01", "2026-10-23")).toMatch(/^qui\.?, 01\/10$/);
  });
});
