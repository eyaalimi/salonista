"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

/**
 * Bandeau de la caisse qui mene la gerante au Premium. Rendu seulement pour
 * qui a `employees.manage` (gerante, responsable) — une caissiere ne decide
 * pas de l'abonnement et n'a pas a lire ces chiffres.
 *
 * Trois formes :
 * - essai : discret, « Essai Premium : encore N jours » ;
 * - fin d'essai (7 derniers jours) : bien visible, avec ce que le salon
 *   perdrait, chiffre par chiffre ;
 * - gratuit : un rappel qu'on peut masquer pour la journee.
 */
export type BandeauPremiumProps =
  | { variante: "essai"; joursRestants: number }
  | { variante: "fin-essai"; texte: string }
  | { variante: "gratuit" };

const CLE_MASQUE = "salonista-bandeau-gratuit-masque";

function aujourdHui(): string {
  return new Date().toISOString().slice(0, 10);
}

export function BandeauPremium(props: BandeauPremiumProps) {
  // Masquage « pour la journee » : simple confort de la personne, garde dans
  // son navigateur. Faux par defaut — le bandeau s'affiche si le stockage
  // est indisponible.
  const [masque, setMasque] = useState(false);

  useEffect(() => {
    if (props.variante !== "gratuit") return;
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture du stockage local, possible seulement apres le montage
      setMasque(localStorage.getItem(CLE_MASQUE) === aujourdHui());
    } catch {
      // stockage bloque : le bandeau reste visible
    }
  }, [props.variante]);

  if (props.variante === "essai") {
    return (
      <div className="flex shrink-0 items-center justify-center gap-2 border-b border-pos-border bg-pos-bg px-4 py-1 text-xs text-pos-ink-2">
        <span>
          Essai Premium : encore {props.joursRestants} jour{props.joursRestants > 1 ? "s" : ""}
        </span>
        <Link href="/pos/premium" className="font-medium text-pos-ink underline">
          En savoir plus
        </Link>
      </div>
    );
  }

  if (props.variante === "fin-essai") {
    return (
      <div
        role="status"
        className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-pos-warn bg-pos-highlight px-4 py-2.5 text-sm text-pos-ink"
      >
        <p className="min-w-0 flex-1">{props.texte}</p>
        <Link
          href="/pos/premium"
          className="shrink-0 rounded-lg bg-pos-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-pos-accent/90"
        >
          Passer au Premium
        </Link>
      </div>
    );
  }

  if (masque) return null;
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-pos-border bg-pos-highlight px-4 py-1.5 text-xs text-pos-ink">
      <p className="min-w-0">
        Version gratuite. Passez au Premium pour retrouver la fidélité, toute votre équipe et les
        commissions.{" "}
        <Link href="/pos/premium" className="font-semibold underline">
          Passer au Premium
        </Link>
      </p>
      <button
        type="button"
        aria-label="Masquer pour aujourd'hui"
        title="Masquer pour aujourd'hui"
        onClick={() => {
          setMasque(true);
          try {
            localStorage.setItem(CLE_MASQUE, aujourdHui());
          } catch {
            // stockage bloque : masque pour cette page seulement
          }
        }}
        className="shrink-0 rounded p-1 text-pos-ink-3 hover:text-pos-ink"
      >
        <X size={14} />
      </button>
    </div>
  );
}
