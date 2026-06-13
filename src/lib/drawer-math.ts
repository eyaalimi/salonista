import { Decimal } from "@prisma/client/runtime/client";

/**
 * Inputs for the drawer expected-cash calculation.
 *
 * Callers must coalesce Prisma `_sum` aggregates to `new Decimal("0")` —
 * `_sum` returns `Decimal | null` when no rows match the where clause.
 */
export type DrawerInputs = {
  openingFloat: Decimal;
  cashSales: Decimal;
  cashRefunds: Decimal;
  expenses: Decimal;
};

/** openingFloat + cashSales − cashRefunds − expenses */
export function expectedCash(d: DrawerInputs): Decimal {
  return d.openingFloat.add(d.cashSales).sub(d.cashRefunds).sub(d.expenses);
}

/** counted − expected. Positive = excess, negative = missing. */
export function variance(expected: Decimal, counted: Decimal): Decimal {
  return counted.sub(expected);
}
