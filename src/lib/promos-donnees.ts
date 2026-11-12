/**
 * Lectures en base des promos. Deux requetes pour tout le salon (fiches +
 * date de derniere vente groupee), jamais une par cliente.
 */

import { prisma } from "@/lib/prisma";
import { STATUTS_VENTE_REALISEE } from "@/lib/statut-vente";
import { compterRevenues, JOURS_RETOUR, type ClientePromo } from "@/lib/promos";

export type ClientePromoNommee = ClientePromo & { nom: string | null };

export async function chargerClientesPromo(providerId: string): Promise<ClientePromoNommee[]> {
  const [fiches, dernieres] = await Promise.all([
    prisma.customer.findMany({
      where: { firstSalonId: providerId },
      select: { id: true, phone: true, firstName: true, lastName: true, promosAcceptees: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    prisma.sale.groupBy({
      by: ["customerId"],
      where: { providerId, customerId: { not: null }, status: { in: [...STATUTS_VENTE_REALISEE] } },
      _max: { createdAt: true },
    }),
  ]);
  const derniere = new Map(dernieres.map((d) => [d.customerId as string, d._max.createdAt]));
  return fiches.map((f) => ({
    id: f.id,
    telephone: f.phone,
    prenom: f.firstName,
    nom: f.lastName,
    promosAcceptees: f.promosAcceptees,
    derniereVenteAt: derniere.get(f.id) ?? null,
  }));
}

/** Les dernieres campagnes, avec leurs compteurs et les clientes revenues. */
export async function dernieresCampagnes(providerId: string, nombre = 10) {
  const campagnes = await prisma.campagnePromo.findMany({
    where: { providerId },
    orderBy: { creeLe: "desc" },
    take: nombre,
    select: {
      id: true,
      texteOffre: true,
      canal: true,
      statut: true,
      creeLe: true,
      programmeeLe: true,
      termineeLe: true,
      nbDestinataires: true,
    },
  });
  if (campagnes.length === 0) return [];
  const ids = campagnes.map((c) => c.id);

  const [parStatut, envoyes] = await Promise.all([
    prisma.destinatairePromo.groupBy({
      by: ["campagneId", "statut"],
      where: { campagneId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.destinatairePromo.findMany({
      where: { campagneId: { in: ids }, envoyeLe: { not: null }, customerId: { not: null } },
      select: { campagneId: true, customerId: true, envoyeLe: true },
    }),
  ]);

  // « Revenues » : une vente PAID ou CREDIT dans ce salon, dans les 15 jours
  // apres l'envoi. Une seule requete pour toutes les campagnes affichees.
  const premierEnvoi = envoyes.reduce<Date | null>(
    (min, d) => (d.envoyeLe && (!min || d.envoyeLe < min) ? d.envoyeLe : min),
    null,
  );
  const ventes = premierEnvoi
    ? await prisma.sale.findMany({
        where: {
          providerId,
          status: { in: ["PAID", "CREDIT"] },
          customerId: { in: Array.from(new Set(envoyes.map((d) => d.customerId as string))) },
          createdAt: { gte: premierEnvoi, lte: new Date(Date.now() + JOURS_RETOUR * 86400000) },
        },
        select: { customerId: true, createdAt: true },
      })
    : [];
  const ventesNettes = ventes
    .filter((v) => v.customerId)
    .map((v) => ({ customerId: v.customerId as string, createdAt: v.createdAt }));

  return campagnes.map((c) => {
    const compte = (statuts: string[]) =>
      parStatut
        .filter((p) => p.campagneId === c.id && statuts.includes(p.statut))
        .reduce((s, p) => s + p._count._all, 0);
    return {
      ...c,
      envoyes: compte(["ENVOYE", "DELIVRE", "LU"]),
      lus: compte(["LU"]),
      echecs: compte(["ECHEC"]),
      restants: compte(["EN_ATTENTE", "RESERVE"]),
      nonEnvoyes: compte(["NON_ENVOYE"]),
      revenues: compterRevenues(
        envoyes.filter((d) => d.campagneId === c.id),
        ventesNettes,
      ),
    };
  });
}
