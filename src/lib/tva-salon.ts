/**
 * Assujettissement d'un salon a la TVA.
 *
 * Le taux etait porte par chaque offre et chaque produit, avec 19 % en dur
 * comme defaut — a la creation d'une offre (`offers/route.ts`) comme dans le
 * schema. Or la majorite des salons tunisiens ne sont PAS assujettis : ils
 * devaient passer chaque ligne a 0 % a la main, et un oubli affichait une TVA
 * qu'ils ne collectent pas.
 *
 * Le reglage vit desormais au niveau du SALON. Tant qu'il est a « non », le
 * serveur impose 0 % : c'est le seul moyen d'etre sur qu'aucune ligne ne
 * porte de TVA fantome, quel que soit le chemin de creation (formulaire,
 * caisse, assistant, import).
 *
 * Decisions pures, sans Prisma, pour rester testables sans mock.
 */

/** Taux applique quand le salon est assujetti et n'en precise pas d'autre. */
export const TVA_TAUX_DEFAUT = 19;

/** Taux d'un salon non assujetti. Il n'y en a pas d'autre. */
export const TVA_TAUX_EXONERE = 0;

/**
 * Le taux a ENREGISTRER pour une ligne, selon le regime du salon.
 *
 * @param assujetti regime du salon.
 * @param tauxDemande ce que l'appelant propose ; ignore si non assujetti.
 *
 * Un salon non assujetti obtient 0, quoi qu'il demande. C'est volontairement
 * silencieux plutot qu'une erreur : la caisse et l'assistant creent des
 * services sans jamais parler de TVA, les faire echouer serait absurde.
 */
export function tauxTvaApplicable(
  assujetti: boolean,
  tauxDemande?: number | string | null,
): number {
  if (!assujetti) return TVA_TAUX_EXONERE;

  if (tauxDemande === undefined || tauxDemande === null || tauxDemande === "") {
    return TVA_TAUX_DEFAUT;
  }
  const n = Number(tauxDemande);
  if (!Number.isFinite(n) || n < 0 || n > 100) return TVA_TAUX_DEFAUT;
  return n;
}

/**
 * Faut-il montrer la TVA au salon et sur ses documents ?
 *
 * Afficher « TVA incluse : 0% » a un salon non assujetti n'informe personne
 * et laisse croire a un oubli de configuration.
 */
export function afficherTva(assujetti: boolean): boolean {
  return assujetti;
}

export type RefusTva = { message: string };

/**
 * Un salon assujetti doit avoir un matricule fiscal.
 *
 * C'est la mention qui rend une facture valable : declarer la TVA sans
 * matricule produit des tickets inexploitables par la cliente
 * professionnelle.
 */
export function refusRegimeTva(
  assujetti: unknown,
  matriculeFiscal: unknown,
): RefusTva | null {
  if (typeof assujetti !== "boolean") {
    return { message: "Régime de TVA invalide." };
  }
  if (!assujetti) return null;

  if (typeof matriculeFiscal !== "string" || matriculeFiscal.trim() === "") {
    return {
      message:
        "Un salon assujetti à la TVA doit renseigner son matricule fiscal.",
    };
  }
  return null;
}
