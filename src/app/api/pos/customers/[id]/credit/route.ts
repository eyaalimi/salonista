import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, toResponse } from "@/lib/employee-session";
import { fromMillimes, toMillimes } from "@/lib/money";

/**
 * GET /api/pos/customers/[id]/credit → { totalDu, depuis }
 *
 * Ce que la cliente doit deja AU SALON COURANT — pour la pastille de la
 * modale d'encaissement et le badge du panneau cliente. Borne au salon par
 * `providerId` : ce qu'elle doit chez le voisin ne regarde personne ici.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let employee;
  try {
    employee = await requirePermission("customers.view");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  const { id } = await ctx.params;

  const ventes = await prisma.sale.findMany({
    where: {
      providerId: employee.providerId,
      customerId: id,
      status: "CREDIT",
      amountDue: { gt: 0 },
    },
    select: { amountDue: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const totalM = ventes.reduce((s, v) => s + toMillimes(v.amountDue), 0);
  return Response.json({
    totalDu: fromMillimes(totalM),
    depuis: ventes[0]?.createdAt.toISOString() ?? null,
  });
}
