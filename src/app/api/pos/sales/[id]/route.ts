import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee, toResponse } from "@/lib/employee-session";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let employee;
  try {
    employee = await requireEmployee();
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  const { id } = await ctx.params;
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      items: { include: { assignedEmployee: { select: { id: true, displayName: true } } } },
      payments: true,
      tipAllocations: { include: { employee: { select: { id: true, displayName: true } } } },
      refunds: { include: { items: true, employee: { select: { displayName: true } } } },
      customer: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
      employee: { select: { id: true, displayName: true } },
      provider: {
        select: {
          salonName: true,
          address: true,
          city: true,
          phone: true,
          matriculeFiscal: true,
          receiptFooter: true,
        },
      },
    },
  });
  if (!sale || sale.providerId !== employee.providerId) {
    return Response.json({ error: "Vente introuvable" }, { status: 404 });
  }
  return Response.json(sale);
}
