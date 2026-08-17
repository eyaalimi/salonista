import { describe, it, expect } from "vitest";
import {
  toMillimes,
  fromMillimes,
  roundMillime,
  ttcToHt,
  htToTtc,
  taxFromTtc,
  applyDiscount,
  addMoney,
  subMoney,
  mulMoney,
  formatDT,
} from "./money";

describe("toMillimes / fromMillimes", () => {
  it("round-trips clean values", () => {
    expect(fromMillimes(toMillimes("12.500"))).toBe("12.500");
    expect(fromMillimes(toMillimes(0))).toBe("0.000");
    expect(fromMillimes(toMillimes("0.001"))).toBe("0.001");
  });
  it("pads fractional part", () => {
    expect(fromMillimes(toMillimes("1"))).toBe("1.000");
    expect(fromMillimes(toMillimes("1.5"))).toBe("1.500");
  });
  it("handles negatives", () => {
    expect(fromMillimes(toMillimes("-2.500"))).toBe("-2.500");
  });
  it("throws on NaN", () => {
    expect(() => toMillimes("nope")).toThrow();
  });
});

describe("roundMillime", () => {
  it("rounds half-up to 3 decimals", () => {
    expect(roundMillime("1.5005")).toBe("1.501");
    expect(roundMillime("1.5004")).toBe("1.500");
  });
});

describe("ttcToHt / htToTtc / taxFromTtc", () => {
  it("19% reverse-calculates HT correctly", () => {
    // TTC 119 with 19% tax → HT 100
    expect(ttcToHt("119.000", "19")).toBe("100.000");
    expect(taxFromTtc("119.000", "19")).toBe("19.000");
  });
  it("htToTtc round-trips with ttcToHt at typical rates", () => {
    const cases = ["7", "13", "19"];
    for (const r of cases) {
      const ttc = htToTtc("100.000", r);
      const ht = ttcToHt(ttc, r);
      expect(ht).toBe("100.000");
    }
  });
  it("0% tax is a passthrough", () => {
    expect(ttcToHt("75.000", "0")).toBe("75.000");
    expect(htToTtc("75.000", "0")).toBe("75.000");
    expect(taxFromTtc("75.000", "0")).toBe("0.000");
  });
});

describe("applyDiscount", () => {
  it("percent discount", () => {
    expect(applyDiscount("100.000", "10", true)).toEqual({
      discounted: "90.000",
      appliedAmount: "10.000",
    });
  });
  it("fixed discount", () => {
    expect(applyDiscount("100.000", "5.000", false)).toEqual({
      discounted: "95.000",
      appliedAmount: "5.000",
    });
  });
  it("100% discount = full amount applied, zero remaining", () => {
    expect(applyDiscount("80.000", "100", true)).toEqual({
      discounted: "0.000",
      appliedAmount: "80.000",
    });
  });
  it("clamps applied amount at base — fixed value larger than base", () => {
    expect(applyDiscount("10.000", "20.000", false)).toEqual({
      discounted: "0.000",
      appliedAmount: "10.000",
    });
  });
  it("clamps at zero — negative applied not allowed", () => {
    expect(applyDiscount("10.000", "-5", true)).toEqual({
      discounted: "10.000",
      appliedAmount: "0.000",
    });
  });
  it("works on very small amounts (millime precision)", () => {
    expect(applyDiscount("0.100", "50", true)).toEqual({
      discounted: "0.050",
      appliedAmount: "0.050",
    });
  });
});

describe("addMoney / subMoney / mulMoney", () => {
  it("adds without floating drift", () => {
    expect(addMoney("0.100", "0.200", "0.300")).toBe("0.600");
    expect(addMoney("12.500", "7.500")).toBe("20.000");
  });
  it("subtracts", () => {
    expect(subMoney("10.000", "3.500")).toBe("6.500");
  });
  it("multiplies", () => {
    expect(mulMoney("12.500", 3)).toBe("37.500");
  });
});

describe("formatDT", () => {
  it("formats with comma decimal separator", () => {
    expect(formatDT("12.500")).toBe("12,500 TND");
    expect(formatDT("0.000")).toBe("0,000 TND");
    expect(formatDT("1234.567")).toBe("1234,567 TND");
  });
  it("formats negatives", () => {
    expect(formatDT("-5.000")).toBe("-5,000 TND");
  });
});
