/**
 * Le compte rendu d'un appel de support — decisions pures, sans Prisma.
 *
 * Une `SupportNote` etait jusqu'ici du texte libre : excellent pour se
 * souvenir, inutilisable pour organiser une tournee d'appels. On ne pouvait
 * pas repondre a « qui dois-je rappeler aujourd'hui ? » sans relire toutes
 * les notes une par une.
 *
 * Trois champs y repondent, et ils sont tous OPTIONNELS pour les notes
 * existantes : `resultat` est nul sur les anciennes, et le restera. Une note
 * sans resultat n'est pas une note cassee, c'est une note ecrite avant que
 * ce champ existe.
 */

/**
 * Comment l'appel s'est termine.
 *
 * Quatre issues, et pas une de plus : au telephone on remplit ce champ en
 * raccrochant, souvent avec la cliente suivante qui attend. Une liste plus
 * fine serait remplie au hasard, et des statistiques fausses valent moins que
 * pas de statistiques.
 */
export const RESULTATS_APPEL = {
  JOINT: "JOINT",
  PAS_DE_REPONSE: "PAS_DE_REPONSE",
  A_RAPPELER: "A_RAPPELER",
  PAS_INTERESSE: "PAS_INTERESSE",
} as const;

export type ResultatAppel = (typeof RESULTATS_APPEL)[keyof typeof RESULTATS_APPEL];

export const LIBELLE_RESULTAT: Record<ResultatAppel, string> = {
  JOINT: "Joint",
  PAS_DE_REPONSE: "Pas de réponse",
  A_RAPPELER: "À rappeler",
  PAS_INTERESSE: "Pas intéressé",
};

export function estResultatAppel(valeur: unknown): valeur is ResultatAppel {
  return (
    typeof valeur === "string" &&
    Object.prototype.hasOwnProperty.call(RESULTATS_APPEL, valeur)
  );
}

/** Assez pour un compte rendu d'appel, pas assez pour y coller un roman. */
export const CONTENU_MAX = 2000;
export const CONTENU_MIN = 3;

export type EntreeCompteRendu = {
  contenu?: unknown;
  resultat?: unknown;
  rappelLe?: unknown;
  blocageLeve?: unknown;
};

export type CompteRenduValide = {
  contenu: string;
  resultat: ResultatAppel | null;
  rappelLe: Date | null;
  blocageLeve: boolean;
};

export type ErreurCompteRendu = { erreur: string };

/**
 * Valide et normalise un compte rendu recu de l'interface.
 *
 * DEUX REGLES QUI NE SE DEVINENT PAS :
 *
 *  - un resultat « À rappeler » SANS date de rappel est refuse. C'est tout
 *    l'interet du champ : une promesse de rappel sans date ne ressort dans
 *    aucune liste, et le salon n'est jamais rappele. L'inverse est tolere —
 *    poser une date apres un appel « Joint » est legitime (« il m'a demande
 *    de le reprendre lundi ») ;
 *  - une date de rappel dans le PASSE est refusee. Elle viendrait d'une faute
 *    de frappe (2025 pour 2026), et placerait le salon en tete des rappels
 *    du jour pour toujours.
 */
export function validerCompteRendu(
  entree: EntreeCompteRendu,
  maintenant: Date = new Date(),
): CompteRenduValide | ErreurCompteRendu {
  const contenu =
    typeof entree.contenu === "string" ? entree.contenu.trim().slice(0, CONTENU_MAX) : "";
  if (contenu.length < CONTENU_MIN) {
    return { erreur: "Note trop courte" };
  }

  let resultat: ResultatAppel | null = null;
  if (entree.resultat !== undefined && entree.resultat !== null && entree.resultat !== "") {
    if (!estResultatAppel(entree.resultat)) {
      return { erreur: "Résultat d'appel inconnu" };
    }
    resultat = entree.resultat;
  }

  let rappelLe: Date | null = null;
  if (entree.rappelLe !== undefined && entree.rappelLe !== null && entree.rappelLe !== "") {
    if (typeof entree.rappelLe !== "string" && !(entree.rappelLe instanceof Date)) {
      return { erreur: "Date de rappel invalide" };
    }
    const d = entree.rappelLe instanceof Date ? entree.rappelLe : new Date(entree.rappelLe);
    if (Number.isNaN(d.getTime())) {
      return { erreur: "Date de rappel invalide" };
    }
    if (d.getTime() < maintenant.getTime()) {
      return { erreur: "La date de rappel est déjà passée" };
    }
    rappelLe = d;
  }

  if (resultat === RESULTATS_APPEL.A_RAPPELER && rappelLe === null) {
    return { erreur: "Indiquez quand rappeler ce salon" };
  }

  return {
    contenu,
    resultat,
    rappelLe,
    blocageLeve: entree.blocageLeve === true,
  };
}

export function estErreur(
  r: CompteRenduValide | ErreurCompteRendu,
): r is ErreurCompteRendu {
  return "erreur" in r;
}

/**
 * Ce rappel est-il du ? (aujourd'hui ou en retard)
 *
 * La comparaison porte sur la FIN de la journee visee, pas sur l'instant : un
 * rappel pose « pour le 14 » doit apparaitre toute la journee du 14, pas
 * seulement a partir de l'heure ou il a ete saisi.
 */
export function rappelEstDu(rappelLe: Date | null, maintenant: Date = new Date()): boolean {
  if (!rappelLe) return false;
  const finDuJour = new Date(maintenant);
  finDuJour.setHours(23, 59, 59, 999);
  return rappelLe.getTime() <= finDuJour.getTime();
}

/**
 * Cet appel a-t-il ete passe aujourd'hui ?
 *
 * Sert a l'onglet « Faits aujourd'hui ». Seules les notes PORTANT UN RESULTAT
 * comptent : une note libre ajoutee a une fiche n'est pas un appel passe.
 */
export function faitAujourdhui(
  note: { resultat: string | null; createdAt: Date },
  maintenant: Date = new Date(),
): boolean {
  if (!note.resultat) return false;
  const debut = new Date(maintenant);
  debut.setHours(0, 0, 0, 0);
  const fin = new Date(maintenant);
  fin.setHours(23, 59, 59, 999);
  const t = note.createdAt.getTime();
  return t >= debut.getTime() && t <= fin.getTime();
}
