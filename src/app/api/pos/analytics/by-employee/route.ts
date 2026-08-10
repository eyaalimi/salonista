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

  const items = (await (prisma as never as {
    saleItem: {
      findMany: (a: unknown) => Promise<Array<{
        assignedEmployeeId: string | null;
        quantity: number;
        commissionAmount: unknown | null;
        commissionPaid: boolean;
      }>>;
    };
  }).saleItem.findMany({
    where: {
      sale: {
        providerId: employee.providerId,
        status: { in: PAID_STATUSES as unknown as ("PAID" | "PARTIALLY_REFUNDED" | "REFUNDED")[] },
        closedAt: { gte: from, lte: to },
      },
    },
    select: {
      assignedEmployeeId: true,
      quantity: true,
      commissionAmount: true,
      commissionPaid: true,
    },
  })) as Array<{
    assignedEmployeeId: string | null;
    quantity: number;
    commissionAmount: unknown | null;
    commissionPaid: boolean;
  }>;

  const agg = new Map<
    string,
    {
      name: string;
      sales: number;
      revenueM: number;
      tipsM: number;
      itemsCount: number;
      commissionPendingM: number;
      commissionPaidM: number;
    }
  >();
  // Also fetch every stylist/cashier so that even employees who have made no
  // sales in the range but have unpaid commissions from before show up.
  const employeesWithCommission = (await (prisma as never as {
    salonEmployee: {
      findMany: (a: unknown) => Promise<Array<{ id: string; displayName: string }>>;
    };
  }).salonEmployee.findMany({
    where: {
      providerId: employee.providerId,
      active: true,
      commissionRate: { not: null },
    },
    select: { id: true, displayName: true },
  })) as Array<{ id: string; displayName: string }>;
  for (const emp of employeesWithCommission) {
    if (!agg.has(emp.id)) {
      agg.set(emp.id, {
        name: emp.displayName,
        sales: 0,
        revenueM: 0,
        tipsM: 0,
        itemsCount: 0,
        commissionPendingM: 0,
        commissionPaidM: 0,
      });
    }
  }

  for (const s of sales) {
    const entry = agg.get(s.employeeId) ?? {
      name: s.employee.displayName,
      sales: 0,
      revenueM: 0,
      tipsM: 0,
      itemsCount: 0,
      commissionPendingM: 0,
      commissionPaidM: 0,
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
    if (it.commissionAmount !== null && it.commissionAmount !== undefined) {
      const m = Math.round(Number(String(it.commissionAmount)) * 1000);
      if (it.commissionPaid) entry.commissionPaidM += m;
      else entry.commissionPendingM += m;
    }
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
      commissionPending: (e.commissionPendingM / 1000).toFixed(3),
      commissionPaid: (e.commissionPaidM / 1000).toFixed(3),
    }));

  return Response.json({ rows });
}
