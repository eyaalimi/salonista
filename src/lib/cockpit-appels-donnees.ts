/**
 * Les donnees du cockpit d'appels — l'acces Prisma, et rien d'autre.
 *
 * LA CONTRAINTE QUI COMMANDE CE FICHIER : aucune requete par salon. Avec
 * cinquante salons et sept marches, une requete par salon et par signal
 * ferait des centaines d'allers-retours pour afficher une page. On agrege
 * donc pour TOUS les salons en une poignee de `groupBy`, puis on assemble en
 * memoire — exactement le parti pris de `signesDeVieParSalon`, qu'on
 * reutilise ici plutot que de le refaire.
 *
 * Les decisions (marche bloquante, priorite, score, questions) vivent dans
 * `cockpit-appels.ts`, pur et teste. Ici, uniquement la base.
 */

import { prisma } from "@/lib/prisma";
import { signesDeVieParSalon } from "@/lib/campagne-donnees";
import {
  EVENEMENTS,
  compterPaniersAbandonnes,
  type CompteursSecurite,
} from "@/lib/evenement-salon";
import {
  fileDAppels,
  construireEntonnoir,
  marcheBloquante,
  etiquetteProbleme,
  revenuApresInscription,
  scoreSante,
  type LigneEntonnoir,
  type Marche,
  type SalonPourPriorite,
} from "@/lib/cockpit-appels";
import { rappelEstDu, faitAujourdhui } from "@/lib/compte-rendu-appel";
import type { ProfilSalon } from "@/lib/onboarding-salon";

/** Fenetre d'observation des signaux, en jours. */
export const FENETRE_SIGNAUX_JOURS = 7;

export type SalonCockpit = SalonPourPriorite & {
  marche: Marche | null;
  /**
   * Le PROBLEME, en clair — « Pas d'horaires », « Caisse jamais ouverte ».
   * Distinct de `marche` : celle-la nomme l'etape, celui-ci ce qui coince.
   * Afficher la marche donnait « Profil pret » sur un salon bloque au profil.
   */
  probleme: string | null;
  score: number | null;
  /** Rappel pose par un appel precedent, s'il y en a un. */
  rappelLe: Date | null;
  /** Un appel a-t-il deja ete passe aujourd'hui ? */
  appeleAujourdhui: boolean;
  /** Paniers abandonnes sur la fenetre. */
  paniersAbandonnes: number;
  /** Ventes refusees faute de tiroir, sur la fenetre. */
  ventesRefuseesTiroir: number;
  /**
   * L'etape la plus avancee atteinte dans l'assistant, si on la connait et
   * qu'il n'est PAS termine. `null` sinon : un assistant fini n'est plus un
   * signal d'appel.
   */
  assistantEtape: number | null;
  assistantLibelle: string | null;
};

/** Le nombre d'elements de chaque onglet, pour les afficher a cote du nom. */
export type CompteursOnglets = { aAppeler: number; rappels: number; faits: number };

export type DonneesCockpit = {
  entonnoir: LigneEntonnoir[];
  /** Tous les salons retenus pour les appels, deja tries. */
  file: SalonCockpit[];
  /** Total d'inscrits sur la periode, entonnoir compris. */
  totalInscrits: number;
  onglets: CompteursOnglets;
};

/**
 * Tout ce que le cockpit affiche, en une poignee de requetes.
 *
 * @param joursInscription ne retenir que les salons inscrits depuis N jours.
 */
