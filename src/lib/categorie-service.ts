/**
 * Les categories de services d'un salon — les decisions, sans la base.
 *
 * PROPRES AU SALON, comme les fiches clientes. Un salon de coiffure range ses
 * services en « Cheveux / Barbe / Couleur », un institut en « Visage / Corps /
 * Epilation » : une liste commune ne conviendrait a personne.
 *
 * A NE PAS CONFONDRE avec l'enum `Category` (COIFFURE, ESTHETIQUE…) du
 * schema : celui-la classe un salon pour la place de marche, pas ses services
 * entre eux. Les deux coexistent sans se gener.
 */

/** Longueur maximale d'un nom. Au-dela, l'onglet deborde de l'ecran. */
export const NOM_MAX = 30;
export const NOM_MIN = 2;

/**
 * Nombre maximal de categories par salon.
 *
 * 20 : au-dela, la barre d'onglets devient illisible au comptoir et chercher
 * dans la liste coute plus de temps que taper le nom du service. Ce n'est pas
 * une limite technique, c'est une limite d'usage.
 */
export const CATEGORIES_MAX = 20;

export type VerdictNom =
  | { ok: true; nom: string }
  | { ok: false; message: string };

/**
 * Valide et normalise un nom de categorie.
 *
 * Rend le nom NETTOYE en cas de succes : l'appelant enregistre ce qui sort
 * d'ici, jamais la saisie brute.
 */
export function validerNomCategorie(saisie: unknown): VerdictNom {
  if (typeof saisie !== "string") {
    return { ok: false, message: "Nom invalide" };
  }
  // Les espaces internes multiples sont ramenes a un seul : « Soins   visage »
  // et « Soins visage » doivent etre la MEME categorie, sinon un salon se
  // retrouve avec deux onglets identiques a l'oeil.
  const nom = saisie.trim().replace(/\s+/g, " ");

  if (nom.length < NOM_MIN) {
    return { ok: false, message: `Nom trop court (${NOM_MIN} caractères minimum)` };
  }
  if (nom.length > NOM_MAX) {
    return { ok: false, message: `Nom trop long (${NOM_MAX} caractères maximum)` };
  }
  return { ok: true, nom };
}

/**
 * Deux noms designent-ils la meme categorie ?
 *
 * Comparaison INSENSIBLE a la casse et aux accents : « Cheveux », « cheveux »
 * et « CHEVEUX » sont une seule categorie. Sans cela, un salon finit avec
 * trois onglets qui se ressemblent et des services eparpilles entre eux.
 */
export function memeCategorie(a: string, b: string): boolean {
  return cleComparaison(a) === cleComparaison(b);
}

/** La forme comparable d'un nom : minuscules, sans accents, sans espaces superflus. */
export function cleComparaison(nom: string): string {
  return nom
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .normalize("NFD")
    // Retire les diacritiques : « Épilation » et « Epilation » se confondent.
    .replace(/[̀-ͯ]/g, "");
}

/** Le nom est-il deja pris dans cette liste ? */
export function nomDejaPris(nom: string, existants: string[]): boolean {
  return existants.some((e) => memeCategorie(e, nom));
}

/**
 * Trie les categories pour l'affichage.
 *
 * Par `position` croissante, puis par nom : le salon choisit l'ordre de ses
 * onglets (les plus vendus en premier), et deux categories de meme position
 * restent dans un ordre stable plutot qu'aleatoire.
 */
export function trierCategories<T extends { nom: string; position: number }>(
  categories: T[],
): T[] {
  return [...categories].sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    return a.nom.localeCompare(b.nom, "fr");
  });
}

/**
 * Un service appartient-il a cette categorie ?
 *
 * `null` pour `categorieId` signifie « pas encore classe » — et c'est un etat
 * NORMAL, pas une anomalie : tous les services existants le sont au moment ou
 * cette fonctionnalite arrive. Ils doivent rester visibles.
 */
export function dansCategorie(
  serviceCategorieId: string | null,
  filtreCategorieId: string | null,
): boolean {
  // `null` en filtre = « toutes les categories ».
  if (filtreCategorieId === null) return true;
  return serviceCategorieId === filtreCategorieId;
}

/**
 * Prochaine position libre.
 *
 * Une categorie neuve va EN FIN de liste : l'inserer en tete bousculerait
 * l'ordre que le salon a mis en place, au moment ou il ajoute simplement une
 * ligne.
 */
export function prochainePosition(positions: number[]): number {
  if (positions.length === 0) return 0;
  return Math.max(...positions) + 1;
}
