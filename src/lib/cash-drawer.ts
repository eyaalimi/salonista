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

  // Cash refunds issued by the employee during the session window.
  const refundFilter = {
    refundMethod: "CASH" as const,
    employeeId: session.employeeId,
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

/** Find the currently-open session for an employee (or null). */
export async function findOpenSession(employeeId: string) {
  return prisma.cashDrawerSession.findFirst({
    where: { employeeId, status: "OPEN" },
    include: { employee: { select: { displayName: true } } },
  });
}
