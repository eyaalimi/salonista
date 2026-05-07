import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, toResponse } from "@/lib/employee-session";
import { addMoney, subMoney } from "@/lib/money";
import { parseRange, previousRange } from "@/lib/analytics-range";

const PAID_STATUSES = ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] as const;

async function summarize(providerId: string, from: Date, to: Date) {
  const sales = await prisma.sale.findMany({
    where: {
      providerId,
      status: { in: PAID_STATUSES as unknown as ("PAID" | "PARTIALLY_REFUNDED" | "REFUNDED")[] },
      closedAt: { gte: from, lte: to },
    },
    select: { id: true, total: true },
  });
  const refunds = await prisma.refund.findMany({
    where: {
      sale: { providerId },
      createdAt: { gte: from, lte: to },
    },
    select: { totalAmount: true },
  });
  const grossRevenue = sales.reduce((s, r) => addMoney(s, String(r.total)), "0.000");
  const refundTotal = refunds.reduce((s, r) => addMoney(s, String(r.totalAmount)), "0.000");
  const netRevenue = subMoney(grossRevenue, refundTotal);
  const newCustomers = await prisma.customer.count({
    where: { firstSalonId: providerId, createdAt: { gte: from, lte: to } },
  });
  return {
    netRevenue,
    paidCount: sales.length,
    refundTotal,
    newCustomers,
  };
}

export async function GET(req: NextRequest) {
  let employee;
  try {
    employee = await requirePermission("analytics.view");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  const { from, to } = parseRange(req.nextUrl.searchParams);
  const { prevFrom, prevTo } = previousRange(from, to);

  const [current, previous] = await Promise.all([
    summarize(employee.providerId, from, to),
    summarize(employee.providerId, prevFrom, prevTo),
  ]);

  // averageTicket = netRevenue / paidCount (current period only, no delta dependency).
  const avgTicket =
    current.paidCount > 0
      ? (Number(current.netRevenue) / current.paidCount).toFixed(3)
      : null;

  return Response.json({
    range: { from, to },
    current: { ...current, avgTicket },
    previous,
  });
}
