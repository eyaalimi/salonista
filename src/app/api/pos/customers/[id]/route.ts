import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, toResponse } from "@/lib/employee-session";

/**
 * GET — customer detail + sales history for the current provider.
 * Only returns the customer if they belong to this salon (firstSalonId).
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  let employee;
  try {
    employee = await requirePermission("customers.view");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  const { id } = await ctx.params;
  const providerId = employee.providerId;

  const customer = (await (prisma as never as {
    customer: { findFirst: (args: unknown) => Promise<unknown> };
  }).customer.findFirst({
    where: { id, firstSalonId: providerId },
    select: {
      id: true,
      phone: true,
      firstName: true,
      lastName: true,
      email: true,
      birthday: true,
      notes: true,
      createdAt: true,
    },
  })) as {
    id: string;
    phone: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    birthday: Date | null;
    notes: string | null;
    createdAt: Date;
  } | null;

  if (!customer) {
    return Response.json({ error: "Cliente introuvable" }, { status: 404 });
  }

  const sales = (await (prisma as never as {
    sale: { findMany: (args: unknown) => Promise<unknown[]> };
  }).sale.findMany({
    where: {
      providerId,
      customerId: id,
      status: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] },
    },
    orderBy: { closedAt: "desc" },
    take: 100,
    select: {
      id: true,
      receiptNumber: true,
      total: true,
      status: true,
      closedAt: true,
      items: {
        select: {
          nameSnapshot: true,
          quantity: true,
        },
      },
    },
  })) as Array<{
    id: string;
    receiptNumber: string;
    total: unknown;
    status: string;
    closedAt: Date | null;
    items: Array<{ nameSnapshot: string; quantity: number }>;
  }>;

  const totalSpent = sales.reduce(
    (sum, s) => sum + Number(String(s.total)),
    0,
  );

  return Response.json({
    customer: {
      id: customer.id,
      phone: customer.phone.startsWith("walk-in-") ? null : customer.phone,
      isWalkIn: customer.phone.startsWith("walk-in-"),
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      birthday: customer.birthday,
      notes: customer.notes,
      createdAt: customer.createdAt,
    },
    stats: {
      totalVisits: sales.length,
      totalSpent: totalSpent.toFixed(3),
    },
    sales: sales.map((s) => ({
      id: s.id,
      receiptNumber: s.receiptNumber,
      total: String(s.total),
      status: s.status,
      closedAt: s.closedAt,
      items: s.items,
    })),
  });
}

/**
 * DELETE — soft check then hard delete.
 * Blocks deletion if the customer has any sale linked here (preserve history).
 */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  let employee;
  try {
    employee = await requirePermission("customers.edit");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  const { id } = await ctx.params;
  const providerId = employee.providerId;

  const customer = (await (prisma as never as {
    customer: { findFirst: (args: unknown) => Promise<{ id: string } | null> };
  }).customer.findFirst({
    where: { id, firstSalonId: providerId },
    select: { id: true },
  })) as { id: string } | null;
  if (!customer) {
    return Response.json({ error: "Cliente introuvable" }, { status: 404 });
  }

  const linkedSale = (await (prisma as never as {
    sale: { findFirst: (args: unknown) => Promise<{ id: string } | null> };
  }).sale.findFirst({
    where: { customerId: id, providerId },
    select: { id: true },
  })) as { id: string } | null;
  if (linkedSale) {
    return Response.json(
      {
        error:
          "Impossible de supprimer une cliente avec un historique de ventes. Utilisez la modification pour anonymiser à la place.",
      },
      { status: 409 },
    );
  }

  await (prisma as never as {
    customer: { delete: (args: unknown) => Promise<unknown> };
  }).customer.delete({ where: { id } });

  return Response.json({ ok: true });
}
