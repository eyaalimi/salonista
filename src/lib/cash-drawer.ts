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

  // Cash payments tied to this session.
  const cashPayments = await prisma.payment.findMany({
    where: { cashDrawerSessionId: sessionId, method: "CASH" },
    select: { amount: true },
  });
  const cashSalesTotal = cashPayments.reduce(
    (s, p) => addMoney(s, String(p.amount)),
    "0.000",
  );

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
    addMoney(String(session.openingFloat), cashSalesTotal),
    cashRefundsTotal,
  );

  return {
    sessionId: session.id,
    openedAt: session.openedAt,
    closedAt: session.closedAt,
    openingFloat: String(session.openingFloat),
    cashSalesCount: cashPayments.length,
    cashSalesTotal,
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
  });
}
