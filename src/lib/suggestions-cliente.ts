/**
 * Suggestions de clientes a la saisie du NOM — decision pure, sans base.
 *
 * Dans la prise de rendez-vous, taper un numero proposait deja les clientes
 * connues ; taper un NOM ne proposait rien. Pour une ancienne cliente dont on
 * ne retient que le prenom, il fallait retrouver son numero ailleurs — ou on
 * lui creait une seconde fiche, avec un historique et une cagnotte vides.
 *
 * DES LA PREMIERE LETTRE, SUR LE DEBUT DU NOM. Une caissiere qui tape « f »
 * cherche Fatma ou Ferchichi, pas Raoufa : on retient donc les clientes dont
 * un MOT du nom commence par la saisie. Chercher « n'importe ou dans le nom »
 * sur une seule lettre ramenerait presque toute la clientele.
 */

export type ClienteSuggeree = {
  id: string;
  phone: string;
  firstName: string | null;
  lastName: string | null;
};

/** Combien de suggestions au plus : au-dela, la liste cache le formulaire. */
export const SUGGESTIONS_MAX = 5;

/**
 * Minuscules, sans accents, espaces reduits.
 *
 * Sans le retrait des accents, « elodie » ne trouverait pas « Élodie », et
 * une caissiere sur une tablette sans clavier français ne pourrait jamais
 * taper le « É ».
 */
export function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function nomComplet(c: ClienteSuggeree): string {
  return [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
}

/**
 * Les clientes dont le nom commence par la saisie.
 *
 * Retenue si :
 *  - le nom complet commence par la saisie (« fatma b » → Fatma Ben Ali) ;
 *  - OU l'un de ses mots commence par la saisie (« ben » → Fatma Ben Ali).
 *
 * ORDRE : les correspondances sur le PRENOM d'abord — c'est par lui qu'on
 * appelle une cliente au comptoir — puis l'ordre alphabetique, pour que la
 * liste ne change pas d'un caractere a l'autre sans raison.
 *
 * Les fiches sans aucun nom sont ignorees : elles ne peuvent pas correspondre
 * a ce qu'on tape, et une ligne vide dans la liste n'aiderait personne.
 */
export function suggestionsParNom<T extends ClienteSuggeree>(
  clientes: readonly T[],
  saisie: string,
  limite: number = SUGGESTIONS_MAX,
): T[] {
  const q = normaliser(saisie);
  if (!q) return [];

  const retenues: Array<{ c: T; prenomDabord: boolean; cle: string }> = [];
  for (const c of clientes) {
    const nom = normaliser(nomComplet(c));
    if (!nom) continue;
    const mots = nom.split(" ");
    if (!nom.startsWith(q) && !mots.some((m) => m.startsWith(q))) continue;
    retenues.push({
      c,
      prenomDabord: normaliser(c.firstName ?? "").startsWith(q),
      cle: nom,
    });
  }

  return retenues
    .sort((a, b) => {
      if (a.prenomDabord !== b.prenomDabord) return a.prenomDabord ? -1 : 1;
      return a.cle.localeCompare(b.cle, "fr");
    })
    .slice(0, limite)
    .map((r) => r.c);
}

/**
 * Le telephone a afficher, ou `null`.
 *
 * Une cliente enregistree sans numero porte un identifiant interne
 * `walk-in-…` (voir `placeholderTelephone`). Il n'a rien a faire a l'ecran :
 * le montrer laisserait croire a un numero, et il ne sert a personne au
 * comptoir.
 */
export function telephoneAffichable(phone: string | null | undefined): string | null {
  if (!phone || phone.startsWith("walk-in-")) return null;
  return phone;
}
