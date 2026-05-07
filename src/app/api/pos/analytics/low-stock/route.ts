import { prisma } from "@/lib/prisma";
import { requirePermission, toResponse } from "@/lib/employee-session";

export async function GET() {
  let employee;
  try {
    employee = await requirePermission("analytics.view");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }

  // Filter at the application level (Prisma can't compare two columns directly
  // without a raw query in the where clause).
  const products = await prisma.product.findMany({
    where: { providerId: employee.providerId, active: true },
    orderBy: { name: "asc" },
  });
  const low = products.filter((p) => p.stockQuantity <= p.lowStockThreshold);

  // Last sold date per product.
  const lastSold = await prisma.saleItem.groupBy({
    by: ["productId"],
    where: { productId: { in: low.map((p) => p.id) } },
    _max: { createdAt: true },
  });
  const lastSoldMap = new Map(lastSold.map((r) => [r.productId, r._max.createdAt]));

  return Response.json({
    products: low.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      stockQuantity: p.stockQuantity,
      lowStockThreshold: p.lowStockThreshold,
      photo: p.photo,
      lastSoldAt: lastSoldMap.get(p.id) ?? null,
    })),
  });
}
