import { describe, it, expect } from "vitest";
import { Decimal } from "@prisma/client/runtime/client";
import { expectedCash, variance } from "./drawer-math";

const D = (x: string) => new Decimal(x);

describe("expectedCash", () => {
  it("happy path: 100 + 820 − 60 − 35 = 825", () => {
    const r = expectedCash({
      openingFloat: D("100.000"),
      cashSales: D("820.000"),
      cashRefunds: D("60.000"),
      expenses: D("35.000"),
    });
    expect(r.toFixed(3)).toBe("825.000");
  });

  it("opening 0, no expenses, no refunds", () => {
    const r = expectedCash({
      openingFloat: D("0"),
      cashSales: D("50.000"),
      cashRefunds: D("0"),
      expenses: D("0"),
    });
    expect(r.toFixed(3)).toBe("50.000");
  });

  it("expenses > cashSales: variance allowed to go negative beyond cashSales", () => {
    const r = expectedCash({
      openingFloat: D("100.000"),
      cashSales: D("20.000"),
      cashRefunds: D("0"),
      expenses: D("50.000"),
    });
    expect(r.toFixed(3)).toBe("70.000");
  });

  it("3-decimal TND precision round-trips exact", () => {
    const r = expectedCash({
      openingFloat: D("0.001"),
      cashSales: D("0.002"),
      cashRefunds: D("0"),
      expenses: D("0"),
    });
    expect(r.toFixed(3)).toBe("0.003");
  });
});

describe("variance", () => {
  it("missing counted < expected returns negative", () => {
    expect(variance(D("825.000"), D("820.000")).toFixed(3)).toBe("-5.000");
  });

  it("excess counted > expected returns positive", () => {
    expect(variance(D("825.000"), D("830.000")).toFixed(3)).toBe("5.000");
  });

  it("counted = expected returns 0", () => {
    expect(variance(D("825.000"), D("825.000")).toFixed(3)).toBe("0.000");
  });
});
