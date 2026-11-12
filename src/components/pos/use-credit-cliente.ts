"use client";

import { useEffect, useState } from "react";

export type CreditCliente = { totalDu: string; depuis: string | null };

/**
 * Ce que la cliente doit deja au salon — pour la pastille de la modale
 * d'encaissement et le badge du panneau cliente.
 *
 * Le resultat est range AVEC la cliente qu'il concerne : en changer ne
 * demande aucune remise a zero synchrone dans l'effet (ce que le compilateur
 * React refuse), l'ancienne reponse ne correspond simplement plus.
 *
 * `cle` force un rechargement (apres un reglement, par exemple).
 */
export function useCreditCliente(
  customerId: string | null,
  actif: boolean,
  cle = 0,
): CreditCliente | null {
  const [etat, setEtat] = useState<{ pour: string; cle: number; data: CreditCliente } | null>(null);

  useEffect(() => {
    if (!customerId || !actif) return;
    let vivant = true;
    fetch(`/api/pos/customers/${customerId}/credit`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: CreditCliente | null) => {
        if (vivant && d) setEtat({ pour: customerId, cle, data: d });
      })
      .catch(() => {
        // Hors ligne ou erreur : pas de pastille plutot qu'une fausse.
      });
    return () => {
      vivant = false;
    };
  }, [customerId, actif, cle]);

  if (!customerId || !etat || etat.pour !== customerId) return null;
  return etat.data;
}
