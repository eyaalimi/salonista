import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, toResponse } from "@/lib/employee-session";
import { parseRange } from "@/lib/analytics-range";

// TODO: if query latency >500ms in production, materialize a daily aggregates table.

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
  const params = req.nextUrl.searchParams;
  const { from, to } = parseRange(params);
  const granularity = params.get("granularity") === "hour" ? "hour" : "day";

  const sales = await prisma.sale.findMany({
    where: {
      providerId: employee.providerId,
      status: { in: PAID_STATUSES as unknown as ("PAID" | "PARTIALLY_REFUNDED" | "REFUNDED")[] },
      closedAt: { gte: from, lte: to },
    },
    select: { total: true, closedAt: true },
  });

  const buckets = new Map<string, { revenueM: number; count: number }>();
  function bucketKey(d: Date): string {
    if (granularity === "hour") {
      const dt = new Date(d);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}T${String(dt.getHours()).padStart(2, "0")}`;
    }
    const dt = new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  }

  for (const s of sales) {
    if (!s.closedAt) continue;
    const k = bucketKey(s.closedAt);
    const entry = buckets.get(k) ?? { revenueM: 0, count: 0 };
    entry.revenueM += Math.round(Number(s.total) * 1000);
    entry.count += 1;
    buckets.set(k, entry);
  }

  const points = Array.from(buckets.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, { revenueM, count }]) => ({
      key,
      revenue: (revenueM / 1000).toFixed(3),
      transactions: count,
    }));

  return Response.json({ granularity, points });
}
