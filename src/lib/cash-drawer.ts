/**
 * Shared helpers for cash-drawer session math.
 *
 * Expected cash = openingFloat + cash payments during the session
 *                 - cash refunds during the session.
 * Variance      = closingCount - expectedCash (negative = short, positive = over).
 */

import { prisma } from "@/lib/prisma";
import { addMoney, subMoney } from "@/lib/money";

export type DrawerSummary = {
  sessionId: string;
  openedAt: Date;
  closedAt: Date | null;
  openingFloat: string;
  cashSalesCount: number;
  cashSalesTotal: string;
  cardSalesCount: number;
  cardSalesTotal: string;
  tipsTotal: string;
  expensesTotal: string;
  cashRefundsCount: number;
  cashRefundsTotal: string;
  expectedCash: string;
  closingCount: string | null;
  variance: string | null;
};

export async function computeSummary(sessionId: string): Promise<DrawerSummary | null> {
  const session = await prisma.cashDrawerSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      openedAt: true,
      closedAt: true,
      openingFloat: true,
      closingCount: true,
      variance: true,
      employeeId: true,
      providerId: true,
    },
  });
  if (!session) return null;

  // All payments tied to this session (cash + card + tips).
  const sessionPayments = await prisma.payment.findMany({
    where: { cashDrawerSessionId: sessionId },
    select: { amount: true, method: true, sale: { select: { tipTotal: true } } },
  });
  const cashPayments = sessionPayments.filter((p) => p.method === "CASH");
  const cardPayments = sessionPayments.filter((p) => p.method === "CARD");
  const cashSalesTotal = cashPayments.reduce(
    (s, p) => addMoney(s, String(p.amount)),
    "0.000",
  );
  const cardSalesTotal = cardPayments.reduce(
    (s, p) => addMoney(s, String(p.amount)),
    "0.000",
  );
  // Sum tips from sales whose payments hit this session (de-dup by sale).
  const seenSales = new Set<string>();
  let tipsTotal = "0.000";
  const tipsPayments = await prisma.payment.findMany({
    where: { cashDrawerSessionId: sessionId },
    select: { saleId: true, sale: { select: { tipTotal: true } } },
  });
  for (const p of tipsPayments) {
    if (!p.saleId || seenSales.has(p.saleId)) continue;
    seenSales.add(p.saleId);
    const t = p.sale?.tipTotal ? String(p.sale.tipTotal) : "0.000";
    if (Number(t) > 0) tipsTotal = addMoney(tipsTotal, t);
  }
  // Drawer expenses for this session.
  const expensesAgg = await (prisma as never as {
    cashDrawerExpense: {
      aggregate: (a: unknown) => Promise<{ _sum: { amount: { toString: () => string } | null } }>;
    };
  }).cashDrawerExpense.aggregate({
    where: { cashDrawerSessionId: sessionId },
    _sum: { amount: true },
  });
  const expensesTotal = expensesAgg._sum.amount ? String(expensesAgg._sum.amount) : "0.000";

  // Cash refunds issued anywhere in the salon during the session window.
  // Sessions are shared across employees, so we attribute every cash refund
  // for the salon to the open session.
  const refundFilter = {
    refundMethod: "CASH" as const,
    sale: { providerId: session.providerId },
    createdAt: {
      gte: session.openedAt,
      ...(session.closedAt ? { lte: session.closedAt } : {}),
    },
  };
  const refunds = await prisma.refund.findMany({
    where: refundFilter,
    select: { totalAmount: true },
  });
  const cashRefundsTotal = refunds.reduce(
    (s, r) => addMoney(s, String(r.totalAmount)),
    "0.000",
  );

  const expectedCash = subMoney(
    subMoney(addMoney(String(session.openingFloat), cashSalesTotal), cashRefundsTotal),
    expensesTotal,
  );

  return {
    sessionId: session.id,
    openedAt: session.openedAt,
    closedAt: session.closedAt,
    openingFloat: String(session.openingFloat),
    cashSalesCount: cashPayments.length,
    cashSalesTotal,
    cardSalesCount: cardPayments.length,
    cardSalesTotal,
    tipsTotal,
    expensesTotal,
    cashRefundsCount: refunds.length,
    cashRefundsTotal,
    expectedCash,
    closingCount: session.closingCount === null ? null : String(session.closingCount),
    variance: session.variance === null ? null : String(session.variance),
  };
}

/**
 * Find the currently-open session for the whole salon (or null).
 *
 * A salon has at most one OPEN cash drawer session at a time, shared across
 * every employee. Whoever opens first holds it; any employee can see it,
 * encaisser on it, and close it.
 */
export async function findOpenSession(providerId: string) {
  return prisma.cashDrawerSession.findFirst({
    where: { providerId, status: "OPEN" },
    orderBy: { openedAt: "desc" },
    include: { employee: { select: { displayName: true } } },
  });
}
