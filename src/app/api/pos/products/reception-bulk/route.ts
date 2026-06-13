import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, toResponse } from "@/lib/employee-session";

type Item = {
  productId: string;
  quantity: number;
  unitCost?: number | string | null;
  updateCostPrice?: boolean;
};

export async function POST(req: NextRequest) {
  let employee;
  try {
    employee = await requirePermission("products.manage");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }

  const body = (await req.json().catch(() => null)) as { items?: Item[] } | null;
  const items = body?.items ?? [];
  if (items.length === 0) return Response.json({ error: "Aucun item" }, { status: 400 });

  for (const it of items) {
    if (!it.productId || !Number.isFinite(it.quantity) || it.quantity <= 0) {
      return Response.json({ error: "Item invalide" }, { status: 400 });
    }
    if (it.unitCost !== undefined && it.unitCost !== null) {
      const parsed = Number(it.unitCost);
      if (!Number.isFinite(parsed) || parsed < 0) {
        return Response.json({ error: "Prix d'achat invalide" }, { status: 400 });
      }
    }
  }

  try {
    const results = await prisma.$transaction(async (tx) => {
      const out: Array<{ product: unknown; movement: unknown }> = [];
      for (const it of items) {
        const product = await tx.product.findUnique({ where: { id: it.productId } });
        if (!product || product.providerId !== employee.providerId) {
          throw new Error("FORBIDDEN_OR_NOT_FOUND");
        }
        const unitCost =
          it.unitCost !== undefined && it.unitCost !== null
            ? Number(it.unitCost).toFixed(3)
            : null;
        const newStock = product.stockQuantity + it.quantity;
        const movement = await tx.stockMovement.create({
          data: {
            productId: product.id,
            delta: it.quantity,
            reason: "PURCHASE",
            employeeId: employee.id,
            unitCost,
          } as never,
        });
        const updateData: Record<string, unknown> = { stockQuantity: newStock };
        if (it.updateCostPrice && unitCost) {
          updateData.costPrice = unitCost;
        }
        const updated = await tx.product.update({
          where: { id: product.id },
          data: updateData as never,
        });
        out.push({ product: updated, movement });
      }
      return out;
    });
    return Response.json({ items: results });
  } catch (err) {
    if (err instanceof Error && err.message === "FORBIDDEN_OR_NOT_FOUND") {
      return Response.json({ error: "Produit introuvable" }, { status: 404 });
    }
    throw err;
  }
}
