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

/**
 * Signale l'installation de la PWA.
 *
 * L'evenement `appinstalled` n'etait ecoute NULLE PART dans le projet :
 * `pwa-install-prompt.tsx` n'ecoute que `beforeinstallprompt`, qui dit
 * seulement que l'installation est POSSIBLE, pas qu'elle a eu lieu.
 *
 * Pose dans le layout de la caisse, la ou un salon installe reellement
 * l'application.
 *
 * LIMITE CONNUE : `appinstalled` n'existe pas sur Safari iOS. Une salon qui
 * installe depuis un iPhone ne sera donc PAS comptee. Le chiffre est un
 * plancher, pas un total — a garder en tete en lisant le tableau de bord.
 */
export function SuiviInstallation() {
  useEffect(() => {
    const signaler = () => {
      fetch("/api/suivi/evenement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "APP_INSTALLEE" }),
        keepalive: true,
      }).catch(() => {});
    };

    window.addEventListener("appinstalled", signaler);
    return () => window.removeEventListener("appinstalled", signaler);
  }, []);

  return null;
}
