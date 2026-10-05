"use client";

import { useEffect } from "react";

/**
 * Declare une etape de l'entonnoir au serveur.
 *
 * Composant SANS RENDU : il ne pose aucun element, n'affiche rien, et ne
 * change pas la mise en page. Il est pose sur la landing (VISITE) et sur
 * /pos-start (INSCRIPTION_DEBUT).
 *
 * TOUT ECHEC EST SILENCIEUX. Un bloqueur de publicites, un reseau coupe ou
 * une base indisponible ne doivent jamais casser la page : perdre une
 * statistique est sans gravite, perdre un prospect ne l'est pas.
 */
export function SuiviVisite({ type }: { type: "VISITE" | "INSCRIPTION_DEBUT" }) {
  useEffect(() => {
    // `keepalive` : la requete survit a une navigation immediate. Sans lui,
    // un visiteur qui clique tout de suite sur « Commencer » perdrait sa
    // visite, et le taux de conversion serait surestime.
    fetch("/api/suivi/evenement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
      keepalive: true,
    }).catch(() => {});
  }, [type]);

  return null;
}
