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
  const params = req.nextUrl.searchParams;
  const { from, to } = parseRange(params);
  const limit = Math.min(50, Math.max(1, Number(params.get("limit") ?? 10)));

  const items = await prisma.saleItem.findMany({
    where: {
      kind: "PRODUCT",
      sale: {
        providerId: employee.providerId,
        status: { in: PAID_STATUSES as unknown as ("PAID" | "PARTIALLY_REFUNDED" | "REFUNDED")[] },
        closedAt: { gte: from, lte: to },
      },
    },
    select: { productId: true, nameSnapshot: true, quantity: true, lineTotal: true },
  });

  const agg = new Map<
    string,
    { productId: string | null; name: string; quantity: number; revenueM: number }
  >();
  for (const it of items) {
    const key = it.productId ?? `__deleted_${it.nameSnapshot}`;
    const entry = agg.get(key) ?? {
      productId: it.productId,
      name: it.nameSnapshot,
      quantity: 0,
      revenueM: 0,
    };
    entry.quantity += it.quantity;
    entry.revenueM += Math.round(Number(it.lineTotal) * 1000);
    agg.set(key, entry);
  }

  const top = Array.from(agg.values())
    .sort((a, b) => b.revenueM - a.revenueM)
    .slice(0, limit)
    .map((e) => ({
      productId: e.productId,
      name: e.name,
      quantity: e.quantity,
      revenue: (e.revenueM / 1000).toFixed(3),
    }));

  return Response.json({ top });
}
