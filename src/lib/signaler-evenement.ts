/**
 * Signaler un evenement depuis le navigateur, sans jamais gener la caisse.
 *
 * `keepalive` : la requete survit a un changement de page. Sans lui, une
 * caissiere qui ouvre le paiement puis navigue aussitot perdrait le signal —
 * et c'est precisement le cas qu'on cherche a mesurer.
 *
 * Aucune valeur de retour, aucune erreur propagee : hors ligne, la requete
 * echoue et c'est sans consequence. Le mode hors ligne de la caisse est
 * nominal, pas exceptionnel ; un signal perdu ne vaut pas une erreur a
 * l'ecran.
 */

type SignalClient =
  | { type: "paiement_ouvert" }
  | { type: "ecran_visite"; ecran: "services" | "reglages" | "caisse" }
  /** Etape de l'assistant affichee — `etape` va de 1 a 5. */
  | { type: "onboarding_etape"; etape: number }
  | { type: "onboarding_termine"; etape?: number }
  /** « Quitter sans terminer » : `etape` dit OU la gerante s'est arretee. */
  | { type: "onboarding_quitte"; etape: number };

export function signalerEvenement(signal: SignalClient): void {
  try {
    void fetch("/api/pos/evenement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(signal),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // `fetch` indisponible (rendu serveur, navigateur ancien) : on n'insiste pas.
  }
}
