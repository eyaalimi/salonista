"use client";

import { useMemo, useState } from "react";
import { Gift } from "lucide-react";

export function Step4Loyalty({
  providerId: _providerId,
  onNext,
  onBack,
}: {
  providerId: string;
  onNext: () => void;
  onBack: () => void;
}) {
  const [enabled, setEnabled] = useState(true);
  // dinarsPerPoint = "1 point tous les X DT dépensés"
  const [dinarsPerPoint, setDinarsPerPoint] = useState(10);
  // pointValue = "1 point = Y DT de réduction"
  const [pointValue, setPointValue] = useState("0.100");
  const [minPoints, setMinPoints] = useState(100);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live example: a 100 DT purchase
  const examplePurchase = 100;
  const pointsEarned = useMemo(
    () => Math.floor(examplePurchase / Math.max(1, dinarsPerPoint)),
    [dinarsPerPoint],
  );
  const dinarValueOfMin = useMemo(
    () => (minPoints * Number(pointValue)).toFixed(3),
    [minPoints, pointValue],
  );

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/pos/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step4: {
            enabled,
            pointsPerDinar: dinarsPerPoint, // route inverts to per-DT rate
            dinarPerPoint: pointValue,
            minPointsToRedeem: minPoints,
          },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Erreur lors de la sauvegarde");
        return;
      }
      onNext();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">

      {/* Enable / disable */}
      <label className="flex items-start gap-3 p-3 rounded-lg border border-brand-line bg-brand-cream/30 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="w-4 h-4 mt-0.5 accent-pos-accent shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-brand-ink">
            Activer le programme de fidélité
          </div>
          <div className="text-[11px] text-brand-ink-soft">
            Vos clientes cumulent des points à chaque visite et les utilisent
            en réduction.
          </div>
        </div>
      </label>

      {enabled && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>1 point tous les</Label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={dinarsPerPoint}
                  onChange={(e) =>
                    setDinarsPerPoint(Math.max(1, Number(e.target.value) || 1))
                  }
                  min={1}
                  max={1000}
                  className="w-full px-3 py-2.5 border border-brand-line rounded-lg bg-white text-sm pos-mono text-right focus:border-pos-accent focus:outline-none"
                />
                <span className="text-xs text-brand-ink-soft shrink-0">TND</span>
              </div>
            </div>

            <div>
              <Label>1 point vaut</Label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={pointValue}
                  onChange={(e) => setPointValue(e.target.value)}
                  className="w-full px-3 py-2.5 border border-brand-line rounded-lg bg-white text-sm pos-mono text-right focus:border-pos-accent focus:outline-none"
                />
                <span className="text-xs text-brand-ink-soft shrink-0">TND</span>
              </div>
            </div>

            <div>
              <Label>Seuil de retrait</Label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={minPoints}
                  onChange={(e) =>
                    setMinPoints(Math.max(1, Number(e.target.value) || 1))
                  }
                  min={1}
                  className="w-full px-3 py-2.5 border border-brand-line rounded-lg bg-white text-sm pos-mono text-right focus:border-pos-accent focus:outline-none"
                />
                <span className="text-xs text-brand-ink-soft shrink-0">pts</span>
              </div>
            </div>
          </div>

          {/* Live example */}
          <div className="rounded-2xl border-2 border-pos-accent/30 bg-gradient-to-br from-pos-accent/10 to-pos-accent/5 p-5">
            <div className="flex items-start gap-3">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-pos-accent/20 text-pos-accent shrink-0">
                <Gift size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-[0.18em] text-pos-accent font-semibold mb-1">
                  Exemple en direct
                </div>
                <p className="text-sm text-brand-ink leading-relaxed">
                  Pour une vente de{" "}
                  <strong>{examplePurchase} TND</strong>, la cliente gagne{" "}
                  <strong>{pointsEarned} points</strong>.
                </p>
                <p className="text-sm text-brand-ink-soft mt-1.5 leading-relaxed">
                  Dès <strong>{minPoints} points</strong>, elle peut les utiliser
                  pour <strong>{dinarValueOfMin} TND</strong> de réduction.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-brand-line">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-brand-ink-soft hover:text-brand-ink"
        >
          ← Retour
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="px-8 py-3 rounded-xl bg-pos-accent text-white font-semibold hover:bg-pos-accent/90 disabled:opacity-50"
        >
          {busy ? "Sauvegarde…" : "Continuer →"}
        </button>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft mb-1.5">
      {children}
    </label>
  );
}
