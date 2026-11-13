import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, toResponse } from "@/lib/employee-session";

/**
 * File d'envoi d'une campagne par liens wa.me.
 *
 * GET  — l'offre et les clientes qui restent, dans l'ordre.
 * POST { destinataireId, action: "envoye" | "passe" } — la gerante a ouvert
 *       WhatsApp pour cette cliente (« envoye »), ou l'a sautee (« passe »).
 *
 * « Envoye » veut dire « WhatsApp a ete OUVERT avec le message pret » : on ne
 * peut pas savoir si elle a vraiment appuye sur Envoyer dans WhatsApp. C'est
 * la meme limite que le message de fidelite.
 */

async function campagneDuSalon(id: string, providerId: string) {
  return prisma.campagnePromo.findFirst({
    where: { id, providerId, canal: "LIEN" },
    select: { id: true, texteOffre: true, messageLien: true, statut: true, nbDestinataires: true },
  });
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let employee;
  try {
    employee = await requirePermission("customers.view");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  if (!employee.permissions["promos.send"]) {
    return Response.json({ error: "Permission insuffisante" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const campagne = await campagneDuSalon(id, employee.providerId);
  if (!campagne) return Response.json({ error: "Promo introuvable" }, { status: 404 });

  const [restants, envoyes] = await Promise.all([
    prisma.destinatairePromo.findMany({
      where: { campagneId: id, statut: "EN_ATTENTE" },
      orderBy: [{ prenom: "asc" }, { id: "asc" }],
      select: { id: true, prenom: true, telephone: true, customer: { select: { lastName: true } } },
    }),
    prisma.destinatairePromo.count({ where: { campagneId: id, statut: "ENVOYE" } }),
  ]);

  return Response.json({
    campagne,
    envoyes,
    restants: restants.map((d) => ({
      id: d.id,
      prenom: d.prenom,
      nom: d.customer?.lastName ?? null,
      telephone: d.telephone,
    })),
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let employee;
  try {
    employee = await requirePermission("promos.send");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  const { id } = await ctx.params;
  const corps = (await req.json().catch(() => null)) as { destinataireId?: unknown; action?: unknown } | null;
  if (!corps || typeof corps.destinataireId !== "string" || (corps.action !== "envoye" && corps.action !== "passe")) {
    return Response.json({ error: "Corps invalide" }, { status: 400 });
  }

  const campagne = await campagneDuSalon(id, employee.providerId);
  if (!campagne) return Response.json({ error: "Promo introuvable" }, { status: 404 });
  if (campagne.statut !== "EN_COURS") {
    return Response.json({ error: "Cette promo est terminée ou arrêtée." }, { status: 409 });
  }

  const maintenant = new Date();
  // Condition sur EN_ATTENTE : deux tablettes ouvertes sur la meme file ne
  // comptent pas deux fois la meme cliente.
  const maj = await prisma.destinatairePromo.updateMany({
    where: { id: corps.destinataireId, campagneId: id, statut: "EN_ATTENTE" },
    data:
      corps.action === "envoye"
        ? { statut: "ENVOYE", envoyeLe: maintenant, tentatives: 1 }
        : { statut: "NON_ENVOYE" },
  });

  // Plus personne en attente : la campagne est terminee.
  const reste = await prisma.destinatairePromo.count({ where: { campagneId: id, statut: "EN_ATTENTE" } });
  if (reste === 0) {
    await prisma.campagnePromo.updateMany({
      where: { id, statut: "EN_COURS" },
      data: { statut: "TERMINEE", termineeLe: maintenant },
    });
  }

  return Response.json({ deja: maj.count === 0, reste });
}
