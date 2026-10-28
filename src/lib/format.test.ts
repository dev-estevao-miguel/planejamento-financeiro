import { describe, expect, it } from "vitest";
import { formatPercent } from "./format";

describe("formatPercent", () => {
  it("formats ratios and shows a dash when there is no base", () => {
    expect(formatPercent(0.6875)).toBe("68,8%");
    expect(formatPercent(1.2, { digits: 0 })).toBe("120%");
    expect(formatPercent(null)).toBe("—");
  });
});
