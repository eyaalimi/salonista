"use client";

/**
 * La modale « Vos règles » — l'ancienne « Configuration du programme ».
 *
 * Elle ne porte PLUS la recompense : celle-la se regle a la reglette, sur la
 * page. Il reste les trois regles secondaires, qu'on ne touche presque
 * jamais.
 *
 * Les champs sont saisis EN POINTS, parce que c'est l'unite que la caisse
 * affiche a l'encaissement — mais chaque champ montre sa valeur en dinars
 * juste en dessous, en direct. Saisir des dinars aurait impose un arrondi
 * invisible (0,015 DT n'est pas un nombre entier de points) et fait
 * divergier les deux ecrans.
 */

import { useState } from "react";
import { cagnotteEnDinars } from "@/lib/rewards/fidelite-affichage";

export type ReglesForm = {
  active: boolean;
  minPointsToRedeem: number;
  maxRedemptionPctPerSale: number;
  welcomeBonusPoints: number;
  birthdayBonusPoints: number;
};

export function ModaleRegles({
  initial,
  dinarPerPoint,
  onFermer,
  onEnregistrer,
}: {
  initial: ReglesForm;
  dinarPerPoint: number;
  onFermer: () => void;
  onEnregistrer: (valeurs: ReglesForm) => Promise<void>;
}) {
  const [form, setForm] = useState<ReglesForm>(initial);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  function enDT(points: number): string {
    return cagnotteEnDinars(Math.max(0, points), dinarPerPoint).replace(".", ",");
  }

  async function enregistrer() {
    setErreur(null);
    if (form.minPointsToRedeem < 0 || form.welcomeBonusPoints < 0 || form.birthdayBonusPoints < 0) {
      setErreur("Les points ne peuvent pas être négatifs.");
      return;
    }
    if (form.maxRedemptionPctPerSale < 0 || form.maxRedemptionPctPerSale > 100) {
      setErreur("La réduction maximum doit être entre 0 et 100 %.");
      return;
    }
    setBusy(true);
    try {
      await onEnregistrer(form);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="fid-regles-titre"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onFermer();
      }}
    >
      <div className="my-auto w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 id="fid-regles-titre" className="text-lg font-semibold text-pos-ink">
          Vos règles
        </h2>

        <label className="mt-5 flex min-h-[44px] items-center gap-3">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
            className="h-5 w-5 accent-pos-accent"
          />
          <span className="text-sm text-pos-ink">
            Fidélité activée pour mes clientes
          </span>
        </label>

        <div className="mt-5 space-y-5">
          <div>
            <label
              htmlFor="fid-min"
              className="block text-sm font-medium text-pos-ink"
            >
              Points minimum pour les utiliser
            </label>
            <input
              id="fid-min"
              type="number"
              min={0}
              value={form.minPointsToRedeem}
              onChange={(e) =>
                setForm({ ...form, minPointsToRedeem: Math.trunc(Number(e.target.value) || 0) })
              }
              className="mt-2 min-h-[44px] w-full rounded-xl border border-pos-border px-3 text-sm tabular-nums focus:border-pos-accent focus:outline-none"
            />
            <p className="mt-1 text-xs text-pos-ink-3 tabular-nums">
              = {enDT(form.minPointsToRedeem)} DT de cagnotte
            </p>
          </div>

          <div>
            <label
              htmlFor="fid-max"
              className="block text-sm font-medium text-pos-ink"
            >
              Réduction maximum sur un ticket
            </label>
            <div className="mt-2 flex items-center gap-2">
              <input
                id="fid-max"
                type="number"
                min={0}
                max={100}
                value={form.maxRedemptionPctPerSale}
                onChange={(e) =>
                  setForm({
                    ...form,
                    maxRedemptionPctPerSale: Math.trunc(Number(e.target.value) || 0),
                  })
                }
                className="min-h-[44px] w-full rounded-xl border border-pos-border px-3 text-sm tabular-nums focus:border-pos-accent focus:outline-none"
              />
              <span className="text-sm text-pos-ink-3">%</span>
            </div>
            <p className="mt-1 text-xs text-pos-ink-3">
              Sur un ticket de 100 DT, au maximum{" "}
              {form.maxRedemptionPctPerSale} DT de réduction.
            </p>
          </div>

          <fieldset>
            <legend className="text-sm font-medium text-pos-ink">
              Points cadeau (bienvenue, anniversaire)
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="fid-bienvenue" className="block text-xs text-pos-ink-2">
                  Bienvenue
                </label>
                <input
                  id="fid-bienvenue"
                  type="number"
                  min={0}
                  value={form.welcomeBonusPoints}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      welcomeBonusPoints: Math.trunc(Number(e.target.value) || 0),
                    })
                  }
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-pos-border px-3 text-sm tabular-nums focus:border-pos-accent focus:outline-none"
                />
                <p className="mt-1 text-xs text-pos-ink-3 tabular-nums">
                  = {enDT(form.welcomeBonusPoints)} DT
                </p>
              </div>
              <div>
                <label htmlFor="fid-anniv" className="block text-xs text-pos-ink-2">
                  Anniversaire
                </label>
                <input
                  id="fid-anniv"
                  type="number"
                  min={0}
                  value={form.birthdayBonusPoints}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      birthdayBonusPoints: Math.trunc(Number(e.target.value) || 0),
                    })
                  }
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-pos-border px-3 text-sm tabular-nums focus:border-pos-accent focus:outline-none"
                />
                <p className="mt-1 text-xs text-pos-ink-3 tabular-nums">
                  = {enDT(form.birthdayBonusPoints)} DT
                </p>
              </div>
            </div>
          </fieldset>
        </div>

        {erreur && (
          <p className="mt-4 rounded-xl bg-pos-danger-soft px-3 py-2 text-sm text-pos-danger">
            {erreur}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onFermer}
            className="min-h-[44px] px-4 text-sm text-pos-ink-2 hover:text-pos-ink"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={enregistrer}
            disabled={busy}
            className="min-h-[44px] rounded-xl bg-pos-accent px-6 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}
