"use client";

/**
 * Etape 4 du demarrage : la recompense de fidelite.
 *
 * POURQUOI CETTE ETAPE A ETE REECRITE. Elle demandait trois ratios bruts
 * — « 1 point tous les X DT », « 1 point vaut Y DT », « seuil de retrait » —
 * et envoyait `dinarPerPoint: "0.100"` avec un `pointsPerDinar` inverse en
 * `1/x`. Resultat : un salon sorti de l'assistant valait 0,1 × 0,1 = 1 % de
 * recompense, en dehors des bornes 3–10 % de la page Fidelite, qui lui
 * affichait aussitot un avertissement. L'assistant fabriquait le probleme
 * que la page devait signaler.
 *
 * Elle pose maintenant la MEME question que la page, avec la MEME reglette et
 * les memes ratios canoniques : un seul modele mental, et plus aucun salon
 * cree hors bornes.
 */

import { useState } from "react";
import {
  RECOMPENSE_MAX_PCT,
  RECOMPENSE_MIN_PCT,
  RECOMPENSE_PAS_PCT,
  apercuRecompense,
  cagnotteEnDinars,
  ratiosDepuisPct,
} from "@/lib/rewards/fidelite-affichage";

/** Le reglage propose par defaut : genereux sans entamer la marge. */
const PCT_DEFAUT = 5;

/**
 * Minimum pour utiliser la cagnotte, en points. 100 points = 1 DT avec les
 * ratios canoniques : une cliente peut donc utiliser sa cagnotte des 1 DT,
 * ce qui evite qu'elle attende des mois avant de voir le programme servir.
 */
const MIN_POINTS_DEFAUT = 100;

const MONTANT_APERCU = 100;

export function Step4Loyalty({
  providerId: _providerId,
  onNext,
  onBack,
}: {
  providerId: string;
  onNext: () => void;
  onBack: () => void;
}) {
  const [active, setActive] = useState(true);
  const [pct, setPct] = useState(PCT_DEFAUT);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const apercu = apercuRecompense(pct, MONTANT_APERCU);
  const { dinarPerPoint } = ratiosDepuisPct(pct);
  const minEnDT = cagnotteEnDinars(MIN_POINTS_DEFAUT, dinarPerPoint).replace(".", ",");

  async function enregistrer() {
    setBusy(true);
    setErreur(null);
    try {
      const res = await fetch("/api/pos/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step4: {
            enabled: active,
            // Les ratios canoniques, les memes que `cashbackPctToProgram` :
            // le pourcentage EST le nombre de points par dinar.
            cashbackPct: pct,
            minPointsToRedeem: MIN_POINTS_DEFAUT,
          },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErreur(data?.error ?? "Erreur lors de la sauvegarde");
        return;
      }
      onNext();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border border-brand-line bg-brand-cream/30 p-3">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-pos-accent"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-brand-ink">
            Offrir une cagnotte à mes clientes
          </span>
          <span className="block text-[11px] text-brand-ink-soft">
            Elles gagnent à chaque visite, et paient moins la fois suivante.
          </span>
        </span>
      </label>

      {active && (
        <>
          <div className="rounded-2xl border border-brand-line bg-white p-5">
            <label
              htmlFor="onb-reglette"
              className="block text-sm font-medium text-brand-ink"
            >
              Combien vous offrez sur chaque prestation&nbsp;?
            </label>

            <p className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-semibold text-brand-ink tabular-nums">
                {pct} %
              </span>
              <span className="text-sm text-brand-ink-soft">du prix</span>
            </p>

            <input
              id="onb-reglette"
              type="range"
              min={RECOMPENSE_MIN_PCT}
              max={RECOMPENSE_MAX_PCT}
              step={RECOMPENSE_PAS_PCT}
              value={pct}
              onChange={(e) => setPct(Number(e.target.value))}
              aria-valuetext={`${pct} pour cent du prix`}
              className="fid-reglette mt-4 w-full"
            />
            <div className="mt-1 flex justify-between text-xs text-brand-ink-soft tabular-nums">
              <span>{RECOMPENSE_MIN_PCT} %</span>
              <span>{RECOMPENSE_MAX_PCT} %</span>
            </div>
          </div>

          {/* L'apercu, calcule par les vraies formules de la caisse. */}
          <div
            aria-live="polite"
            className="rounded-2xl bg-pos-ink p-5 text-white"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
              Ce que ça donne
            </p>
            <p className="mt-3 text-2xl font-semibold tabular-nums">
              {MONTANT_APERCU} DT
              <span className="mx-2 text-white/40" aria-hidden>
                →
              </span>
              <span className="text-pos-accent-soft">
                {apercu.valeurDT.replace(".", ",")} DT
              </span>
            </p>
            <p className="mt-1.5 text-sm text-white/70">
              de cagnotte pour votre cliente
            </p>
            <p className="mt-4 border-t border-white/15 pt-3 text-sm italic text-white/85">
              «&nbsp;Prestation b {MONTANT_APERCU} DT, terba7{" "}
              {apercu.valeurDT.replace(".", ",")} DT cagnotte.&nbsp;»
            </p>
            <p className="mt-3 text-xs text-white/50">
              Elle pourra l&apos;utiliser dès {minEnDT} DT. Vous ajusterez tout
              cela plus tard dans Fidélité.
            </p>
          </div>
        </>
      )}

      {erreur && (
        <p className="rounded-lg border border-pos-danger bg-pos-danger-soft px-3 py-2 text-sm text-pos-danger">
          {erreur}
        </p>
      )}

      <div className="flex items-center justify-between border-t border-brand-line pt-4">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] text-sm text-brand-ink-soft hover:text-brand-ink"
        >
          ← Retour
        </button>
        <button
          type="button"
          onClick={enregistrer}
          disabled={busy}
          className="min-h-[44px] rounded-xl bg-pos-accent px-8 font-semibold text-white hover:bg-pos-accent/90 disabled:opacity-50"
        >
          {busy ? "Sauvegarde…" : "Continuer →"}
        </button>
      </div>
    </div>
  );
}
