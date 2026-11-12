import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, toResponse } from "@/lib/employee-session";

/**
 * POST — arrete une campagne. Les destinataires pas encore servis passent
 * NON_ENVOYE. Les messages DEJA partis ne peuvent pas etre rappeles :
 * WhatsApp ne le permet pas, l'interface le dit.
 *
 * Un message en cours d'envoi au moment de l'arret peut encore partir (le
 * moteur verifie l'etat de la campagne avant CHAQUE envoi, pas pendant) : il
 * sera alors compte comme envoye.
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let employee;
  try {
    employee = await requirePermission("promos.send");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  const { id } = await ctx.params;

  const resultat = await prisma.$transaction(async (tx) => {
    const arretee = await tx.campagnePromo.updateMany({
      where: { id, providerId: employee.providerId, statut: { in: ["PROGRAMMEE", "EN_COURS"] } },
      data: { statut: "ARRETEE", termineeLe: new Date() },
    });
    if (arretee.count === 0) return null;
    const r = await tx.destinatairePromo.updateMany({
      where: { campagneId: id, statut: { in: ["EN_ATTENTE", "RESERVE"] } },
      data: { statut: "NON_ENVOYE", reserveLe: null },
    });
    return { nonEnvoyes: r.count };
  });

  if (!resultat) {
    return Response.json({ error: "Cette promo est déjà terminée ou introuvable." }, { status: 409 });
  }
  return Response.json(resultat);
}
