import { Decimal } from "@prisma/client/runtime/client";

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
