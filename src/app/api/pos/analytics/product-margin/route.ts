import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, toResponse } from "@/lib/employee-session";

export async function GET(req: NextRequest) {
  let employee;
  try {
    employee = await requirePermission("analytics.view");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const closedAtFilter: Record<string, unknown> = {};
  if (from) closedAtFilter.gte = new Date(from);
  if (to) closedAtFilter.lte = new Date(to);

  const items = await prisma.saleItem.findMany({
    where: {
      sale: {
        providerId: employee.providerId,
        status: "PAID",
        ...(from || to ? { closedAt: closedAtFilter } : {}),
      },
      kind: "PRODUCT",
    },
    select: {
      quantity: true,
      priceSnapshot: true,
      product: { select: { costPrice: true } as never } as never,
    } as never,
  });

  let total = 0;
  let excluded = 0;
  for (const it of items as Array<{
    quantity: number;
    priceSnapshot: string;
    product: { costPrice: string | null } | null;
  }>) {
    const cost = it.product?.costPrice ? Number(it.product.costPrice) : null;
    if (cost === null) {
      excluded++;
      continue;
    }
    total += (Number(it.priceSnapshot) - cost) * it.quantity;
  }

  return Response.json({ total: total.toFixed(3), excludedCount: excluded });
}
