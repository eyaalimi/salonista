/**
 * Decisions pures derriere la page Fidelite — ce qui s'AFFICHE, jamais ce qui
 * se calcule en base.
 *
 * POURQUOI CE MODULE EXISTE. La page montrait « Cashback 3 % », « Solde
 * 600 pts », « Min. points pour echanger 100 » : trois nombres qui ne
 * signifient rien pour une gerante de salon, parce qu'aucun n'est en dinars.
 * Or 1 point ne vaut PAS 1 dinar — il vaut `dinarPerPoint`, soit 0,010 DT
 * dans les ratios canoniques (100 points = 1 DT). Une gerante qui lit
 * « 600 points » croit avoir 600 DT a payer ; elle en a 6.
 *
 * LA REGLE DE CE MODULE : tout ce qui est destine a la gerante sort en
 * DINARS. Les points restent en base, sur les tickets thermiques et dans la
 * caisse (ou la caissiere saisit un nombre de points), mais la page de
 * reglage ne les affiche plus comme un nombre nu.
 *
 * Aucun acces Prisma, aucun React : testable sans base ni DOM.
 */

import { fromMillimes, toMillimes } from "@/lib/money";

/**
 * Bornes de la reglette de recompense, en pourcentage du prix.
 *
 * POURQUOI 3 % AU MINIMUM. En dessous, la recompense ne se voit pas : a 1 %,
 * une prestation de 40 DT rapporte 0,400 DT — la cliente ne changera pas de
 * salon pour cela, et le programme coute au salon sans rien lui rapporter.
 * Au-dessus de 10 %, la marge d'un salon tunisien ne suit plus.
 */
export const RECOMPENSE_MIN_PCT = 3;
export const RECOMPENSE_MAX_PCT = 10;
export const RECOMPENSE_PAS_PCT = 1;

/** Le pourcentage affiche dans l'exemple pedagogique fixe de la page. */
export const EXEMPLE_PCT = 10;

/** `true` si le pourcentage tient dans les bornes de la reglette. */
export function pctDansLesBornes(pct: number): boolean {
  return (
    Number.isFinite(pct) && pct >= RECOMPENSE_MIN_PCT && pct <= RECOMPENSE_MAX_PCT
  );
}

/**
 * Ramene un pourcentage quelconque a la position la plus proche sur la
 * reglette, arrondie au pas.
 *
 * Sert UNIQUEMENT a placer le curseur : la valeur reelle du salon reste
 * affichee a cote (voir `etatRecompense`). Un salon a 1 % voit le curseur sur
 * 3 % et un avertissement, pas une valeur reecrite en silence.
 */
export function serrerDansLesBornes(pct: number): number {
  if (!Number.isFinite(pct)) return RECOMPENSE_MIN_PCT;
  const arrondi = Math.round(pct / RECOMPENSE_PAS_PCT) * RECOMPENSE_PAS_PCT;
  return Math.min(RECOMPENSE_MAX_PCT, Math.max(RECOMPENSE_MIN_PCT, arrondi));
}

export type EtatRecompense = {
  /** Position du curseur, toujours dans les bornes. */
  curseur: number;
  /** Le reglage reel du salon, qui peut etre hors bornes. */
  reel: number;
  /** `true` quand les deux divergent — la page doit alors avertir. */
  horsBornes: boolean;
};

/**
 * Comment afficher le reglage d'un salon dont la valeur peut etre hors
 * bornes.
 *
 * POURQUOI NE PAS MIGRER LES DONNEES. Deux chemins ont cree des salons hors
 * des bornes : le defaut du schema (1 pt/DT × 0,010 = 1 %) et l'assistant de
 * demarrage. Reecrire leur reglage sans leur demander changerait ce que leurs
 * clientes gagnent, sur de l'argent reel. On affiche donc la verite et on
 * laisse la gerante enregistrer.
 */
export function etatRecompense(pctReel: number): EtatRecompense {
  const curseur = serrerDansLesBornes(pctReel);
  return {
    curseur,
    reel: pctReel,
    horsBornes: !pctDansLesBornes(pctReel),
  };
}

/**
 * Points gagnes pour un montant — MEME formule que `computeEarnedPoints`
 * dans earn.ts : `floor(montantDT × pointsPerDinar)`.
 *
 * L'arrondi vers le bas n'est pas un detail : a 3 %, une prestation de 10,5 DT
 * donne floor(31,5) = 31 points, pas 32. Un apercu qui arrondirait a l'unite
 * superieure promettrait un point que la caisse ne donnera pas.
 */
