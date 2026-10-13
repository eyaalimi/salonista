"use client";

/**
 * Signale l'ouverture d'un ecran de la caisse. Ne rend rien.
 *
 * POURQUOI UN COMPOSANT PLUTOT QU'UN APPEL DANS LA PAGE. Les trois pages
 * concernees (Services, Reglages, Caisse) sont des composants SERVEUR : elles
 * lisent la session et interrogent Prisma. Un signal depuis le serveur
 * compterait les prechargements de Next, pas les ouvertures reelles — et
 * rendrait ces pages non cachables. Ce composant ne s'execute donc qu'une
 * fois la page affichee, chez une vraie utilisatrice.
 *
 * La DEDUPLICATION (une visite par employee et par 30 minutes) est cote
 * serveur, dans `enregistrerVisiteEcran` : le navigateur n'a pas a connaitre
 * la regle, et ne pourrait pas la faire respecter d'un onglet a l'autre.
 *
 * Le salon et l'employee ne sont PAS passes en props : la route les lit dans
 * la session. Un composant client ne doit pas pouvoir designer le salon dont
 * il declare l'activite.
 */

import { useEffect } from "react";
import { signalerEvenement } from "@/lib/signaler-evenement";

export function SignalEcran({
  ecran,
}: {
  ecran: "services" | "reglages" | "caisse";
}) {
  useEffect(() => {
    signalerEvenement({ type: "ecran_visite", ecran });
  }, [ecran]);

  return null;
}
