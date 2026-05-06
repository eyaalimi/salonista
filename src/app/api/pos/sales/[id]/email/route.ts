import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee, toResponse } from "@/lib/employee-session";
import { sendReceiptEmail } from "@/lib/mail";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let employee;
  try {
    employee = await requireEmployee();
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => null)) as { email?: string } | null;
  const sale = await prisma.sale.findUnique({
    where: { id },
    select: { id: true, providerId: true, customerId: true },
  });
  if (!sale || sale.providerId !== employee.providerId) {
    return Response.json({ error: "Vente introuvable" }, { status: 404 });
  }

  let recipient = body?.email ?? null;
  if (!recipient && sale.customerId) {
    const cust = await prisma.customer.findUnique({
      where: { id: sale.customerId },
      select: { email: true },
    });
    recipient = cust?.email ?? null;
  }
  if (!recipient) {
    return Response.json({ error: "Aucune adresse email" }, { status: 400 });
  }

  try {
    await sendReceiptEmail(sale.id, recipient);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Erreur d'envoi" },
      { status: 500 },
    );
  }
}