export function pointsGagnes(montantDT: number, pointsPerDinar: number): number {
  if (!Number.isFinite(montantDT) || !Number.isFinite(pointsPerDinar)) return 0;
  if (montantDT <= 0 || pointsPerDinar <= 0) return 0;
  return Math.floor(montantDT * pointsPerDinar);
}

/**
 * Valeur en dinars d'un nombre de points — MEME formule que `redeem.ts` :
 * `round(points × dinarPerPoint × 1000)` millimes.
 *
 * Rend une chaine a 3 decimales, comme toute somme de ce projet.
 */
export function pointsEnDinars(points: number, dinarPerPoint: number): string {
  if (!Number.isFinite(points) || !Number.isFinite(dinarPerPoint)) {
    return fromMillimes(0);
  }
  return fromMillimes(Math.round(points * dinarPerPoint * 1000));
}

/**
 * Les ratios depuis un pourcentage, dans la forme canonique.
 *
 * Reproduit `cashbackPctToProgram` sans l'importer, pour que ce module reste
 * utilisable cote navigateur sans tirer la validation serveur.
 */
export function ratiosDepuisPct(pct: number): {
  pointsPerDinar: number;
  dinarPerPoint: number;
} {
  return { pointsPerDinar: pct, dinarPerPoint: 0.01 };
}

export type ApercuRecompense = {
  /** Le montant de reference de l'apercu, en DT. */
  montant: number;
  /** Points reellement gagnes sur ce montant. */
  points: number;
  /** Leur valeur en dinars, chaine a 3 decimales. */
  valeurDT: string;
};

/**
 * L'apercu « CE QUE CA DONNE » de la carte foncee, recalcule a chaque
 * mouvement de la reglette.
 *
 * Passe par `pointsGagnes` et `pointsEnDinars` — donc par les vraies formules
 * de la caisse, arrondis compris. Un apercu qui multiplierait simplement le
 * montant par le pourcentage mentirait des que l'arrondi mord.
 */
export function apercuRecompense(pct: number, montantDT = 100): ApercuRecompense {
  const { pointsPerDinar, dinarPerPoint } = ratiosDepuisPct(pct);
  const points = pointsGagnes(montantDT, pointsPerDinar);
  return {
    montant: montantDT,
    points,
    valeurDT: pointsEnDinars(points, dinarPerPoint),
  };
}

/**
 * Le plafond de reduction, dit en mots plutot qu'en pourcentage.
 *
 * POURQUOI UNE FRACTION. « 50 % du ticket » demande un calcul mental a
 * chaque vente ; « la moitie du ticket » se comprend d'un coup. On ne nomme
 * que les fractions qui ont un nom courant — au-dela, le pourcentage reste
 * plus clair qu'un « 7/20 » que personne ne lit.
 */
export function fractionLisible(pct: number): string {
  if (!Number.isFinite(pct)) return "—";
  const connues: Array<[number, string]> = [
    [100, "tout"],
    [75, "¾"],
    [50, "½"],
    [33, "⅓"],
    [25, "¼"],
    [20, "⅕"],
    [10, "⅒"],
  ];
  for (const [valeur, libelle] of connues) {
    if (pct === valeur) return libelle;
  }
  return `${pct} %`;
}

export type VisiteExemple = {
  /** Montant de la prestation, en DT. */
  montant: number;
  /** Points gagnes sur cette visite. */
  pointsGagnes: number;
  /** Points depenses sur cette visite. */
  pointsUtilises: number;
  /** Reduction obtenue, chaine a 3 decimales. */
  reductionDT: string;
  /** Ce que la cliente paie reellement, chaine a 3 decimales. */
  payeDT: string;
};

export type ExempleDeuxVisites = {
  visite1: VisiteExemple;
  visite2: VisiteExemple;
  /** Economie totale sur les deux visites, chaine a 3 decimales. */
  economieDT: string;
  /**
   * Pourquoi l'exemple ne peut pas se jouer avec les reglages du salon, ou
   * `null` si tout va bien. La page affiche cette raison au lieu d'un calcul
   * faux.
   */
  impossible: string | null;
};

