/**
 * Le detail du salon affiche a droite du cockpit — l'acces Prisma, et rien
 * d'autre.
 *
 * POURQUOI UN FICHIER SEPARE DE `cockpit-appels-donnees.ts`. Celui-la agrege
 * TOUS les salons pour la file et l'entonnoir ; celui-ci ne regarde qu'UN
 * salon, celui qu'on a sous les yeux. La distinction n'est pas cosmetique :
 * charger l'activite recente, le detail du tiroir et les connexions pour les
 * quarante-huit salons de la file lirait des milliers de lignes dont
 * quarante-sept ne seraient jamais affichees.
 *
 * Une requete pour UN salon n'est pas « une requete par salon » : la regle du
 * projet interdit de boucler sur la file, pas de detailler la selection.
 */

import { prisma } from "@/lib/prisma";
import { EVENEMENTS } from "@/lib/evenement-salon";

/** Fenetre d'observation des signaux, en jours. */
const FENETRE_JOURS = 7;

export type EvenementAffiche = {
  id: string;
  type: string;
  createdAt: Date;
  employe: string | null;
  metadata: unknown;
};

export type FicheAppel = {
  /** Jalons du parcours, pour dater chaque etape franchie. */
  emailVerifieLe: Date | null;
  cataloguePretLe: Date | null;
  equipeAuDela: boolean;
  equipeLe: Date | null;
  appInstallee: boolean;
  appInstalleeLe: Date | null;
  tiroirOuvertLe: Date | null;

  /** Equipe du salon. */
  employes: Array<{
    id: string;
    nom: string;
    role: string;
    derniereConnexion: Date | null;
    verrouilleJusqua: Date | null;
    pinIncorrects: number;
  }>;

  /** Caisse et tiroir. */
  tiroirOuvertDepuis: Date | null;
  tiroirFond: string | null;
  rapportsZ: number;
  ventesEncaissees: number;

  /** Connexions et securite, sur la fenetre. */
  derniereConnexion: Date | null;
  connexions7j: number;
  mdpIncorrects7j: number;
  verrouillages7j: number;
  appareilsAppaires: number;

  /** Catalogue. */
  servicesTotal: number;
  servicesSansPhoto: number;

  /** Les derniers evenements, deja tries du plus recent au plus ancien. */
  activite: EvenementAffiche[];
  /** Nombre total d'evenements sur la fenetre, pour « les N evenements ». */
  activiteTotal: number;

  /** Dernier appel passe a ce salon. */
  dernierAppelLe: Date | null;
  dernierAppelResultat: string | null;

  /**
   * Ou la gerante s'est arretee dans l'assistant /pos/bienvenue.
   * `null` si elle ne l'a jamais ouvert.
   */
  assistant: {
    derniereEtape: number | null;
    libelle: string | null;
    le: Date | null;
    termine: boolean;
    quitte: boolean;
  } | null;
};

