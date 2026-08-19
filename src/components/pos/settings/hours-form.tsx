"use client";

import { useState } from "react";
import { OpeningHoursEditor } from "@/components/opening-hours-editor";
import { emptyOpeningHours, type OpeningHours } from "@/lib/opening-hours";

type Conflict = { startTime: string; offerTitle: string };

function formatConflict(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function HoursForm({ initial }: { initial: OpeningHours | null }) {
  const [hours, setHours] = useState<OpeningHours>(initial ?? emptyOpeningHours());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null);

  /** Ecrit vraiment les horaires. Appele directement s'il n'y a aucun
   *  conflit, ou depuis le dialogue apres confirmation. */
  async function persist() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/provider/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openingHours: hours }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Enregistrement impossible.");
        return;
      }
      setConflicts(null);
      setOk(true);
    } catch {
      setError("Erreur réseau.");
    } finally {
      setBusy(false);
    }
  }

  /** Verifie d'abord les rendez-vous deja pris hors des nouveaux horaires. */
  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setOk(false);
    try {
      const url = `/api/pos/settings/conflicts?openingHours=${encodeURIComponent(
        JSON.stringify(hours),
      )}`;
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Vérification impossible.");
        setBusy(false);
        return;
      }
      if (json.conflicts.length > 0) {
        setConflicts(json.conflicts as Conflict[]);
        setBusy(false);
        return;
      }
    } catch {
      setError("Erreur réseau.");
      setBusy(false);
      return;
    }
    await persist();
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded bg-pos-danger-soft px-3 py-2 text-sm text-pos-danger">{error}</div>
      )}
      {ok && (
        <div className="rounded bg-pos-accent-soft px-3 py-2 text-sm text-pos-accent">
          Horaires enregistrés.
        </div>
      )}

      <OpeningHoursEditor value={hours} onChange={(h) => { setHours(h); setOk(false); }} />

      <p className="text-xs text-pos-ink-3">
        Vos créneaux de réservation sont recalculés sur 30 jours à chaque
        enregistrement.
      </p>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded bg-pos-ink px-4 py-2 text-sm font-medium text-pos-bg disabled:opacity-50"
        >
          {busy ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>

      {conflicts && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-pos-border bg-pos-surface p-5 shadow-2xl"
          >
            <h2 className="text-base font-semibold text-pos-ink">
              {conflicts.length === 1
                ? "1 rendez-vous est déjà pris en dehors de ces horaires"
                : `${conflicts.length} rendez-vous sont déjà pris en dehors de ces horaires`}
            </h2>

            <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-sm text-pos-ink-2">
              {conflicts.map((c, i) => (
                <li key={`${c.startTime}-${i}`}>
                  {formatConflict(c.startTime)} — {c.offerTitle}
                </li>
              ))}
            </ul>

            <p className="mt-3 text-sm text-pos-ink-3">
              Ils seront honorés : vos clientes ont déjà réservé. Vous devrez ouvrir ce
              jour-là ou les contacter.
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConflicts(null)}
                disabled={busy}
                className="rounded border border-pos-border px-3 py-2 text-sm text-pos-ink-2 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={persist}
                disabled={busy}
                className="rounded bg-pos-ink px-3 py-2 text-sm font-medium text-pos-bg disabled:opacity-50"
              >
                {busy ? "Enregistrement…" : "Enregistrer quand même"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