/**
 * L'exemple pedagogique « VISITE 1 / VISITE 2 / RESULTAT ».
 *
 * Il se joue au pourcentage fixe `EXEMPLE_PCT` (10 %), mais sous les VRAIES
 * regles du salon : minimum de points et plafond de reduction. C'est ce qui
 * evite la contradiction la plus facile a produire ici — des pastilles
 * annoncant « 100 points minimum » juste au-dessus d'un exemple ou la cliente
 * en depense 15.
 *
 * Deux cas rendent l'exemple injouable, et il faut les DIRE :
 *  - les points de la visite 1 n'atteignent pas le minimum du salon ;
 *  - le plafond de reduction mord sur la visite 2.
 * Dans les deux cas la reduction reelle differerait du chiffre affiche.
 */
export function exempleDeuxVisites(args: {
  minPointsToRedeem: number;
  maxRedemptionPctPerSale: number;
  montantVisite1?: number;
  montantVisite2?: number;
}): ExempleDeuxVisites {
  const montant1 = args.montantVisite1 ?? 150;
  const montant2 = args.montantVisite2 ?? 40;
  const { pointsPerDinar, dinarPerPoint } = ratiosDepuisPct(EXEMPLE_PCT);

  const gagnes1 = pointsGagnes(montant1, pointsPerDinar);
  const valeur1M = toMillimes(pointsEnDinars(gagnes1, dinarPerPoint));

  // Le plafond du salon sur la visite 2, en millimes.
  const montant2M = toMillimes(montant2.toFixed(3));
  const plafondM = Math.floor((montant2M * args.maxRedemptionPctPerSale) / 100);

  let impossible: string | null = null;
  if (gagnes1 < args.minPointsToRedeem) {
    impossible = `Avec votre minimum de ${args.minPointsToRedeem} points, la cliente n'en aurait pas assez apres une prestation de ${montant1} DT.`;
  } else if (valeur1M > plafondM) {
    impossible = `Votre plafond de ${args.maxRedemptionPctPerSale} % limiterait la reduction sur une prestation de ${montant2} DT.`;
  }

  // Quand l'exemple est injouable, on montre quand meme la reduction que le
  // salon accorderait vraiment : mieux vaut un chiffre juste et une
  // explication qu'un chiffre rond et faux.
  const reductionM = Math.min(valeur1M, plafondM);
  const utilises = Math.round(reductionM / (dinarPerPoint * 1000));

  const gagnes2 = pointsGagnes(
    (montant2M - reductionM) / 1000,
    pointsPerDinar,
  );

  return {
    visite1: {
      montant: montant1,
      pointsGagnes: gagnes1,
      pointsUtilises: 0,
      reductionDT: fromMillimes(0),
      payeDT: fromMillimes(toMillimes(montant1.toFixed(3))),
    },
    visite2: {
      montant: montant2,
      pointsGagnes: gagnes2,
      pointsUtilises: utilises,
      reductionDT: fromMillimes(reductionM),
      payeDT: fromMillimes(montant2M - reductionM),
    },
    economieDT: fromMillimes(reductionM),
    impossible,
  };
}

/**
 * Un nombre de points rendu en dinars pour la gerante.
 *
 * C'est la fonction que la page utilise partout a la place d'un nombre de
 * points nu : « 6,000 TND » plutot que « 600 points ».
 */
export function cagnotteEnDinars(points: number, dinarPerPoint: number): string {
  return pointsEnDinars(points, dinarPerPoint);
}

/** Le ratio canonique, quand celui du salon est inexploitable. */
export const DINAR_PAR_POINT_DEFAUT = 0.01;

/**
 * Lit `dinarPerPoint` tel que l'API le renvoie — une CHAINE, parce que la
 * colonne est un `Decimal(10, 3)` que Prisma ne degrade jamais en `number`.
 *
 * POURQUOI UN GARDE-FOU. Toute la page divise ou multiplie par ce ratio. S'il
 * arrivait a `0` ou `NaN` — colonne vide, salon a moitie configure, reponse
 * tronquee — chaque montant de la page afficherait « 0,000 DT », y compris la
 * cagnotte de clientes qui ont bel et bien des points. Mieux vaut retomber
 * sur le ratio canonique, qui est celui de la quasi-totalite des salons, que
 * d'afficher zero partout.
 */
export function programToDinarPerPoint(valeur: {
  toString(): string;
} | null | undefined): number {
  if (valeur === null || valeur === undefined) return DINAR_PAR_POINT_DEFAUT;
  const n = Number(valeur.toString());
  if (!Number.isFinite(n) || n <= 0) return DINAR_PAR_POINT_DEFAUT;
  return n;
}
