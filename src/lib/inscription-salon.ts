/**
 * Etape 1 de l'assistant /pos/bienvenue — decisions pures, sans Prisma.
 *
 * DEUX INCOHERENCES ENTRE L'INSCRIPTION ET LE PROFIL, corrigees ici.
 *
 * 1. LA VILLE. Le profil range la DELEGATION dans la colonne `city`, avec un
 *    gouvernorat a part, et refuse un couple qui n'existe pas
 *    (`refusAdresseSalon`). L'etape 1, elle, y ecrivait du TEXTE LIBRE sans
 *    rien verifier : une gerante qui tapait « Tunis » se retrouvait avec
 *    « Tunis » comme delegation (ce n'en est pas une) et aucun gouvernorat.
 *    Ouvrant son profil, elle voyait « Selectionner un gouvernorat… » vide et
 *    devait tout ressaisir. On pose desormais les memes deux listes, avec la
 *    meme verification.
 *
 * 2. LA CATEGORIE. L'etape 1 propose PLUSIEURS types de prestations — ils
 *    servent a pre-remplir les services de l'etape 2 — mais le profil n'a
 *    qu'UNE categorie. Le premier type CLIQUE devenait la categorie, sans que
 *    rien ne le dise a l'ecran. On le rend explicite : une « principale »,
 *    visible et modifiable, et c'est elle que le profil affichera.
 */

import { delegationAppartient, gouvernoratExiste } from "./tunisie-geo";

/** Les categories que la base accepte — l'enum Prisma `Category`. */
export const CATEGORIES = [
  "COIFFURE",
  "ESTHETIQUE",
  "ONGLERIE",
  "MASSAGE",
  "PARFUMERIE",
  "AUTRE",
] as const;

export type Categorie = (typeof CATEGORIES)[number];

export function estCategorie(valeur: unknown): valeur is Categorie {
  return typeof valeur === "string" && (CATEGORIES as readonly string[]).includes(valeur);
}

/* ------------------------------------------------------------------ *
 *  LA CATEGORIE PRINCIPALE
 * ------------------------------------------------------------------ */

export type ChoixTypes = {
  /** Les types coches, dans l'ordre ou ils l'ont ete. */
  types: string[];
  /** Celui qui deviendra la categorie du profil, ou `null` si rien n'est coche. */
  principale: string | null;
};

/**
 * Coche ou decoche un type, en gardant TOUJOURS une principale valide.
 *
 * Trois regles :
 *  - le premier type coche devient principal — c'etait deja le comportement,
 *    il reste le bon defaut ;
 *  - decocher la principale la transmet au type suivant, plutot que de la
 *    laisser pointer sur un type qui n'est plus coche ;
 *  - decocher le dernier type vide la principale.
 */
export function basculerType(choix: ChoixTypes, valeur: string): ChoixTypes {
  const coche = choix.types.includes(valeur);
  if (!coche) {
    const types = [...choix.types, valeur];
    return { types, principale: choix.principale ?? valeur };
  }
  const types = choix.types.filter((t) => t !== valeur);
  const principale =
    choix.principale === valeur ? (types[0] ?? null) : choix.principale;
  return { types, principale };
}

/**
 * Designe un type comme principal. Sans effet si le type n'est pas coche :
 * une categorie de profil doit correspondre a une prestation effectivement
 * proposee.
 */
export function choisirPrincipale(choix: ChoixTypes, valeur: string): ChoixTypes {
  if (!choix.types.includes(valeur)) return choix;
  return { ...choix, principale: valeur };
}

/**
 * La liste des types, la principale EN TETE.
 *
 * C'est l'ordre qu'on stocke pour l'etape 2 : les services pre-remplis du
 * metier principal passent ainsi en premier.
 */
export function typesOrdonnes(choix: ChoixTypes): string[] {
  if (!choix.principale) return choix.types;
  return [choix.principale, ...choix.types.filter((t) => t !== choix.principale)];
}

/**
 * Le point de depart quand l'assistant se rouvre.
 *
 * La categorie ENREGISTREE fait foi : si la gerante l'a changee dans son
 * profil entre-temps, l'assistant doit refleter ce changement, pas le choix
 * memorise par le navigateur. Les autres types memorises la suivent.
 */
export function choixInitial(
  categorieProfil: string | null | undefined,
  typesMemorises: readonly string[],
): ChoixTypes {
  const memorises = typesMemorises.filter(estCategorie);
  if (!estCategorie(categorieProfil)) {
    return { types: memorises, principale: memorises[0] ?? null };
  }
  const types = [categorieProfil, ...memorises.filter((t) => t !== categorieProfil)];
  return { types, principale: categorieProfil };
}

/* ------------------------------------------------------------------ *
 *  LA LOCALISATION
 * ------------------------------------------------------------------ */

/**
 * Le gouvernorat et la delegation de l'etape 1 sont-ils valides ?
 *
 * OBLIGATOIRES tous les deux — deux listes, deux touches, et c'est ce qui
 * remplit vraiment le profil. La RUE reste facultative ici, pour ne pas
 * alourdir l'inscription ; le profil l'exigera plus tard (voir
 * `refusAdresseSalon`).
 *
 * Le COUPLE est verifie, pas seulement chaque champ : « Sousse / La Marsa »
 * est refuse, la Marsa n'etant pas une delegation de Sousse.
 */
export function refusLocalisationInscription(
  gouvernorat: unknown,
  delegation: unknown,
): { message: string } | null {
  if (!gouvernoratExiste(gouvernorat)) {
    return { message: "Sélectionnez votre gouvernorat." };
  }
  if (!delegationAppartient(gouvernorat, delegation)) {
    return { message: "Sélectionnez une délégation de votre gouvernorat." };
  }
  return null;
}

/* ------------------------------------------------------------------ *
 *  LE RATTRAPAGE DES SALONS DEJA INSCRITS
 * ------------------------------------------------------------------ */

export type Reparation =
  /** Rien a faire : adresse deja propre, ou vide. */
  | { action: "aucune" }
  /** La « ville » saisie est un gouvernorat : on la range a sa place. */
  | { action: "gouvernorat"; gouvernorat: string }
  /** Valeur ininterpretable : listee pour un humain, jamais modifiee. */
  | { action: "ambigu"; valeur: string };

/**
 * Que faire de l'adresse d'un salon inscrit AVANT ce correctif ?
 *
 * Le seul cas sur : la « ville » tapee librement est EXACTEMENT un nom de
 * gouvernorat (« Tunis », « Sousse »). Elle passe alors en gouvernorat, et la
 * fausse delegation est videe — la gerante n'aura plus qu'a choisir la sienne
 * dans la liste.
 *
 * Tout le reste est laisse en l'etat et signale : deviner une delegation a
 * partir d'une saisie libre (« Menzah 6 », « tunis centre ») ecrirait une
 * adresse fausse avec l'apparence d'une adresse juste.
 */
export function reparerAdresse(salon: {
  city: string | null;
  governorate: string | null;
}): Reparation {
  const ville = salon.city?.trim() ?? "";
  if (!ville) return { action: "aucune" };

  // Deja coherent : rien a faire.
  if (salon.governorate && delegationAppartient(salon.governorate, ville)) {
    return { action: "aucune" };
  }

  if (!salon.governorate && gouvernoratExiste(ville)) {
    return { action: "gouvernorat", gouvernorat: ville };
  }

  return { action: "ambigu", valeur: ville };
}
