"use client";

import { useEffect } from "react";

/**
 * Signale l'installation de la PWA a l'entonnoir d'acquisition.
 *
 * FICHIER SEPARE DE `suivi-visite.tsx`, ET C'EST VOLONTAIRE.
 *
 * Ce composant est importe par `src/app/(pos)/layout.tsx`, qui charge aussi
 * `next/font/google` (IBM Plex Sans et Mono). Quand les deux composants
 * vivaient dans le meme module, le build Turbopack echouait avec
 * « Can't resolve '@vercel/turbopack-next/internal/font/google/font' » et
 * 24 erreurs sur les faces de police — alors que `npm run dev` fonctionnait.
 *
 * Le symptome n'apparait qu'au BUILD, et seulement sans cache : un
 * `rm -rf .next` est necessaire pour le reproduire. C'est ce qui l'a fait
 * passer en local et casser dans GitHub Actions, qui part toujours propre.
 *
 * Garder ce composant seul dans son fichier evite le probleme. Ne le
 * refusionnez pas avec `suivi-visite.tsx` sans verifier `npm run build`
 * apres un `rm -rf .next`.
 *
 * LIMITE CONNUE : `appinstalled` n'existe pas sur Safari iOS. Un salon qui
 * installe depuis un iPhone ne sera donc PAS compte — le chiffre est un
 * plancher, pas un total.
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
