/**
 * L'envoi vers l'API Conversions de Meta. La seule partie qui touche le
 * reseau.
 *
 * SEPARE de `meta-conversions.ts` exprès : les decisions (quoi hacher, quoi
 * omettre) y sont testees sans mock HTTP, et ce fichier-ci ne contient plus
 * que la plomberie.
 *
 * TROIS REGLES A NE PAS DEFAIRE
 *
 * 1. **Inerte sans configuration.** Sans `META_PIXEL_ID` ni
 *    `META_CONVERSIONS_TOKEN`, la fonction rend la main immediatement. C'est
 *    ce qui permet de deployer ce code avant d'avoir cree le compte
 *    publicitaire, et de garder un environnement local qui n'envoie rien.
 *
 * 2. **Jamais bloquant, jamais bruyant.** Une inscription de salon ne doit
 *    JAMAIS echouer parce que Meta est lent ou en panne. Toute erreur est
 *    avalee, exactement comme `enregistrerEvenement` du suivi de campagne :
 *    perdre une statistique est sans gravite, perdre un client ne l'est pas.
 *
 * 3. **Un delai d'attente court.** Sans lui, `fetch` peut pendre bien plus
 *    longtemps que la patience de la personne qui vient de cliquer
 *    « Creer mon compte » — c'est l'inscription entiere qui attendrait.
 */

import {
  construireEvenement,
  evenementExploitable,
  type DonneesInscription,
} from "./meta-conversions";

/** Au-dela, on abandonne : l'inscription compte plus que la statistique. */
const DELAI_MS = 3000;

/** Version de l'API Graph. A relever volontairement, jamais par surprise. */
const VERSION_API = "v21.0";

/**
 * Signale a Meta qu'un salon vient de creer son compte.
 *
 * Ne rend rien et ne leve jamais : l'appelant n'a aucune decision a prendre
 * sur la base du resultat.
 *
 * `codeTest` correspond au champ « Test Event Code » du Gestionnaire
 * d'evenements : il permet de voir l'evenement arriver en direct SANS qu'il
 * compte dans les statistiques reelles. Indispensable pour verifier
 * l'installation sans polluer les chiffres avec de fausses inscriptions.
 */
export async function signalerInscriptionAMeta(params: {
  providerId: string;
  donnees: DonneesInscription;
  urlSource?: string;
}): Promise<void> {
  const pixelId = process.env.META_PIXEL_ID;
  const token = process.env.META_CONVERSIONS_TOKEN;

  // Non configure : c'est l'etat normal en local et avant le lancement des
  // publicites. Ce n'est pas une erreur, on ne journalise rien.
  if (!pixelId || !token) return;

  try {
    const evenement = construireEvenement({
      providerId: params.providerId,
      donnees: params.donnees,
      urlSource: params.urlSource,
    });

    // Rien a rapprocher d'une personne : Meta rejetterait l'appel.
    if (!evenementExploitable(evenement)) return;

    const corps: Record<string, unknown> = { data: [evenement] };
    const codeTest = process.env.META_TEST_EVENT_CODE;
    if (codeTest) corps.test_event_code = codeTest;

    await fetch(`https://graph.facebook.com/${VERSION_API}/${pixelId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...corps, access_token: token }),
      signal: AbortSignal.timeout(DELAI_MS),
    });

    // La reponse n'est volontairement PAS inspectee. Meta renvoie 200 avec un
    // corps d'avertissement pour les evenements partiellement valides ; la
    // qualite se verifie dans le Gestionnaire d'evenements, pas ici. Lever
    // sur un 400 ne ferait que risquer de bruiter les journaux d'une route
    // d'inscription.
  } catch {
    // Volontairement muet : reseau coupe, Meta en panne, delai depasse. Rien
    // de tout cela ne concerne la personne qui s'inscrit.
  }
}
