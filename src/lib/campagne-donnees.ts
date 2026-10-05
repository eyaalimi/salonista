/**
 * Lecture des donnees de campagne — l'adaptateur Prisma du tableau de bord.
 *
 * Les calculs vivent dans `campagne-entonnoir.ts` et `campagne-tableau.ts`
 * (purs, testes). Ici on ne fait que lire la base et appeler ces fonctions.
 */

import { prisma } from "./prisma";
import {
  compterUniques,
  construireEntonnoir,
  coutParInscription,
  type Decomptes,
  type Etape,
  type LigneEntonnoir,
} from "./campagne-entonnoir";
import {
  estActif,
  joursDeLaPeriode,
  statutSalon,
  type StatutSalon,
} from "./campagne-tableau";

/** Periode d'analyse, bornes incluses. */
export type Periode = { depuis: Date; jusqua: Date };

/** Les N derniers jours, jusqu'a maintenant. */
export function derniersJours(n: number, maintenant = new Date()): Periode {
  const depuis = new Date(maintenant);
  depuis.setDate(depuis.getDate() - n);
  depuis.setHours(0, 0, 0, 0);
  return { depuis, jusqua: maintenant };
}

/** L'entonnoir, global ou filtre sur une campagne. */
export async function entonnoir(
  periode: Periode,
  campaignId?: string | null,
): Promise<LigneEntonnoir[]> {
  const evenements = await prisma.campaignEvent.findMany({
    where: {
      createdAt: { gte: periode.depuis, lte: periode.jusqua },
      ...(campaignId ? { campaignId } : {}),
    },
    select: { type: true, visitorId: true, providerId: true },
  });

  const decomptes = compterUniques(
    evenements.map((e) => ({
      etape: e.type as Etape,
      visitorId: e.visitorId,
      providerId: e.providerId,
    })),
  );

  // ACTIF_7J et ACTIF_30J ne sont PAS des evenements enregistres : ils se
  // DEDUISENT de l'activite reelle des salons. Les faire declarer par le
  // client permettrait de fabriquer des statistiques.
  const actifs = await compterActifs(campaignId);
  decomptes.ACTIF_7J = actifs.sept;
  decomptes.ACTIF_30J = actifs.trente;

  return construireEntonnoir(decomptes);
}

/**
 * Compte les salons actifs a 7 et 30 jours.
 *
 * « Actif » = une vente OU une connexion d'employe sur la fenetre. La
 * definition vit dans campagne-tableau.ts — la changer la-bas change tout le
 * tableau de bord d'un coup.
 */
async function compterActifs(
  campaignId?: string | null,
): Promise<{ sept: number; trente: number }> {
  const signes = await signesDeVieParSalon(campaignId);
  const maintenant = new Date();
  const il7 = derniersJours(7, maintenant).depuis;
  const il30 = derniersJours(30, maintenant).depuis;

  let sept = 0;
  let trente = 0;
  for (const s of signes.values()) {
    if (estActif(s, il7, maintenant)) sept++;
    if (estActif(s, il30, maintenant)) trente++;
  }
  return { sept, trente };
}

/**
 * Derniere vente et derniere connexion, par salon.
 *
 * Deux agregats plutot qu'une boucle par salon : avec 18 salons aujourd'hui
 * la difference est invisible, avec 2 000 elle ne le serait plus.
 */
export async function signesDeVieParSalon(
  campaignId?: string | null,
): Promise<Map<string, { derniereVenteAt: Date | null; derniereConnexionAt: Date | null }>> {
  const salons = await prisma.providerProfile.findMany({
    where: campaignId ? { campaignId } : {},
    select: { id: true },
  });
  const ids = salons.map((s) => s.id);
  const sortie = new Map<string, { derniereVenteAt: Date | null; derniereConnexionAt: Date | null }>();
  for (const id of ids) sortie.set(id, { derniereVenteAt: null, derniereConnexionAt: null });
  if (ids.length === 0) return sortie;

  const ventes = await prisma.sale.groupBy({
    by: ["providerId"],
    where: { providerId: { in: ids }, status: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] } },
    _max: { createdAt: true },
  });
  for (const v of ventes) {
    const e = sortie.get(v.providerId);
    if (e) e.derniereVenteAt = v._max.createdAt ?? null;
  }

  const connexions = await prisma.salonEmployee.groupBy({
    by: ["providerId"],
    where: { providerId: { in: ids }, lastLoginAt: { not: null } },
    _max: { lastLoginAt: true },
  });
  for (const c of connexions) {
    const e = sortie.get(c.providerId);
    if (e) e.derniereConnexionAt = c._max.lastLoginAt ?? null;
  }

  return sortie;
}

/** Une campagne, avec ses chiffres cles. */
export type LigneCampagne = {
  id: string;
  name: string;
  slug: string;
  channel: string;
  budgetMillimes: number | null;
  clics: number;
  visiteurs: number;
  inscriptions: number;
  coutParInscriptionMillimes: number | null;
};

