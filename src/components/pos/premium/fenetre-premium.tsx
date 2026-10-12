"use client";

import Link from "next/link";
import { Sparkles, X } from "lucide-react";
import { AVANTAGES_PREMIUM, PRIX_PREMIUM_LIBELLE } from "./contenu";

/**
 * Fenetre qui presente le Premium a la place d'une action refusee (ajouter
 * une employee, par exemple). Elle explique ce qui bloque et mene a
 * /pos/premium, au lieu d'un message d'erreur sans issue.
 */
export function FenetrePremium({
  raison,
  onClose,
}: {
  raison: string;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="fenetre-premium-titre"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-pos-highlight px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-pos-ink">
            <Sparkles size={12} />
            Premium
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="text-pos-ink-3 hover:text-pos-ink"
          >
            <X size={18} />
          </button>
        </div>
        <h2 id="fenetre-premium-titre" className="text-lg font-semibold text-pos-ink">
          {raison}
        </h2>
        <ul className="mt-4 space-y-3">
          {AVANTAGES_PREMIUM.map((a) => (
            <li key={a.titre} className="text-sm">
              <p className="font-semibold text-pos-ink">{a.titre}</p>
              <p className="text-pos-ink-2">{a.texte}</p>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex items-center justify-between gap-3">
          <span className="pos-mono text-sm font-semibold text-pos-ink">{PRIX_PREMIUM_LIBELLE}</span>
          <Link
            href="/pos/premium"
            className="rounded-lg bg-pos-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-pos-accent/90"
          >
            Passer au Premium
          </Link>
        </div>
      </div>
    </div>
  );
}
