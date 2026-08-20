"use client";

import { useState } from "react";
import Link from "next/link";
import type { EtapeDemarrage } from "@/lib/onboarding-salon";

/**
 * Guide de demarrage, affiche tant que les trois etapes ne sont pas faites.
 *
 * Sans lui, un salon inscrit seul reste devant un ecran de caisse sans savoir
 * par ou commencer — il s'inscrit et ne publie jamais rien.
 */
export function DemarrageCard({ etapes }: { etapes: EtapeDemarrage[] }) {
  const [masquee, setMasquee] = useState(false);
  if (masquee) return null;

  const faites = etapes.filter((e) => e.faite).length;

  async function masquer() {
    setMasquee(true);
    await fetch("/api/pos/onboarding/dismiss", { method: "POST" }).catch(() => {
      // Sans reseau la carte reste masquee pour cette visite seulement :
      // acceptable, et mieux que de la faire reapparaitre sous le doigt.
    });
  }

  return (
    <div className="m-4 rounded-[var(--radius-card)] border-2 border-hairline bg-white p-5 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="ds-display text-lg text-prune">Bienvenue sur Salonista</h2>
          <p className="mt-1 text-sm text-prune-soft">
            Encore {3 - faites} étape{3 - faites > 1 ? "s" : ""} avant que les
            clientes puissent réserver chez toi.
          </p>
        </div>
        <button
          type="button"
          onClick={masquer}
          className="ds-focus shrink-0 text-sm text-prune-soft underline"
        >
          Masquer
        </button>
      </div>

      <ol className="mt-4 space-y-2">
        {etapes.map((etape) => (
          <li key={etape.titre}>
            <Link
              href={etape.href}
              className="ds-press ds-focus flex items-start gap-3 rounded-[var(--radius-panel)] border-2 border-hairline p-3 hover:border-rose"
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  etape.faite ? "bg-menthe text-prune" : "bg-rose-soft text-prune"
                }`}
                aria-hidden="true"
              >
                {etape.faite ? "✓" : ""}
              </span>
              <span className="min-w-0">
                <span className="block text-base font-semibold text-prune">
                  {etape.titre}
                  <span className="sr-only">{etape.faite ? " — fait" : " — à faire"}</span>
                </span>
                <span className="block text-sm text-prune-soft">{etape.aide}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
