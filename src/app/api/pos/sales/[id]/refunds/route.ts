import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/modules";
import { requirePermission, toResponse } from "@/lib/employee-session";
import { addMoney, toMillimes } from "@/lib/money";
import type { PaymentMethod, RefundReason } from "@/generated/prisma/enums";

type RefundLineInput = {
  saleItemId: string;
  quantity: number;
  restock?: boolean;
};

type Body = {
  reason: RefundReason;
  notes?: string | null;
  refundMethod: PaymentMethod;
  reference?: string | null;
  items: RefundLineInput[];
};

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let employee;
  try {
    employee = await requirePermission("pos.refund");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  try {
    await requireModule(employee.providerId, "POS");
  } catch {
    return Response.json({ error: "Module POS non activé" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || !body.reason || !body.refundMethod || !Array.isArray(body.items)) {
    return Response.json({ error: "Corps invalide" }, { status: 400 });
  }
  if (body.items.length === 0) {
    return Response.json({ error: "Aucun article à rembourser" }, { status: 400 });
  }

  const sale = await prisma.sale.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!sale || sale.providerId !== employee.providerId) {
    return Response.json({ error: "Vente introuvable" }, { status: 404 });
  }
  if (sale.status === "REFUNDED" || sale.status === "VOIDED") {
    return Response.json(
      { error: "Vente déjà entièrement remboursée ou annulée" },
      { status: 409 },
    );
  }

  // Validate refund items don't exceed remaining quantity, compute amount per line.
  const lineMap = new Map(sale.items.map((it) => [it.id, it]));
  let refundAmountStr = "0.000";
  const refundLines: Array<{
    saleItemId: string;
    productId: string | null;
    quantity: number;
    amountRefunded: string;
    restock: boolean;
  }> = [];

  for (const ri of body.items) {
    const item = lineMap.get(ri.saleItemId);
    if (!item) {
      return Response.json({ error: `Ligne inconnue: ${ri.saleItemId}` }, { status: 400 });
    }
    const remaining = item.quantity - item.refundedQuantity;
    if (ri.quantity <= 0 || ri.quantity > remaining) {
      return Response.json(
        { error: `Quantité invalide pour la ligne ${item.nameSnapshot}` },
        { status: 400 },
      );
    }
    // Per-unit amount = (lineTotal / quantity) — preserves the discount split.
    const unitAmountM = Math.round(toMillimes(String(item.lineTotal)) / item.quantity);
    const lineRefundM = unitAmountM * ri.quantity;
    const lineRefundStr = (lineRefundM / 1000).toFixed(3);
    refundAmountStr = addMoney(refundAmountStr, lineRefundStr);
    refundLines.push({
      saleItemId: item.id,
      productId: item.productId,
      quantity: ri.quantity,
      amountRefunded: lineRefundStr,
      restock: ri.restock !== false,
    });
  }

  const result = await prisma.$transaction(async (tx) => {
    const refund = await tx.refund.create({
      data: {
        saleId: sale.id,
        employeeId: employee.id,
        reason: body.reason,
        notes: body.notes ?? null,
        totalAmount: refundAmountStr,
        refundMethod: body.refundMethod,
        reference: body.reference ?? null,
        items: {
          create: refundLines.map((rl) => ({
            saleItemId: rl.saleItemId,
            productId: rl.productId,
            quantity: rl.quantity,
            amountRefunded: rl.amountRefunded,
            restock: rl.restock,
          })),
        },
      },
    });

    // Increment refundedQuantity on each line.
    for (const rl of refundLines) {
      await tx.saleItem.update({
        where: { id: rl.saleItemId },
        data: { refundedQuantity: { increment: rl.quantity } },
      });
    }

    // Restock products marked restock=true.
    for (const rl of refundLines) {
      if (!rl.productId || !rl.restock) continue;
      await tx.product.update({
        where: { id: rl.productId },
        data: { stockQuantity: { increment: rl.quantity } },
      });
      await tx.stockMovement.create({
        data: {
          productId: rl.productId,
          delta: rl.quantity,
          reason: "RETURN",
          refundId: refund.id,
          employeeId: employee.id,
          note: `Remboursement vente ${sale.receiptNumber}`,
        },
      });
    }

    // Update parent sale totals + status.
    const newRefundedTotal = addMoney(String(sale.refundedTotal), refundAmountStr);
    const allLines = await tx.saleItem.findMany({ where: { saleId: sale.id } });
    const fullyRefunded = allLines.every((l) => l.refundedQuantity >= l.quantity);
    await tx.sale.update({
      where: { id: sale.id },
      data: {
        refundedTotal: newRefundedTotal,
        status: fullyRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED",
      },
    });

    return refund;
  });

  return Response.json(result, { status: 201 });
}