export async function ficheAppel(
  providerId: string,
  maintenant: Date = new Date(),
): Promise<FicheAppel> {
  const fenetre = new Date(maintenant);
  fenetre.setDate(fenetre.getDate() - FENETRE_JOURS);

  const [
    salon,
    employes,
    tiroirOuvert,
    premierTiroir,
    rapportsZ,
    ventes,
    premiereOffre,
    offres,
    evenements,
    activiteTotal,
    appaires,
    derniereNote,
    tracesAssistant,
  ] = await Promise.all([
    prisma.providerProfile.findUnique({
      where: { id: providerId },
      select: { user: { select: { emailVerified: true } } },
    }),
    prisma.salonEmployee.findMany({
      where: { providerId },
      select: {
        id: true,
        displayName: true,
        role: true,
        lastLoginAt: true,
        pinLockedUntil: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.cashDrawerSession.findFirst({
      where: { providerId, status: "OPEN" },
      select: { openedAt: true, openingFloat: true },
      orderBy: { openedAt: "desc" },
    }),
    prisma.cashDrawerSession.findFirst({
      where: { providerId },
      select: { openedAt: true },
      orderBy: { openedAt: "asc" },
    }),
    prisma.cashDrawerSession.count({
      where: { providerId, status: { not: "OPEN" } },
    }),
    prisma.sale.count({
      where: {
        providerId,
        status: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] },
      },
    }),
    prisma.offer.findFirst({
      where: { providerId },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.offer.findMany({
      where: { providerId },
      select: { photos: true },
    }),
    prisma.evenementSalon.findMany({
      where: { providerId },
      select: {
        id: true,
        type: true,
        createdAt: true,
        employeeId: true,
        metadata: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.evenementSalon.count({ where: { providerId, createdAt: { gte: fenetre } } }),
    prisma.devicePairingCode.count({ where: { providerId, usedAt: { not: null } } }),
    prisma.supportNote.findFirst({
      where: { providerId, resultat: { not: null } },
      select: { createdAt: true, resultat: true },
      orderBy: { createdAt: "desc" },
    }),
    // L'assistant : toutes ses traces, sans fenetre de 7 jours — une
    // installation date souvent de l'inscription, donc bien avant.
    prisma.evenementSalon.findMany({
      where: {
        providerId,
        type: {
          in: [
            EVENEMENTS.ONBOARDING_ETAPE_VUE,
            EVENEMENTS.ONBOARDING_TERMINE,
            EVENEMENTS.ONBOARDING_QUITTE,
          ],
        },
      },
      select: { type: true, createdAt: true, metadata: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  // Les compteurs d'evenements de la fenetre, en une passe.
  const compteurs = await prisma.evenementSalon.groupBy({
    by: ["type"],
    where: { providerId, createdAt: { gte: fenetre } },
    _count: { _all: true },
  });
  const compte = (t: string) =>
    compteurs.find((c) => c.type === t)?._count._all ?? 0;

  // Les PIN rates par employee, sur la fenetre.
  const pinParEmploye = await prisma.evenementSalon.groupBy({
    by: ["employeeId"],
    where: {
      providerId,
      type: EVENEMENTS.PIN_INCORRECT,
      createdAt: { gte: fenetre },
    },
    _count: { _all: true },
  });
  const pinDe = new Map(
    pinParEmploye.map((p) => [p.employeeId ?? "", p._count._all]),
  );

  const nomEmploye = new Map(employes.map((e) => [e.id, e.displayName]));

  const connexions = employes
    .map((e) => e.lastLoginAt)
    .filter((d): d is Date => d !== null);
  const derniereConnexion =
    connexions.length === 0
      ? null
      : new Date(Math.max(...connexions.map((d) => d.getTime())));

  return {
    emailVerifieLe: salon?.user?.emailVerified ?? null,
    cataloguePretLe: premiereOffre?.createdAt ?? null,
    // « Equipe » = au moins une employee en plus de la proprietaire.
    equipeAuDela: employes.length > 1,
    equipeLe: employes.length > 1 ? employes[1].createdAt : null,
    appInstallee: compte(EVENEMENTS.APP_INSTALLEE) > 0,
    appInstalleeLe:
      evenements.find((e) => e.type === EVENEMENTS.APP_INSTALLEE)?.createdAt ?? null,
    tiroirOuvertLe: premierTiroir?.openedAt ?? null,

    employes: employes.map((e) => ({
      id: e.id,
      nom: e.displayName,
      role: e.role,
      derniereConnexion: e.lastLoginAt,
      verrouilleJusqua:
        e.pinLockedUntil && e.pinLockedUntil > maintenant ? e.pinLockedUntil : null,
      pinIncorrects: pinDe.get(e.id) ?? 0,
    })),

    tiroirOuvertDepuis: tiroirOuvert?.openedAt ?? null,
    tiroirFond: tiroirOuvert?.openingFloat?.toString() ?? null,
    rapportsZ,
    ventesEncaissees: ventes,

    derniereConnexion,
    // Les connexions ne sont pas historisees : `lastLoginAt` ne garde que la
    // derniere. On compte donc les employees vues sur la fenetre, ce qui
    // repond a « qui ouvre l'application » sans promettre un total exact.
    connexions7j: employes.filter((e) => e.lastLoginAt && e.lastLoginAt >= fenetre).length,
    mdpIncorrects7j: compte(EVENEMENTS.CONNEXION_MDP_INCORRECT),
    verrouillages7j: compte(EVENEMENTS.PIN_VERROUILLAGE),
    appareilsAppaires: appaires,

    servicesTotal: offres.length,
    servicesSansPhoto: offres.filter((o) => o.photos.length === 0).length,

    activite: evenements.map((e) => ({
      id: e.id,
      type: e.type,
      createdAt: e.createdAt,
      employe: e.employeeId ? (nomEmploye.get(e.employeeId) ?? null) : null,
      metadata: e.metadata,
    })),
    activiteTotal,

    dernierAppelLe: derniereNote?.createdAt ?? null,
    dernierAppelResultat: derniereNote?.resultat ?? null,
    assistant: resumerAssistant(tracesAssistant),
  };
}

type TraceAssistant = { type: string; createdAt: Date; metadata: unknown };

/**
 * Ou en est l'assistant, resume en une ligne affichable.
 *
 * L'ETAPE LA PLUS AVANCEE, pas la derniere vue : une gerante qui revient en
 * arriere pour corriger son nom de salon n'est pas « bloquee a l'etape 1 ».
 * Ce qu'on veut savoir, c'est jusqu'ou elle est allee.
 */
function resumerAssistant(traces: readonly TraceAssistant[]): FicheAppel["assistant"] {
  if (traces.length === 0) return null;

  const termine = traces.find((t) => t.type === EVENEMENTS.ONBOARDING_TERMINE);
  const quitte = traces.find((t) => t.type === EVENEMENTS.ONBOARDING_QUITTE);

  let derniereEtape: number | null = null;
  let libelle: string | null = null;
  let le: Date | null = null;

  for (const t of traces) {
    const m = t.metadata as { etape?: unknown; libelle?: unknown } | null;
    const n = typeof m?.etape === "number" ? m.etape : null;
    if (n === null) continue;
    if (derniereEtape === null || n > derniereEtape) {
      derniereEtape = n;
      libelle = typeof m?.libelle === "string" ? m.libelle : null;
      le = t.createdAt;
    }
  }

  return {
    derniereEtape,
    libelle,
    le: le ?? quitte?.createdAt ?? termine?.createdAt ?? null,
    termine: !!termine,
    quitte: !!quitte,
  };
}
