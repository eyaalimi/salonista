"use client";
import { useState } from "react";

type Provider = {
  id: string;
  _count: {
    offers: number;
    products: number;
    employees: number;
    sales: number;
    cashDrawerSessions: number;
  };
};

type Added = {
  id: string;
  title: string;
  discountPrice: string;
  durationMinutes: number;
};

const CHIPS: { label: string; duration: number }[] = [
  { label: "Brushing", duration: 30 },
  { label: "Coupe femme", duration: 45 },
  { label: "Coupe homme", duration: 20 },
  { label: "Couleur", duration: 90 },
  { label: "Mèches", duration: 120 },
  { label: "Lissage", duration: 120 },
  { label: "Soin visage", duration: 60 },
  { label: "Manucure", duration: 30 },
  { label: "Pédicure", duration: 45 },
  { label: "Épilation sourcils", duration: 15 },
];

const ALLOWED_DURATIONS = [15, 20, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240];

export function Step2Services({
  provider,
  onAdded,
  onNext,
  onBack,
}: {
  provider: Provider;
  onAdded: (p: Provider) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState(30);
  const [added, setAdded] = useState<Added[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addOne() {
    if (!title.trim() || Number(price) <= 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          discountPrice: price,
          durationMinutes: duration,
          publishedToMarketplace: false,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error ?? "Erreur");
        return;
      }
      setAdded((arr) => [...arr, json]);
      onAdded({
        ...provider,
        _count: { ...provider._count, offers: provider._count.offers + 1 },
      });
      setTitle("");
      setPrice("");
    } finally {
      setBusy(false);
    }
  }

  function applyChip(label: string, dur: number) {
    setTitle(label);
    setDuration(dur);
  }

  const canContinue = added.length > 0 || provider._count.offers > 0;

  return (
    <div className="max-w-2xl">
      <p className="text-sm text-pos-ink-2 mb-3">
        Cliquez sur une suggestion ou tapez un nom :
      </p>
      <div className="flex flex-wrap gap-2 mb-5">
        {CHIPS.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => applyChip(c.label, c.duration)}
            className="px-3 py-1 rounded-full border border-pos-border text-sm hover:bg-pos-card"
          >
            {c.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-3 px-3 py-2 rounded bg-red-50 text-red-800 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-12 gap-2 mb-3 px-3 py-2 rounded border border-pos-border-strong">
        <input
          className="col-span-5 px-2 py-1 rounded border border-pos-border bg-white"
          placeholder="Nom du service"
          aria-label="Nom du service"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addOne();
          }}
        />
        <input
          className="col-span-3 px-2 py-1 rounded border border-pos-border bg-white"
          type="number"
          step="0.001"
          min="0.001"
          placeholder="Prix DT"
          aria-label="Prix en DT"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addOne();
          }}
        />
        <select
          className="col-span-2 px-2 py-1 rounded border border-pos-border bg-white"
          aria-label="Durée en minutes"
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
        >
          {ALLOWED_DURATIONS.map((d) => (
            <option key={d} value={d}>
              {d} min
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={busy || !title.trim() || Number(price) <= 0}
          onClick={addOne}
          className="col-span-2 px-3 py-1 rounded bg-pos-ink text-pos-bg disabled:opacity-50"
        >
          Ajouter
        </button>
      </div>

      {added.length > 0 && (
        <ul className="text-sm mb-4">
          {added.map((a) => (
            <li key={a.id} className="py-1 border-t border-pos-border">
              {a.title} — {Number(a.discountPrice).toFixed(3)} DT — {a.durationMinutes} min
            </li>
          ))}
        </ul>
      )}

      <div className="flex justify-between pt-2">
        <button type="button" onClick={onBack} className="text-sm text-pos-ink-3">
          ← Précédent
        </button>
        <button
          type="button"
          disabled={!canContinue}
          onClick={onNext}
          className="px-5 py-2 rounded bg-pos-ink text-pos-bg disabled:opacity-50"
        >
          Suivant →
        </button>
      </div>
    </div>
  );
}
