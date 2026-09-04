/**
 * Une vente en especes exige un tiroir OUVERT.
 *
 * On pouvait encaisser tiroir ferme : la vente passait, et son paiement
 * especes n'etait rattache a aucune session (`cashDrawerSessionId` reste
 * null). Consequences en cascade :
 *
 *  - le rapport Z ne voit pas cet argent — `computeSummary` filtre sur
 *    `cashDrawerSessionId`. L'attendu en caisse est donc FAUX ;
 *  - a la fermeture suivante, l'ecart porte sur des especes que personne ne
 *    peut expliquer, et la caissiere est mise en cause a tort ;
 *  - l'argent est physiquement dans un tiroir dont l'ouverture n'a jamais ete
 *    enregistree : aucune trace de qui l'a encaisse.
 *
 * Ouvrir le tiroir est le geste qui declare « je prends la caisse ». Sans
 * lui, la comptabilite de la journee ne tient pas.
 *
 * Decisions pures, sans Prisma, pour rester testables sans mock.
 */

/** Moyens de paiement qui font entrer de l'argent dans le tiroir. */
export const METHODES_ESPECES = ["CASH"] as const;

export type RefusVente = { message: string; status: number };

/**
 * Faut-il refuser cette vente faute de tiroir ouvert ?
 *
 * @param methodes moyens de paiement de la vente.
 * @param tiroirOuvert un tiroir est-il ouvert pour ce salon ?
 * @param depuisSync la vente vient-elle d'une synchronisation hors-ligne ?
 *
 * TROIS CAS OU L'ON N'EXIGE RIEN :
 *
 *  - aucun paiement en especes — une carte ne touche pas le tiroir, et
 *    l'exiger empecherait d'encaisser par carte hors des heures de caisse ;
 *  - vente issue d'une SYNCHRONISATION — elle a eu lieu hors ligne, souvent
 *    avant que le tiroir ne soit ferme. La refuser PERDRAIT une vente deja
 *    encaissee aupres d'une cliente : c'est pire que l'ecart comptable, et
 *    `pos-sale-create` rattache alors la session ouverte a l'heure de la
 *    vente ;
 *  - vente sans aucun paiement (montant nul, offert).
 */
export function refusVenteSansTiroir(
  methodes: readonly string[],
  tiroirOuvert: boolean,
  depuisSync: boolean,
): RefusVente | null {
  if (depuisSync) return null;
  if (tiroirOuvert) return null;

  const aDesEspeces = methodes.some((m) =>
    (METHODES_ESPECES as readonly string[]).includes(m),
  );
  if (!aDesEspeces) return null;

  return {
    message:
      "Ouvre la caisse avant d'encaisser en espèces. Sans tiroir ouvert, " +
      "cet argent n'apparaîtrait pas dans le rapport de fin de journée.",
    // 409 et non 400 : la requete est valide, c'est l'ETAT du salon qui
    // l'empeche. Le client peut reessayer apres avoir ouvert la caisse.
    status: 409,
  };
}

/**
 * Le message a afficher AVANT l'encaissement, dans l'interface.
 *
 * Bloquer au moment de valider, apres avoir compose tout le panier, arrive
 * trop tard : la cliente attend devant le comptoir. On previent des l'ouverture
 * de l'ecran de paiement.
 */
export function alerteCaisseFermee(tiroirOuvert: boolean): string | null {
  if (tiroirOuvert) return null;
  return "La caisse est fermée. Ouvre-la pour encaisser en espèces.";
}