/** Le tableau comparatif des campagnes. */
export async function comparerCampagnes(periode: Periode): Promise<LigneCampagne[]> {
  const campagnes = await prisma.campaign.findMany({ orderBy: { startsAt: "desc" } });
  if (campagnes.length === 0) return [];

  const evenements = await prisma.campaignEvent.findMany({
    where: {
      campaignId: { in: campagnes.map((c) => c.id) },
      createdAt: { gte: periode.depuis, lte: periode.jusqua },
    },
    select: { campaignId: true, type: true, visitorId: true, providerId: true },
  });

  const parCampagne = new Map<string, typeof evenements>();
  for (const e of evenements) {
    if (!e.campaignId) continue;
    const liste = parCampagne.get(e.campaignId) ?? [];
    liste.push(e);
    parCampagne.set(e.campaignId, liste);
  }

  return campagnes.map((c) => {
    const liste = parCampagne.get(c.id) ?? [];
    const d: Decomptes = compterUniques(
      liste.map((e) => ({
        etape: e.type as Etape,
        visitorId: e.visitorId,
        providerId: e.providerId,
      })),
    );
    // Les clics BRUTS, sans deduplication : c'est ce qu'on paie a Meta.
    const clics = liste.filter((e) => e.type === "CLIC").length;

    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      channel: c.channel,
      budgetMillimes: c.budgetMillimes,
      clics,
      visiteurs: d.CLIC, // clics DEDUPLIQUES = personnes distinctes
      inscriptions: d.INSCRIPTION_FIN,
      coutParInscriptionMillimes: coutParInscription(c.budgetMillimes, d.INSCRIPTION_FIN),
    };
  });
}

/** Un point de la courbe jour par jour. */
export type PointJour = { jour: string; clics: number; inscriptions: number };

export async function courbeJournaliere(
  periode: Periode,
  campaignId?: string | null,
): Promise<PointJour[]> {
  const evenements = await prisma.campaignEvent.findMany({
    where: {
      createdAt: { gte: periode.depuis, lte: periode.jusqua },
      type: { in: ["CLIC", "INSCRIPTION_FIN"] },
      ...(campaignId ? { campaignId } : {}),
    },
    select: { type: true, createdAt: true },
  });

  const parJour = new Map<string, { clics: number; inscriptions: number }>();

  /*
   * On pre-remplit TOUS les jours de la periode : sans cela, un jour sans
   * aucun clic disparaitrait de la courbe et la ferait mentir.
   *
   * Le decoupage se fait en UTC, comme `createdAt` que l'on compare ensuite.
   * Melanger les deux decalait la courbe d'un jour : `depuis` etait a minuit
   * HEURE LOCALE (22h UTC la veille en Tunisie), si bien que le jour courant
   * sortait de la boucle et que les clics du jour n'apparaissaient nulle part.
   */
  const jourUtc = (d: Date) => d.toISOString().slice(0, 10);
  for (const j of joursDeLaPeriode(periode.depuis, periode.jusqua)) {
    parJour.set(j, { clics: 0, inscriptions: 0 });
  }

  for (const e of evenements) {
    const p = parJour.get(jourUtc(e.createdAt));
    if (!p) continue;
    if (e.type === "CLIC") p.clics++;
    else p.inscriptions++;
  }

  return [...parJour.entries()]
    .map(([jour, v]) => ({ jour, ...v }))
    .sort((a, b) => a.jour.localeCompare(b.jour));
}

/** Un salon inscrit, tel qu'affiche dans la liste. */
export type LigneSalon = {
  id: string;
  salonName: string;
  city: string | null;
  createdAt: Date;
  campagne: string | null;
  utmSource: string | null;
  statut: StatutSalon;
  joursDepuisDerniereVente: number | null;
};

export async function salonsInscrits(campaignId?: string | null): Promise<LigneSalon[]> {
  const salons = await prisma.providerProfile.findMany({
    where: campaignId ? { campaignId } : {},
    select: {
      id: true,
      salonName: true,
      city: true,
      createdAt: true,
      utmSource: true,
      campaign: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const signes = await signesDeVieParSalon(campaignId);
  const maintenant = new Date();

  return salons.map((s) => {
    const sv = signes.get(s.id) ?? { derniereVenteAt: null, derniereConnexionAt: null };
    return {
      id: s.id,
      salonName: s.salonName,
      city: s.city,
      createdAt: s.createdAt,
      campagne: s.campaign?.name ?? null,
      utmSource: s.utmSource,
      statut: statutSalon(sv, maintenant),
      joursDepuisDerniereVente: sv.derniereVenteAt
        ? Math.floor((maintenant.getTime() - sv.derniereVenteAt.getTime()) / 86_400_000)
        : null,
    };
  });
}
