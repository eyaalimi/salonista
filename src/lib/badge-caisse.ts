/**
 * Le badge « caisse » de la fiche d'appel — decision pure.
 *
 * LE DEFAUT QU'IL CORRIGE. Le badge testait `ventesEncaissees > 0` : il
 * disait donc « a deja vendu », pas « a la caisse ». Un salon abonne, qui
 * avait ouvert son tiroir mais pas encore encaisse, s'affichait « Caisse
 * inactive » — constate en production sur un salon parfaitement equipe.
 *
 * Et « inactive » etait ambigu : impossible de savoir s'il signifiait « pas
 * abonnee » ou « abonnee mais pas utilisee ». Ce sont pourtant deux
 * conversations telephoniques opposees — l'une vend le module, l'autre
 * accompagne une prise en main.
 *
 * On separe donc les deux : le module d'abord, l'usage ensuite.
 */

export type EtatCaisse =
  /** Pas de module POS : il n'y a rien a utiliser. */
  | "sans-module"
  /** Module actif, mais aucune vente ni tiroir — jamais demarree. */
  | "jamais-utilisee"
  /** Tiroir deja ouvert, mais aucune vente encaissee. */
  | "demarree"
  /** Des ventes sont passees. */
  | "active";

export type BadgeCaisse = {
  libelle: string;
  /** `ok` = vert, `neutre` = gris, `alerte` = rose. */
  ton: "ok" | "neutre" | "alerte";
};

/**
 * L'etat de la caisse d'un salon.
 *
 * L'ORDRE DES TESTS COMPTE : sans module, le reste n'a aucun sens — un salon
 * non abonne ne peut ni ouvrir de tiroir ni vendre, et l'afficher « jamais
 * utilisee » lui reprocherait de ne pas se servir de ce qu'il n'a pas.
 */
export function etatCaisse(args: {
  aLeModule: boolean;
  tiroirDejaOuvert: boolean;
  ventesEncaissees: number;
}): EtatCaisse {
  if (!args.aLeModule) return "sans-module";
  if (args.ventesEncaissees > 0) return "active";
  if (args.tiroirDejaOuvert) return "demarree";
  return "jamais-utilisee";
}

/**
 * Le badge a afficher.
 *
 * « Caisse activée » ne parle QUE du module : c'est un fait administratif,
 * verifiable, et il ne se discute pas. L'usage se lit ailleurs sur la fiche
 * — parcours d'activation, tiroir, ventes encaissees — ou il est detaille.
 * Un badge qui melangeait les deux ne pouvait etre juste pour personne.
 */
export function badgeCaisse(etat: EtatCaisse): BadgeCaisse {
  switch (etat) {
    case "sans-module":
      return { libelle: "Sans caisse", ton: "neutre" };
    case "jamais-utilisee":
      return { libelle: "Caisse activée · jamais utilisée", ton: "alerte" };
    case "demarree":
      return { libelle: "Caisse activée · 0 vente", ton: "alerte" };
    case "active":
      return { libelle: "Caisse activée", ton: "ok" };
  }
}
