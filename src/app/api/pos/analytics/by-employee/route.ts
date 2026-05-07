import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, toResponse } from "@/lib/employee-session";
import { parseRange } from "@/lib/analytics-range";

const PAID_STATUSES = ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] as const;

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

  const sales = await prisma.sale.findMany({
    where: {
      providerId: employee.providerId,
      status: { in: PAID_STATUSES as unknown as ("PAID" | "PARTIALLY_REFUNDED" | "REFUNDED")[] },
      closedAt: { gte: from, lte: to },
    },
    select: { employeeId: true, total: true, employee: { select: { displayName: true } } },
  });

  const tips = await prisma.tipAllocation.findMany({
    where: {
      sale: {
        providerId: employee.providerId,
        closedAt: { gte: from, lte: to },
      },
    },
    select: { employeeId: true, amount: true },
  });

  const items = await prisma.saleItem.findMany({
    where: {
      sale: {
        providerId: employee.providerId,
        status: { in: PAID_STATUSES as unknown as ("PAID" | "PARTIALLY_REFUNDED" | "REFUNDED")[] },
        closedAt: { gte: from, lte: to },
      },
    },
    select: { assignedEmployeeId: true, quantity: true },
  });

  const agg = new Map<
    string,
    { name: string; sales: number; revenueM: number; tipsM: number; itemsCount: number }
  >();
  for (const s of sales) {
    const entry = agg.get(s.employeeId) ?? {
      name: s.employee.displayName,
      sales: 0,
      revenueM: 0,
      tipsM: 0,
      itemsCount: 0,
    };
    entry.sales += 1;
    entry.revenueM += Math.round(Number(s.total) * 1000);
    agg.set(s.employeeId, entry);
  }
  for (const t of tips) {
    const entry = agg.get(t.employeeId);
    if (!entry) continue;
    entry.tipsM += Math.round(Number(t.amount) * 1000);
  }
  for (const it of items) {
    if (!it.assignedEmployeeId) continue;
    const entry = agg.get(it.assignedEmployeeId);
    if (!entry) continue;
    entry.itemsCount += it.quantity;
  }

  const rows = Array.from(agg.entries())
    .sort((a, b) => b[1].revenueM - a[1].revenueM)
    .map(([id, e]) => ({
      employeeId: id,
      name: e.name,
      sales: e.sales,
      revenue: (e.revenueM / 1000).toFixed(3),
      tips: (e.tipsM / 1000).toFixed(3),
      itemsCount: e.itemsCount,
    }));

  return Response.json({ rows });
}
