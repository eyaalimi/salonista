import { describe, it, expect } from "vitest";
import { computeEarnedPoints, type SaleForEarn } from "./earn";
import { validateRedemption, RedemptionError } from "./redeem";
import { programToCashbackPct, cashbackPctToProgram } from "./program";

const baseProgram = {
  pointsPerDinar: "3.000",
  dinarPerPoint: "0.010",
  active: true,
  eligibleOn: "BOTH" as const,
  minPointsToRedeem: 100,
  maxRedemptionPctPerSale: 50,
};

function sale(items: SaleForEarn["items"], total: string, payments: SaleForEarn["payments"] = []): SaleForEarn {
  return {
    id: "sale_1",
    customerId: "cust_1",
    subtotal: total,
    discountAmount: "0.000",
    total,
    items,
    payments,
  };
}

describe("computeEarnedPoints", () => {
  it("returns 0 when program inactive", () => {
    const s = sale([{ kind: "SERVICE", lineTotal: "100.000" }], "100.000");
    expect(computeEarnedPoints(s, { ...baseProgram, active: false })).toBe(0);
  });

  it("BOTH eligibility earns on services and products", () => {
    const s = sale(
      [
        { kind: "SERVICE", lineTotal: "60.000" },
        { kind: "PRODUCT", lineTotal: "40.000" },
      ],
      "100.000",
    );
    // 100 DT × 3 pts/DT = 300 pts
    expect(computeEarnedPoints(s, baseProgram)).toBe(300);
  });

  it("SERVICES_ONLY excludes product lines", () => {
    const s = sale(
      [
        { kind: "SERVICE", lineTotal: "60.000" },
        { kind: "PRODUCT", lineTotal: "40.000" },
      ],
      "100.000",
    );
    expect(computeEarnedPoints(s, { ...baseProgram, eligibleOn: "SERVICES_ONLY" })).toBe(180);
  });

  it("PRODUCTS_ONLY excludes service lines", () => {
    const s = sale(
      [
        { kind: "SERVICE", lineTotal: "60.000" },
        { kind: "PRODUCT", lineTotal: "40.000" },
      ],
      "100.000",
    );
    expect(computeEarnedPoints(s, { ...baseProgram, eligibleOn: "PRODUCTS_ONLY" })).toBe(120);
  });

  it("does not earn on the loyalty-paid portion of the sale (no infinite loop)", () => {
    // Sale total 60 DT, customer paid 2 DT in points and 58 DT cash.
    // Loyalty is proportional to eligible/total = 60/60 = 1.0 → 2 DT off eligible.
    // base = 60 - 2 = 58 DT; earn = 58 × 3 = 174.
    const s = sale(
      [{ kind: "SERVICE", lineTotal: "60.000" }],
      "60.000",
      [
        { method: "LOYALTY_POINTS", amount: "2.000" },
        { method: "CASH", amount: "58.000" },
      ],
    );
    expect(computeEarnedPoints(s, baseProgram)).toBe(174);
  });

  it("returns 0 when loyalty payment covers eligible base", () => {
    const s = sale(
      [{ kind: "SERVICE", lineTotal: "60.000" }],
      "60.000",
      [{ method: "LOYALTY_POINTS", amount: "60.000" }],
    );
    expect(computeEarnedPoints(s, baseProgram)).toBe(0);
  });

  it("returns 0 when there are no eligible lines", () => {
    const s = sale([{ kind: "PRODUCT", lineTotal: "40.000" }], "40.000");
    expect(computeEarnedPoints(s, { ...baseProgram, eligibleOn: "SERVICES_ONLY" })).toBe(0);
  });

  it("floors fractional point earnings", () => {
    // 33.333 DT × 3 = 99.999 → 99 pts (floor)
    const s = sale([{ kind: "SERVICE", lineTotal: "33.333" }], "33.333");
    expect(computeEarnedPoints(s, baseProgram)).toBe(99);
  });
});

describe("validateRedemption", () => {
  it("rejects below-min", () => {
    expect(() =>
      validateRedemption({
        walletBalance: 200,
        pointsToRedeem: 50,
        saleTotal: "100.000",
        program: baseProgram,
      }),
    ).toThrow(RedemptionError);
  });

  it("rejects insufficient balance", () => {
    expect(() =>
      validateRedemption({
        walletBalance: 50,
        pointsToRedeem: 100,
        saleTotal: "100.000",
        program: baseProgram,
      }),
    ).toThrow(RedemptionError);
  });

  it("rejects exceeding maxRedemptionPctPerSale", () => {
    // saleTotal 10 DT, max 50% → 5 DT max → 500 pts max.
    expect(() =>
      validateRedemption({
        walletBalance: 1000,
        pointsToRedeem: 600,
        saleTotal: "10.000",
        program: baseProgram,
      }),
    ).toThrow(RedemptionError);
  });

  it("rejects when program is inactive", () => {
    expect(() =>
      validateRedemption({
        walletBalance: 1000,
        pointsToRedeem: 100,
        saleTotal: "100.000",
        program: { ...baseProgram, active: false },
      }),
    ).toThrow(RedemptionError);
  });

  it("returns DT value on valid redemption", () => {
    const { redemptionValue } = validateRedemption({
      walletBalance: 1000,
      pointsToRedeem: 200,
      saleTotal: "60.000",
      program: baseProgram,
    });
    // 200 × 0.010 = 2.000 DT
    expect(redemptionValue).toBe("2.000");
  });

  it("rejects zero or negative points", () => {
    expect(() =>
      validateRedemption({
        walletBalance: 1000,
        pointsToRedeem: 0,
        saleTotal: "100.000",
        program: baseProgram,
      }),
    ).toThrow(RedemptionError);
  });
});

describe("cashback bridge", () => {
  it("programToCashbackPct multiplies the two ratios × 100", () => {
    expect(programToCashbackPct({ pointsPerDinar: "3.000", dinarPerPoint: "0.010" })).toBe("3.000");
    expect(programToCashbackPct({ pointsPerDinar: "1.000", dinarPerPoint: "0.010" })).toBe("1.000");
    expect(programToCashbackPct({ pointsPerDinar: "5.000", dinarPerPoint: "0.020" })).toBe("10.000");
  });

  it("cashbackPctToProgram returns canonical (0.010 DT/pt) ratios", () => {
    expect(cashbackPctToProgram(3)).toEqual({
      pointsPerDinar: "3.000",
      dinarPerPoint: "0.010",
    });
    expect(cashbackPctToProgram(0.5)).toEqual({
      pointsPerDinar: "0.500",
      dinarPerPoint: "0.010",
    });
  });

  it("rejects negative cashback %", () => {
    expect(() => cashbackPctToProgram(-1)).toThrow();
  });
});
