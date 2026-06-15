"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { SERVICE_PRESETS, type ServicePreset } from "@/lib/onboarding-presets";

type Provider = {
  id: string;
  category?: string;
  _count: { offers: number };
};

type Line = {
  title: string;
  durationMinutes: number;
  price: string;
  selected: boolean;
  custom: boolean;
};

export function Step2Services({
  provider,
  onAdded,
  onNext,
  onBack,
}: {
  provider: Provider;
  onAdded: (p: Partial<Provider>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const category = provider.category ?? "AUTRE";
  const presets: ServicePreset[] =
    SERVICE_PRESETS[category] ?? SERVICE_PRESETS.AUTRE;

  // Initial state: every preset shown, all selected by default for a fast
  // happy path. The salon unchecks what they don't offer.
  const initial: Line[] = useMemo(
    () =>
      presets.map((p) => ({
        title: p.title,
        durationMinutes: p.durationMinutes,
        price: p.price,
        selected: true,
        custom: false,
      })),
    [presets],
  );
  const [lines, setLines] = useState<Line[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function addCustom() {
    setLines((prev) => [
      ...prev,
      {
        title: "",
        durationMinutes: 30,
        price: "20.000",
        selected: true,
        custom: true,
      },
    ]);
  }

  function remove(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  const selectedCount = lines.filter((l) => l.selected && l.title.trim()).length;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const services = lines
        .filter((l) => l.selected && l.title.trim())
        .map((l) => ({
          title: l.title.trim(),
          durationMinutes: l.durationMinutes,
          price: l.price,
        }));
      const res = await fetch("/api/pos/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step2: { services } }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Erreur lors de la sauvegarde");
        return;
      }
      onAdded({ _count: { ...provider._count, offers: services.length } });
      onNext();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-brand-ink-soft">
        Voici une liste type pour votre salon. Cochez ce que vous proposez,
        ajustez les prix, puis continuez.
      </p>

      <div className="space-y-2">
        {lines.map((l, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 p-2.5 rounded-lg border transition ${
              l.selected
                ? "border-pos-accent/30 bg-pos-accent/5"
                : "border-brand-line bg-white opacity-60"
            }`}
          >
            <input
              type="checkbox"
              checked={l.selected}
              onChange={(e) => update(i, { selected: e.target.checked })}
              className="w-4 h-4 accent-pos-accent shrink-0"
            />
            <input
              type="text"
              value={l.title}
              onChange={(e) => update(i, { title: e.target.value })}
              placeholder={l.custom ? "Nom du service…" : ""}
              disabled={!l.selected}
              className="flex-1 min-w-0 bg-transparent text-sm font-medium text-brand-ink focus:outline-none disabled:opacity-60"
            />
            <input
              type="number"
              value={l.durationMinutes}
              onChange={(e) =>
                update(i, { durationMinutes: Number(e.target.value) || 0 })
              }
              disabled={!l.selected}
              min={5}
              max={300}
              step={5}
              className="w-14 text-xs text-center bg-white border border-brand-line rounded px-1 py-1 pos-mono disabled:opacity-60"
            />
            <span className="text-[10px] text-brand-ink-soft -ml-1">min</span>
            <input
              type="text"
              inputMode="decimal"
              value={l.price}
              onChange={(e) => update(i, { price: e.target.value })}
              disabled={!l.selected}
              className="w-20 text-xs text-right bg-white border border-brand-line rounded px-2 py-1 pos-mono disabled:opacity-60"
            />
            <span className="text-[10px] text-brand-ink-soft -ml-1">DT</span>
            {l.custom && (
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-brand-ink-soft hover:text-red-600 shrink-0"
                aria-label="Supprimer"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addCustom}
        className="inline-flex items-center gap-1.5 text-sm text-pos-accent hover:text-pos-accent/80 font-medium"
      >
        <Plus size={14} /> Ajouter un service sur-mesure
      </button>

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
        <div className="flex items-center gap-3">
          <span className="text-xs text-brand-ink-soft">
            {selectedCount} service{selectedCount !== 1 ? "s" : ""} sélectionné
            {selectedCount !== 1 ? "s" : ""}
          </span>
          <button
            type="button"
            onClick={save}
            disabled={busy || selectedCount === 0}
            className="px-8 py-3 rounded-xl bg-pos-accent text-white font-semibold hover:bg-pos-accent/90 disabled:opacity-50"
          >
            {busy ? "Sauvegarde…" : "Continuer →"}
          </button>
        </div>
      </div>
    </div>
  );
}
