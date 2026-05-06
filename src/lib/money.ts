/**
 * Money helpers for the Tunisian Dinar (TND, 3-decimal millimes).
 *
 * To dodge floating-point drift, all arithmetic happens on integer millimes
 * (TND × 1000). Inputs may be Decimal-like (Prisma's runtime Decimal),
 * `number`, or `string`; output is always a plain numeric string with exactly
 * 3 decimals (e.g. "12.500"), to match Prisma's `Decimal(10, 3)` columns.
 */

export type Money = string | number | { toString(): string };

const MILLIMES_PER_DT = 1000;

/** Parse a money input into integer millimes. Throws on NaN. */
export function toMillimes(value: Money): number {
  const s = typeof value === "string" ? value : value.toString();
  const n = Number(s);
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid money value: ${s}`);
  }
  return Math.round(n * MILLIMES_PER_DT);
}

/** Format integer millimes as a 3-decimal money string. */
export function fromMillimes(millimes: number): string {
  const sign = millimes < 0 ? "-" : "";
  const abs = Math.abs(millimes);
  const whole = Math.floor(abs / MILLIMES_PER_DT);
  const frac = abs % MILLIMES_PER_DT;
  return `${sign}${whole}.${String(frac).padStart(3, "0")}`;
}

export function roundMillime(d: Money): string {
  return fromMillimes(toMillimes(d));
}

/** Round-half-up to integer millimes from a (possibly fractional) amount. */
function roundMillimesFromFloat(amount: number): number {
  return Math.round(amount + Number.EPSILON);
}

/** TTC → HT given a tax rate percentage (e.g. 19 for 19%). */
export function ttcToHt(ttc: Money, taxRatePct: Money): string {
  const ttcM = toMillimes(ttc);
  const rate = Number(taxRatePct.toString());
  if (rate === 0) return fromMillimes(ttcM);
  const htM = roundMillimesFromFloat(ttcM / (1 + rate / 100));
  return fromMillimes(htM);
}

/** HT → TTC given a tax rate percentage. */
export function htToTtc(ht: Money, taxRatePct: Money): string {
  const htM = toMillimes(ht);
  const rate = Number(taxRatePct.toString());
  if (rate === 0) return fromMillimes(htM);
  const ttcM = roundMillimesFromFloat(htM * (1 + rate / 100));
  return fromMillimes(ttcM);
}

/** Tax (TVA) portion of a TTC price. tax = ttc - ht. */
export function taxFromTtc(ttc: Money, taxRatePct: Money): string {
  const ttcM = toMillimes(ttc);
  const htM = toMillimes(ttcToHt(ttc, taxRatePct));
  return fromMillimes(ttcM - htM);
}

/**
 * Apply a discount (percent or fixed) to a base amount. The result is clamped
 * at 0 — discounts cannot make the amount go negative.
 */
export function applyDiscount(
  base: Money,
  value: Money,
  isPercent: boolean,
): { discounted: string; appliedAmount: string } {
  const baseM = toMillimes(base);
  let appliedM: number;
  if (isPercent) {
    const pct = Number(value.toString());
    if (!Number.isFinite(pct)) throw new Error(`Invalid discount percent: ${value}`);
    appliedM = roundMillimesFromFloat((baseM * pct) / 100);
  } else {
    appliedM = toMillimes(value);
  }
  if (appliedM > baseM) appliedM = baseM;
  if (appliedM < 0) appliedM = 0;
  return {
    discounted: fromMillimes(baseM - appliedM),
    appliedAmount: fromMillimes(appliedM),
  };
}

export function addMoney(...values: Money[]): string {
  let total = 0;
  for (const v of values) total += toMillimes(v);
  return fromMillimes(total);
}

export function subMoney(a: Money, b: Money): string {
  return fromMillimes(toMillimes(a) - toMillimes(b));
}

export function mulMoney(a: Money, multiplier: number): string {
  return fromMillimes(roundMillimesFromFloat(toMillimes(a) * multiplier));
}

/**
 * Tunisian Dinar formatting for human display.
 *
 * "12,500 DT" (3 decimals, comma decimal separator, " DT" suffix).
 * Negative amounts show as "-1,500 DT".
 */
export function formatDT(amount: Money): string {
  const m = toMillimes(amount);
  const sign = m < 0 ? "-" : "";
  const abs = Math.abs(m);
  const whole = Math.floor(abs / MILLIMES_PER_DT);
  const frac = abs % MILLIMES_PER_DT;
  return `${sign}${whole},${String(frac).padStart(3, "0")} DT`;
}
