/**
 * Pure cart-totals computation. Same logic runs client-side (live UI) and
 * server-side (POST /api/pos/sales validation). Inputs are plain JSON-friendly
 * strings; outputs are 3-decimal money strings ready to persist as Decimal.
 */

import {
  applyDiscount,
  fromMillimes,
  taxFromTtc,
  toMillimes,
} from "./money";

export type CartLineInput = {
  kind: "SERVICE" | "PRODUCT";
  offerId?: string;
  productId?: string;
  nameSnapshot: string;
  priceSnapshot: string;
  taxRateSnapshot: string;
  quantity: number;
  discount?: { value: string; isPercent: boolean };
  assignedEmployeeId?: string;
};

export type CartInput = {
  lines: CartLineInput[];
  saleDiscount?: { value: string; isPercent: boolean };
  tipTotal?: string;
};

export type ComputedLine = {
  lineSubtotal: string;
  lineTaxAmount: string;
  lineTotal: string;
  discountAmount: string;
};

export type ComputedTotals = {
  lines: ComputedLine[];
  subtotal: string;
  saleDiscountAmount: string;
  taxTotal: string;
  tipTotal: string;
  total: string;
  taxBreakdown: Array<{ rate: string; base: string; tax: string }>;
};

/**
 * Compute totals.
 *
 * Pricing convention: every priceSnapshot is TTC (tax-inclusive). Tax for the
 * line is derived from the TTC line subtotal at the snapshotted rate.
 *
 * Sale-level discount is allocated proportionally across lines (so tax is
 * recomputed correctly per rate after the discount). The sale discount is
 * applied to the post-line-discount subtotal.
 */
export function computeTotals(cart: CartInput): ComputedTotals {
  const lineComputations: ComputedLine[] = [];
  let subtotalM = 0; // millimes

  for (const line of cart.lines) {
    const unitM = toMillimes(line.priceSnapshot);
    const grossM = unitM * Math.max(0, line.quantity);

    let appliedM = 0;
    if (line.discount) {
      const { appliedAmount } = applyDiscount(
        fromMillimes(grossM),
        line.discount.value,
        line.discount.isPercent,
      );
      appliedM = toMillimes(appliedAmount);
    }
    const lineSubtotalM = grossM - appliedM;
    const lineSubtotalStr = fromMillimes(lineSubtotalM);
    const lineTaxStr = taxFromTtc(lineSubtotalStr, line.taxRateSnapshot);

    lineComputations.push({
      lineSubtotal: lineSubtotalStr,
      lineTaxAmount: lineTaxStr,
      lineTotal: lineSubtotalStr,
      discountAmount: fromMillimes(appliedM),
    });
    subtotalM += lineSubtotalM;
  }

  const subtotalStr = fromMillimes(subtotalM);

  // Apply sale-level discount proportionally across lines (so per-line tax
  // is correct per snapshotted rate after the cut).
  let saleDiscountM = 0;
  if (cart.saleDiscount && subtotalM > 0) {
    const { appliedAmount } = applyDiscount(
      subtotalStr,
      cart.saleDiscount.value,
      cart.saleDiscount.isPercent,
    );
    saleDiscountM = toMillimes(appliedAmount);
  }

  // Allocate the sale discount across lines proportionally to each line's
  // post-discount share of the subtotal. The largest remainder gets any
  // millime that rounding leaves over so totals tie out exactly.
  const adjustedLines = lineComputations.map((line) => ({ ...line }));
  if (saleDiscountM > 0 && subtotalM > 0) {
    let allocated = 0;
    let largestIdx = 0;
    let largestShare = -1;
    for (let i = 0; i < adjustedLines.length; i++) {
      const lineM = toMillimes(adjustedLines[i].lineSubtotal);
      const share = Math.floor((saleDiscountM * lineM) / subtotalM);
      const newSubM = lineM - share;
      const rateStr = cart.lines[i].taxRateSnapshot;
      adjustedLines[i].lineSubtotal = fromMillimes(newSubM);
      adjustedLines[i].lineTotal = fromMillimes(newSubM);
      adjustedLines[i].lineTaxAmount = taxFromTtc(fromMillimes(newSubM), rateStr);
      allocated += share;
      if (lineM > largestShare) {
        largestShare = lineM;
        largestIdx = i;
      }
    }
    const remainder = saleDiscountM - allocated;
    if (remainder !== 0) {
      const lineM = toMillimes(adjustedLines[largestIdx].lineSubtotal);
      const newSubM = Math.max(0, lineM - remainder);
      const rateStr = cart.lines[largestIdx].taxRateSnapshot;
      adjustedLines[largestIdx].lineSubtotal = fromMillimes(newSubM);
      adjustedLines[largestIdx].lineTotal = fromMillimes(newSubM);
      adjustedLines[largestIdx].lineTaxAmount = taxFromTtc(fromMillimes(newSubM), rateStr);
    }
  }

  // Tax total = sum of per-line tax amounts (post sale discount).
  let taxTotalM = 0;
  for (const l of adjustedLines) taxTotalM += toMillimes(l.lineTaxAmount);

  // Tax breakdown by rate.
  const breakdownByRate = new Map<string, { baseM: number; taxM: number }>();
  for (let i = 0; i < adjustedLines.length; i++) {
    const rate = cart.lines[i].taxRateSnapshot;
    const lineM = toMillimes(adjustedLines[i].lineSubtotal);
    const taxM = toMillimes(adjustedLines[i].lineTaxAmount);
    const entry = breakdownByRate.get(rate) ?? { baseM: 0, taxM: 0 };
    entry.baseM += lineM - taxM; // HT base
    entry.taxM += taxM;
    breakdownByRate.set(rate, entry);
  }

  const taxBreakdown = Array.from(breakdownByRate.entries())
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([rate, { baseM, taxM }]) => ({
      rate,
      base: fromMillimes(baseM),
      tax: fromMillimes(taxM),
    }));

  const tipM = cart.tipTotal ? toMillimes(cart.tipTotal) : 0;
  const totalM = subtotalM - saleDiscountM + tipM;

  return {
    lines: adjustedLines,
    subtotal: subtotalStr,
    saleDiscountAmount: fromMillimes(saleDiscountM),
    taxTotal: fromMillimes(taxTotalM),
    tipTotal: fromMillimes(tipM),
    total: fromMillimes(totalM),
    taxBreakdown,
  };
}

/**
 * True if the two computed totals agree within `epsilonMillimes`.
 * Used by `POST /api/pos/sales` to reject client-vs-server divergence.
 */
export function totalsEqual(
  a: ComputedTotals,
  b: ComputedTotals,
  epsilonMillimes = 1,
): boolean {
  const aM = toMillimes(a.total);
  const bM = toMillimes(b.total);
  return Math.abs(aM - bM) <= epsilonMillimes;
}
