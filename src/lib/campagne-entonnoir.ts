/**
 * L'entonnoir d'acquisition — les decisions, sans la base.
 *
 * Isole pour etre testable sans Prisma, comme le reste des decisions du
 * projet. Les adaptateurs qui lisent et ecrivent vivent dans les routes.
 */

/**
 * Les etapes, DANS L'ORDRE. L'ordre est porteur de sens : chaque taux de
 * conversion se calcule par rapport a l'etape precedente.
 *
 * Deux familles :
 *   - CLIC et VISITE sont ANONYMES (rattaches a un `visitorId` aleatoire) ;
 *   - a partir d'INSCRIPTION_DEBUT, l'evenement porte un `providerId`.
 */
export const ETAPES = [
  "CLIC",
  "VISITE",
  "INSCRIPTION_DEBUT",
  "INSCRIPTION_FIN",
  "CAISSE_ACTIVEE",
  "APP_INSTALLEE",
  "PREMIERE_VENTE",
  "ACTIF_7J",
  "ACTIF_30J",
] as const;

export type Etape = (typeof ETAPES)[number];

/** Libelles francais, pour l'affichage. */
export const LIBELLE_ETAPE: Record<Etape, string> = {
  CLIC: "Clics",
  VISITE: "Visites",
  INSCRIPTION_DEBUT: "Inscriptions commencées",
  INSCRIPTION_FIN: "Inscriptions terminées",
  CAISSE_ACTIVEE: "Caisses activées",
  APP_INSTALLEE: "Applications installées",
  PREMIERE_VENTE: "Premières ventes",
  ACTIF_7J: "Actifs à 7 jours",
  ACTIF_30J: "Actifs à 30 jours",
};

/** Un decompte par etape. Toutes les etapes sont presentes, meme a zero. */
export type Decomptes = Record<Etape, number>;

export function decomptesVides(): Decomptes {
  return Object.fromEntries(ETAPES.map((e) => [e, 0])) as Decomptes;
}

/** Une ligne de l'entonnoir, prete a afficher. */
export type LigneEntonnoir = {
  etape: Etape;
  libelle: string;
  nombre: number;
  /**
   * Taux de passage depuis l'etape PRECEDENTE, en pourcentage.
   * `null` pour la premiere etape — il n'y a rien avant elle.
   */
  tauxDepuisPrecedente: number | null;
  /** Taux depuis la toute premiere etape non nulle. `null` si rien en amont. */
  tauxDepuisDebut: number | null;
};

/**
 * Construit l'entonnoir affichable a partir des decomptes bruts.
 *
 * REGLE : on ne divise jamais par zero, et un taux superieur a 100 % est
 * CONSERVE tel quel plutot que plafonne. Il revele un probleme reel —
 * typiquement des inscriptions venues d'ailleurs que du lien de campagne,
 * ou un clic non enregistre. Le masquer rendrait le tableau de bord
 * rassurant et faux.
 */
export function construireEntonnoir(d: Decomptes): LigneEntonnoir[] {
  const premiere = ETAPES.find((e) => d[e] > 0);
  const base = premiere ? d[premiere] : 0;

  return ETAPES.map((etape, i) => {
    const nombre = d[etape];
    const avant = i === 0 ? null : d[ETAPES[i - 1]];

    return {
      etape,
      libelle: LIBELLE_ETAPE[etape],
      nombre,
      tauxDepuisPrecedente:
        avant === null || avant === 0 ? null : pourcent(nombre / avant),
      tauxDepuisDebut: base === 0 ? null : pourcent(nombre / base),
    };
  });
}

/** Arrondi a une decimale : au-dela, la precision est illusoire. */
function pourcent(ratio: number): number {
  return Math.round(ratio * 1000) / 10;
}

/**
 * Cout par inscription, en millimes.
 *
 * `null` si aucun budget n'est renseigne (le budget est optionnel) ou si
 * personne ne s'est inscrit — diviser par zero donnerait l'infini, qu'aucun
 * tableau ne sait afficher utilement.
 *
 * L'argent est en MILLIMES et reste entier : le dinar tunisien a 3 decimales,
 * et passer par un flottant pour de la monnaie finit toujours mal.
 */
export function coutParInscription(
  budgetMillimes: number | null | undefined,
  inscriptions: number,
): number | null {
  if (budgetMillimes === null || budgetMillimes === undefined) return null;
  if (inscriptions <= 0) return null;
  return Math.round(budgetMillimes / inscriptions);
}

/**
 * Deduplique les evenements pour le comptage.
 *
 * Une meme personne qui clique trois fois sur le meme lien, c'est UN
 * visiteur, pas trois. On compte donc les couples (visiteur, etape) distincts
 * et non les lignes brutes.
 *
 * Les evenements SANS visiteur (ceux qui portent un `providerId`, posterieurs
 * a l'inscription) sont dedupliques par salon pour la meme raison : une
 * caisse activee deux fois reste une caisse.
 */
export function compterUniques(
  evenements: Array<{ etape: Etape; visitorId?: string | null; providerId?: string | null }>,
): Decomptes {
  const vus = new Map<Etape, Set<string>>();
  for (const e of ETAPES) vus.set(e, new Set());

  for (const ev of evenements) {
    // La cle est le visiteur OU le salon, selon ce qui identifie l'acteur.
    // Un evenement sans ni l'un ni l'autre est ignore : il ne peut pas etre
    // deduplique, et le compter gonflerait silencieusement les chiffres.
    const cle = ev.visitorId ?? ev.providerId;
    if (!cle) continue;
    vus.get(ev.etape)?.add(cle);
  }

  const d = decomptesVides();
  for (const e of ETAPES) d[e] = vus.get(e)?.size ?? 0;
  return d;
}

/**
 * Est-ce un robot ?
 *
 * Filtre volontairement GROSSIER : il attrape les robots qui s'annoncent, ce
 * qui couvre l'essentiel du bruit (moteurs de recherche, previsualisations de
 * liens dans WhatsApp et Messenger, surveillance). Un robot qui se deguise
 * passera — le detecter demanderait une empreinte de navigateur, c'est-a-dire
 * exactement la collecte de donnees personnelles qu'on s'interdit.
 *
 * Mieux vaut un chiffre honnetement approximatif qu'une fausse precision
 * achetee en pistant les gens.
 */
const MOTIFS_ROBOT =
  /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|preview|scrape|monitor|curl|wget|headless|lighthouse|pingdom|uptime/i;

export function estRobot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true; // pas d'agent du tout = automate
  return MOTIFS_ROBOT.test(userAgent);
}
