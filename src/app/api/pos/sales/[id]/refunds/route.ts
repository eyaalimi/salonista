import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/modules";
import { requirePermission, toResponse } from "@/lib/employee-session";
import { addMoney, fromMillimes, toMillimes } from "@/lib/money";
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

  // Existence + ownership check outside the transaction (cheap, no row lock
  // needed yet). Quantity validation is repeated *inside* the transaction
  // to defend against concurrent refunds racing on the same sale.
  const saleHead = await prisma.sale.findUnique({
    where: { id },
    select: { id: true, providerId: true, status: true, receiptNumber: true },
  });
  if (!saleHead || saleHead.providerId !== employee.providerId) {
    return Response.json({ error: "Vente introuvable" }, { status: 404 });
  }
  if (saleHead.status === "REFUNDED" || saleHead.status === "VOIDED") {
    return Response.json(
      { error: "Vente déjà entièrement remboursée ou annulée" },
      { status: 409 },
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Re-read sale + items inside the tx for fresh quantities under
      // serializable isolation.
      const sale = await tx.sale.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!sale) throw new Error("Vente introuvable");
      if (sale.status === "REFUNDED" || sale.status === "VOIDED") {
        throw new Error("ALREADY_FULLY_REFUNDED");
      }

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
        if (!item) throw new Error(`Ligne inconnue: ${ri.saleItemId}`);
        const remaining = item.quantity - item.refundedQuantity;
        if (ri.quantity <= 0 || ri.quantity > remaining) {
          throw new Error(`Quantité invalide pour la ligne ${item.nameSnapshot}`);
        }
        // Per-unit amount preserves any discount split. Use integer-millime
        // math throughout so we never round inconsistently with what the
        // sale originally stored.
        const unitAmountM = Math.round(toMillimes(String(item.lineTotal)) / item.quantity);
        const lineRefundStr = fromMillimes(unitAmountM * ri.quantity);
        refundAmountStr = addMoney(refundAmountStr, lineRefundStr);
        refundLines.push({
          saleItemId: item.id,
          productId: item.productId,
          quantity: ri.quantity,
          amountRefunded: lineRefundStr,
          restock: ri.restock !== false,
        });
      }

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

      for (const rl of refundLines) {
        await tx.saleItem.update({
          where: { id: rl.saleItemId },
          data: { refundedQuantity: { increment: rl.quantity } },
        });
      }

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

      // Determine post-refund state from values we just incremented in this
      // transaction (already present in `refundLines`), no extra round-trip.
      const fullyRefunded = sale.items.every((l) => {
        const refundedHere = refundLines
          .filter((rl) => rl.saleItemId === l.id)
          .reduce((s, r) => s + r.quantity, 0);
        return l.refundedQuantity + refundedHere >= l.quantity;
      });

      const newRefundedTotal = addMoney(String(sale.refundedTotal), refundAmountStr);
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur";
    const status = msg === "ALREADY_FULLY_REFUNDED" ? 409 : 400;
    return Response.json({ error: msg }, { status });
  }
}
