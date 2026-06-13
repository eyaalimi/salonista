import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, toResponse } from "@/lib/employee-session";
import type { StockMovementReason } from "@/generated/prisma/enums";

const ALLOWED_REASONS: StockMovementReason[] = [
  "PURCHASE",
  "ADJUSTMENT",
  "RETURN",
  "LOSS",
];

type Body = {
  delta?: number;
  reason?: StockMovementReason;
  note?: string | null;
  unitCost?: number | string | null;
  updateCostPrice?: boolean;
};

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let employee;
  try {
    employee = await requirePermission("inventory.edit");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  const { id } = await ctx.params;
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product || product.providerId !== employee.providerId) {
    return Response.json({ error: "Produit introuvable" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || typeof body.delta !== "number" || !body.reason) {
    return Response.json({ error: "delta et raison requis" }, { status: 400 });
  }
  if (!Number.isInteger(body.delta)) {
    return Response.json({ error: "delta doit être un entier" }, { status: 400 });
  }
  if (!ALLOWED_REASONS.includes(body.reason)) {
    return Response.json({ error: "Raison invalide" }, { status: 400 });
  }
  if (body.unitCost !== undefined && body.unitCost !== null) {
    const parsed = Number(body.unitCost);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return Response.json({ error: "Prix d'achat invalide" }, { status: 400 });
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const newStock = product.stockQuantity + body.delta!;
    const unitCost =
      body.reason === "PURCHASE" && body.unitCost !== undefined && body.unitCost !== null
        ? Number(body.unitCost).toFixed(3)
        : null;

    const movement = await tx.stockMovement.create({
      data: {
        productId: product.id,
        delta: body.delta!,
        reason: body.reason!,
        employeeId: employee.id,
        note: body.note ?? null,
        requiresReview: newStock < 0,
        unitCost,
      } as never,
    });

    const productUpdateData: Record<string, unknown> = { stockQuantity: newStock };
    if (body.updateCostPrice && body.reason === "PURCHASE" && unitCost) {
      productUpdateData.costPrice = unitCost;
    }
    const next = await tx.product.update({
      where: { id: product.id },
      data: productUpdateData as never,
    });
    return { product: next, movement };
  });

  return Response.json(updated);
}
