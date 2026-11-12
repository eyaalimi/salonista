/**
 * Une depense de caisse — decisions pures, sans base.
 *
 * Partage par les DEUX ecrans qui en saisissent : la fenetre « Nouvelle
 * depense » de la page Caisse, et la section Depenses de la fermeture de
 * caisse. Les categories vivaient enfermees dans le premier ; les dupliquer
 * dans le second les aurait fait diverger a la premiere categorie ajoutee.
 *
 * Les regles reprennent celles de `POST /api/pos/drawer/expenses` : montant
 * strictement positif, au plus 10 000 DT, motif obligatoire. Les verifier ici
 * evite un aller-retour qui ne servirait qu'a afficher l'erreur apres coup.
 */

export const CATEGORIES_DEPENSE = [
  { value: "FOURNISSEUR", label: "Fournisseur" },
  { value: "LIVRAISON", label: "Livraison" },
  { value: "AVANCE_SALAIRE", label: "Avance salaire" },
  { value: "ENTRETIEN", label: "Entretien" },
  { value: "AUTRE", label: "Autre" },
] as const;

export type CategorieDepense = (typeof CATEGORIES_DEPENSE)[number]["value"];

/** Meme plafond que la route serveur. */
export const MONTANT_MAX_DEPENSE = 10_000;

export function libelleCategorieDepense(valeur: string): string {
  return CATEGORIES_DEPENSE.find((c) => c.value === valeur)?.label ?? valeur;
}

/**
 * Lit un montant saisi. Accepte la virgule decimale française : « 12,5 » est
 * ce qu'une caissiere tape, et `Number("12,5")` rend `NaN`.
 */
export function lireMontant(texte: string): number | null {
  const t = texte.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Le message a afficher, ou `null` si la depense peut partir. */
export function refusDepense(saisie: { montant: string; motif: string }): string | null {
  const n = lireMontant(saisie.montant);
  if (n === null || n <= 0) return "Indiquez un montant.";
  if (n > MONTANT_MAX_DEPENSE) return `Au plus ${MONTANT_MAX_DEPENSE} DT par dépense.`;
  if (!saisie.motif.trim()) return "Indiquez le motif de la dépense.";
  return null;
}
