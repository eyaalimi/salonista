/**
 * Validation du titre d'une offre publiee.
 *
 * Trois des six offres visibles sur l'accueil s'appelaient « test » ou
 * « test0 » : indexees par Google, presentes dans le sitemap, et premiere
 * impression d'un visiteur arrivant par la recherche. Elles etaient
 * parfaitement valides pour le code — rien ne verifiait le titre.
 *
 * Ce garde-fou porte sur la PUBLICATION, pas sur la creation : un salon doit
 * pouvoir garder un service nomme « x » dans sa caisse pour ses propres
 * besoins. Ce qui est interdit, c'est de l'exposer au public.
 */

/** Ce qui ressemble a un titre de test : `test`, `test0`, `TEST 12`… */
const MOTIF_TEST = /^test\s*\d*$/i;

/** Longueur minimale d'un titre publiable. */
export const TITRE_MIN = 3;

export type RefusTitre = {
  message: string;
  status: number;
};

/**
 * Ce titre peut-il partir sur la place de marche ?
 *
 * @returns `null` si le titre convient, sinon le refus a renvoyer.
 */
export function refusTitreOffre(titre: string): RefusTitre | null {
  const t = titre.trim();

  if (t.length < TITRE_MIN) {
    return {
      message: `Le titre doit contenir au moins ${TITRE_MIN} caractères.`,
      status: 400,
    };
  }

  if (MOTIF_TEST.test(t)) {
    return {
      message:
        "« " +
        t +
        " » ressemble à un titre de test. Donnez un nom que vos clientes comprendront.",
      status: 400,
    };
  }

  return null;
}
