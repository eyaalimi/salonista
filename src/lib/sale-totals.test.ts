import { describe, it, expect } from "vitest";
import { computeTotals, totalsEqual, type CartInput } from "./sale-totals";

function line(
  price: string,
  rate: string,
  qty = 1,
  discount?: { value: string; isPercent: boolean },
): CartInput["lines"][number] {
  return {
    kind: "SERVICE",
    nameSnapshot: "x",
    priceSnapshot: price,
    taxRateSnapshot: rate,
    quantity: qty,
    ...(discount ? { discount } : {}),
  };
}

describe("computeTotals — single line, no discounts", () => {
  it("totals = unit × qty for plain TTC", () => {
    const r = computeTotals({ lines: [line("119.000", "19", 1)] });
    expect(r.subtotal).toBe("119.000");
    expect(r.taxTotal).toBe("19.000");
    expect(r.total).toBe("119.000");
    expect(r.taxBreakdown).toEqual([{ rate: "19", base: "100.000", tax: "19.000" }]);
  });

  it("0% tax → no tax", () => {
    const r = computeTotals({ lines: [line("50.000", "0", 1)] });
    expect(r.taxTotal).toBe("0.000");
    expect(r.total).toBe("50.000");
  });
});

describe("computeTotals — line discounts", () => {
  it("percent discount", () => {
    const r = computeTotals({
      lines: [line("100.000", "19", 1, { value: "10", isPercent: true })],
    });
    expect(r.subtotal).toBe("90.000");
    expect(r.lines[0].discountAmount).toBe("10.000");
    expect(r.total).toBe("90.000");
  });
  it("fixed discount", () => {
    const r = computeTotals({
      lines: [line("100.000", "19", 1, { value: "5.000", isPercent: false })],
    });
    expect(r.subtotal).toBe("95.000");
  });
});

describe("computeTotals — sale-level discount", () => {
  it("percent allocation across two lines preserves total exactly", () => {
    const r = computeTotals({
      lines: [line("60.000", "19", 1), line("40.000", "19", 1)],
      saleDiscount: { value: "10", isPercent: true },
    });
    expect(r.subtotal).toBe("100.000");
    expect(r.saleDiscountAmount).toBe("10.000");
    expect(r.total).toBe("90.000");
    // Sum of lines after allocation = total
    const sum = r.lines.reduce(
      (acc, l) => acc + Number(l.lineSubtotal.replace(",", ".")),
      0,
    );
    expect(sum.toFixed(3)).toBe("90.000");
  });

  it("fixed sale discount", () => {
    const r = computeTotals({
      lines: [line("60.000", "19", 1), line("40.000", "19", 1)],
      saleDiscount: { value: "5.000", isPercent: false },
    });
    expect(r.total).toBe("95.000");
  });

  it("100% sale discount → total is just the tip", () => {
    const r = computeTotals({
      lines: [line("75.000", "19", 1)],
      saleDiscount: { value: "100", isPercent: true },
      tipTotal: "10.000",
    });
    expect(r.subtotal).toBe("75.000");
    expect(r.saleDiscountAmount).toBe("75.000");
    expect(r.total).toBe("10.000");
  });
});

describe("computeTotals — multi-rate tax breakdown", () => {
  it("groups by rate", () => {
    const r = computeTotals({
      lines: [
        line("119.000", "19", 1),
        line("113.000", "13", 1),
      ],
    });
    expect(r.taxBreakdown).toEqual([
      { rate: "13", base: "100.000", tax: "13.000" },
      { rate: "19", base: "100.000", tax: "19.000" },
    ]);
    expect(r.total).toBe("232.000");
  });
});

describe("computeTotals — tip", () => {
  it("tip is added to total but not to subtotal", () => {
    const r = computeTotals({
      lines: [line("50.000", "19", 1)],
      tipTotal: "10.000",
    });
    expect(r.subtotal).toBe("50.000");
    expect(r.total).toBe("60.000");
    expect(r.tipTotal).toBe("10.000");
  });
});

describe("computeTotals — quantity & multiplication", () => {
  it("quantity multiplies the unit price", () => {
    const r = computeTotals({ lines: [line("12.500", "19", 3)] });
    expect(r.subtotal).toBe("37.500");
  });
});

describe("totalsEqual", () => {
  it("equal totals match", () => {
    const a = computeTotals({ lines: [line("100.000", "19", 1)] });
    const b = computeTotals({ lines: [line("100.000", "19", 1)] });
    expect(totalsEqual(a, b)).toBe(true);
  });
  it("differing totals do not match", () => {
    const a = computeTotals({ lines: [line("100.000", "19", 1)] });
    const b = computeTotals({ lines: [line("99.000", "19", 1)] });
    expect(totalsEqual(a, b)).toBe(false);
  });
});

describe("computeTotals — edge cases", () => {
  it("empty cart yields zero totals", () => {
    const r = computeTotals({ lines: [] });
    expect(r.subtotal).toBe("0.000");
    expect(r.taxTotal).toBe("0.000");
    expect(r.total).toBe("0.000");
    expect(r.taxBreakdown).toEqual([]);
  });
  it("very small amount keeps millime precision", () => {
    const r = computeTotals({ lines: [line("0.100", "19", 1)] });
    expect(r.subtotal).toBe("0.100");
  });
});
