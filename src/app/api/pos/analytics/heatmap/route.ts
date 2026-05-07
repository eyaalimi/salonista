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
    select: { closedAt: true, total: true },
  });

  // 7×24 grid: rows = day of week (0=Sun..6=Sat — French locale uses Mon=0,
  // we re-map to make it familiar in the UI). Cells: { count, revenue }.
  const grid: Array<Array<{ count: number; revenueM: number }>> = Array.from(
    { length: 7 },
    () => Array.from({ length: 24 }, () => ({ count: 0, revenueM: 0 })),
  );
  // 0 = Lundi, 6 = Dimanche.
  function frenchDow(d: Date): number {
    const js = d.getDay(); // 0=Sun..6=Sat
    return js === 0 ? 6 : js - 1;
  }
  for (const s of sales) {
    if (!s.closedAt) continue;
    const dow = frenchDow(s.closedAt);
    const hour = s.closedAt.getHours();
    grid[dow][hour].count += 1;
    grid[dow][hour].revenueM += Math.round(Number(s.total) * 1000);
  }

  const cells = grid.map((row, dow) =>
    row.map((cell, hour) => ({
      dow,
      hour,
      count: cell.count,
      revenue: (cell.revenueM / 1000).toFixed(3),
    })),
  );

  return Response.json({ cells });
}