export async function donneesCockpit(
  joursInscription: number,
  maintenant: Date = new Date(),
): Promise<DonneesCockpit> {
  const depuisInscription = new Date(maintenant);
  depuisInscription.setDate(depuisInscription.getDate() - joursInscription);

  const fenetre = new Date(maintenant);
  fenetre.setDate(fenetre.getDate() - FENETRE_SIGNAUX_JOURS);

  // 1 — les salons de la periode, avec leur profil et leur gerant.
  const salons = await prisma.providerProfile.findMany({
    where: { createdAt: { gte: depuisInscription } },
    select: {
      id: true,
      salonName: true,
      city: true,
      address: true,
      photos: true,
      openingHours: true,
      createdAt: true,
      suspendedAt: true,
      user: { select: { emailVerified: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const ids = salons.map((s) => s.id);
  if (ids.length === 0) {
    return {
      entonnoir: construireEntonnoir([], maintenant),
      file: [],
      totalInscrits: 0,
      onglets: { aAppeler: 0, rappels: 0, faits: 0 },
    };
  }

  // 2 — tous les agregats, en parallele. Un `groupBy` par signal, jamais un
  // par salon.
  const [
    signes,
    offres,
    tiroirs,
    premieresVentes,
    evenements,
    ventesFenetre,
    verrous,
    notes,
    abonnementsPos,
    tracesAssistant,
  ] = await Promise.all([
    signesDeVieParSalon(),
    prisma.offer.groupBy({
      by: ["providerId"],
      where: { providerId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.cashDrawerSession.groupBy({
      by: ["providerId"],
      where: { providerId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.sale.groupBy({
      by: ["providerId"],
      where: {
        providerId: { in: ids },
        status: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] },
      },
      _min: { createdAt: true },
    }),
    // Les evenements bruts de la fenetre : assez peu nombreux pour etre
    // repartis en memoire, et il faut les DATES pour deduire les abandons.
    prisma.evenementSalon.findMany({
      where: { providerId: { in: ids }, createdAt: { gte: fenetre } },
      select: { providerId: true, type: true, createdAt: true },
    }),
    prisma.sale.findMany({
      where: { providerId: { in: ids }, createdAt: { gte: fenetre } },
      select: { providerId: true, createdAt: true },
    }),
    prisma.salonEmployee.findMany({
      where: { providerId: { in: ids }, pinLockedUntil: { gt: maintenant } },
      select: { providerId: true },
    }),
    // Derniere note PORTANT un resultat ou un rappel, par salon.
    prisma.supportNote.findMany({
      where: { providerId: { in: ids } },
      select: { providerId: true, resultat: true, rappelLe: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    // Le module caisse pour TOUS les salons d'un coup : c'est lui qui decide
    // quel parcours d'activation s'applique.
    prisma.salonSubscription.findMany({
      where: { providerId: { in: ids }, module: "POS" },
      select: { providerId: true, status: true, expiresAt: true },
    }),
    // L'assistant : HORS de la fenetre de 7 jours, une installation datant
    // souvent du jour de l'inscription.
    prisma.evenementSalon.findMany({
      where: {
        providerId: { in: ids },
        type: {
          in: [EVENEMENTS.ONBOARDING_ETAPE_VUE, EVENEMENTS.ONBOARDING_TERMINE],
        },
      },
      select: { providerId: true, type: true, metadata: true },
    }),
  ]);

  // 3 — repartition en memoire.
  const parSalon = <T>(liste: readonly T[], cle: (x: T) => string) => {
    const m = new Map<string, T[]>();
    for (const x of liste) {
      const k = cle(x);
      const a = m.get(k);
      if (a) a.push(x);
      else m.set(k, [x]);
    }
    return m;
  };

  const nbOffres = new Map(offres.map((o) => [o.providerId, o._count._all]));
  const nbTiroirs = new Map(tiroirs.map((t) => [t.providerId, t._count._all]));
  const premiereVente = new Map(
    premieresVentes.map((v) => [v.providerId, v._min.createdAt ?? null]),
  );
  const evParSalon = parSalon(evenements, (e) => e.providerId);
  const ventesParSalon = parSalon(ventesFenetre, (v) => v.providerId);
  const verrouilles = new Set(verrous.map((v) => v.providerId));
  const notesParSalon = parSalon(notes, (n) => n.providerId);

  // Meme regle que `hasModule` : ACTIVE ou TRIAL, et non expire.
  // L'etape la plus avancee par salon, et qui a termine.
  const assistantTermine = new Set(
    tracesAssistant
      .filter((t) => t.type === EVENEMENTS.ONBOARDING_TERMINE)
      .map((t) => t.providerId),
  );
  const etapeMax = new Map<string, { etape: number; libelle: string | null }>();
  for (const t of tracesAssistant) {
    if (t.type !== EVENEMENTS.ONBOARDING_ETAPE_VUE) continue;
    const m = t.metadata as { etape?: unknown; libelle?: unknown } | null;
    if (typeof m?.etape !== "number") continue;
    const actuel = etapeMax.get(t.providerId);
    if (!actuel || m.etape > actuel.etape) {
      etapeMax.set(t.providerId, {
        etape: m.etape,
        libelle: typeof m.libelle === "string" ? m.libelle : null,
      });
    }
  }

  const avecCaisse = new Set(
    abonnementsPos
      .filter(
        (a) =>
          (a.status === "ACTIVE" || a.status === "TRIAL") &&
          (!a.expiresAt || a.expiresAt.getTime() > maintenant.getTime()),
      )
      .map((a) => a.providerId),
  );

  const complets: SalonCockpit[] = salons.map((s) => {
    const ev = evParSalon.get(s.id) ?? [];
    const compte = (type: string) => ev.filter((e) => e.type === type).length;

    const securite: CompteursSecurite = {
      verrouillages: compte(EVENEMENTS.PIN_VERROUILLAGE),
      pinIncorrects: compte(EVENEMENTS.PIN_INCORRECT),
      mdpIncorrects: compte(EVENEMENTS.CONNEXION_MDP_INCORRECT),
    };
    // Une employee verrouillee EN CE MOMENT compte aussi comme alerte, meme
    // si le verrouillage date d'avant la fenetre.
    if (verrouilles.has(s.id)) securite.verrouillages += 1;

    const ouvertures = ev
      .filter((e) => e.type === EVENEMENTS.PAIEMENT_OUVERT)
      .map((e) => ({ a: e.createdAt }));
    const paniersAbandonnes = compterPaniersAbandonnes(
      ouvertures,
      (ventesParSalon.get(s.id) ?? []).map((v) => v.createdAt),
      maintenant,
    );

    const mesNotes = notesParSalon.get(s.id) ?? [];
    const prochainRappel = mesNotes.find((n) => n.rappelLe !== null)?.rappelLe ?? null;

    const profil: ProfilSalon = {
      address: s.address,
      city: s.city,
      photos: s.photos,
      openingHours: s.openingHours,
    };

    const base: SalonPourPriorite = {
      id: s.id,
      salonName: s.salonName,
      city: s.city,
      inscritLe: s.createdAt,
      suspendu: s.suspendedAt !== null,
      emailVerifie: s.user?.emailVerified !== null && s.user?.emailVerified !== undefined,
      profil,
      nombreOffres: nbOffres.get(s.id) ?? 0,
      tiroirDejaOuvert: (nbTiroirs.get(s.id) ?? 0) > 0,
      premiereVenteAt: premiereVente.get(s.id) ?? null,
      derniereVenteAt: signes.get(s.id)?.derniereVenteAt ?? null,
      derniereConnexionAt: signes.get(s.id)?.derniereConnexionAt ?? null,
      securite,
      aLaCaisse: avecCaisse.has(s.id),
      revenuApres: revenuApresInscription(
        s.createdAt,
        signes.get(s.id)?.derniereConnexionAt ?? null,
      ),
    };

    return {
      ...base,
      marche: marcheBloquante(base, maintenant),
      probleme: etiquetteProbleme(base, maintenant),
      score: scoreSante(base, maintenant),
      rappelLe: prochainRappel,
      appeleAujourdhui: mesNotes.some((n) => faitAujourdhui(n, maintenant)),
      paniersAbandonnes,
      ventesRefuseesTiroir: compte(EVENEMENTS.VENTE_REFUSEE_TIROIR_FERME),
      // Un assistant TERMINE n'est plus un signal d'appel : on ne l'affiche
      // que lorsqu'il s'est arrete en route.
      assistantEtape: assistantTermine.has(s.id)
        ? null
        : (etapeMax.get(s.id)?.etape ?? null),
      assistantLibelle: assistantTermine.has(s.id)
        ? null
        : (etapeMax.get(s.id)?.libelle ?? null),
    };
  });

  const file = fileDAppels(complets, maintenant);

  return {
    entonnoir: construireEntonnoir(complets, maintenant),
    file,
    totalInscrits: complets.length,
    // Les compteurs se calculent sur la file COMPLETE, sans le filtre de
    // marche : « À appeler · 18 » doit rester 18 meme quand on inspecte une
    // marche, sinon le chiffre changerait a chaque clic sur l'entonnoir.
    onglets: {
      aAppeler: filtrerFile(file, "a-appeler", null, maintenant).length,
      rappels: filtrerFile(file, "rappels", null, maintenant).length,
      faits: filtrerFile(file, "faits", null, maintenant).length,
    },
  };
}

/** Les trois onglets de la file. */
export type Onglet = "a-appeler" | "rappels" | "faits";

/**
 * Applique l'onglet et le filtre de marche a la file deja triee.
 *
 * Pur, mais garde ici : il travaille sur le type assemble par ce fichier.
 */
export function filtrerFile(
  file: readonly SalonCockpit[],
  onglet: Onglet,
  marche: Marche | null,
  maintenant: Date = new Date(),
): SalonCockpit[] {
  let sortie = [...file];

  if (onglet === "rappels") {
    sortie = sortie.filter((s) => rappelEstDu(s.rappelLe, maintenant));
  } else if (onglet === "faits") {
    sortie = sortie.filter((s) => s.appeleAujourdhui);
  } else {
    // « À appeler » : on retire ceux deja traites aujourd'hui, pour que la
    // liste se vide a mesure que la tournee avance.
    sortie = sortie.filter((s) => !s.appeleAujourdhui);
  }

  if (marche) sortie = sortie.filter((s) => s.marche === marche);
  return sortie;
}
