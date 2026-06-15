"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { PRODUCT_PRESETS, type ProductPreset } from "@/lib/onboarding-presets";

type Provider = {
  id: string;
  category?: string;
  _count: { products: number };
};

type Line = {
  name: string;
  category: string;
  salePrice: string;
  stockQuantity: number;
  selected: boolean;
  custom: boolean;
};

export function Step3Products({
  provider,
  onAdded,
  onNext,
  onSkip,
  onBack,
}: {
  provider: Provider;
  onAdded: (p: Partial<Provider>) => void;
  onNext: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const category = provider.category ?? "AUTRE";
  const presets: ProductPreset[] =
    PRODUCT_PRESETS[category] ?? PRODUCT_PRESETS.AUTRE;

  const initial: Line[] = useMemo(
    () =>
      presets.map((p) => ({
        name: p.name,
        category: p.category,
        salePrice: p.salePrice,
        stockQuantity: p.defaultStock,
        selected: false,
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
        name: "",
        category: "Autre",
        salePrice: "20.000",
        stockQuantity: 5,
        selected: true,
        custom: true,
      },
    ]);
  }
  function remove(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  const selectedCount = lines.filter((l) => l.selected && l.name.trim()).length;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const products = lines
        .filter((l) => l.selected && l.name.trim())
        .map((l) => ({
          name: l.name.trim(),
          category: l.category,
          salePrice: l.salePrice,
          stockQuantity: l.stockQuantity,
        }));
      const res = await fetch("/api/pos/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step3: { products } }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Erreur lors de la sauvegarde");
        return;
      }
      onAdded({ _count: { ...provider._count, products: products.length } });
      onNext();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-brand-ink-soft">
        Vendez-vous aussi des produits à vos clients ? Cochez ce que vous
        souhaitez référencer, avec un stock initial. Vous pourrez tout ajouter
        plus tard.
      </p>

      {presets.length === 0 && lines.length === 0 ? (
        <p className="text-sm text-brand-ink-soft text-center py-6">
          Aucun produit prédéfini pour ce type de salon. Ajoutez-en un sur-mesure
          ou passez cette étape.
        </p>
      ) : (
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
                value={l.name}
                onChange={(e) => update(i, { name: e.target.value })}
                placeholder={l.custom ? "Nom du produit…" : ""}
                disabled={!l.selected}
                className="flex-1 min-w-0 bg-transparent text-sm font-medium text-brand-ink focus:outline-none disabled:opacity-60"
              />
              <input
                type="number"
                value={l.stockQuantity}
                onChange={(e) =>
                  update(i, { stockQuantity: Number(e.target.value) || 0 })
                }
                disabled={!l.selected}
                min={0}
                className="w-14 text-xs text-center bg-white border border-brand-line rounded px-1 py-1 pos-mono disabled:opacity-60"
                aria-label="Stock"
              />
              <span className="text-[10px] text-brand-ink-soft -ml-1">stk</span>
              <input
                type="text"
                inputMode="decimal"
                value={l.salePrice}
                onChange={(e) => update(i, { salePrice: e.target.value })}
                disabled={!l.selected}
                className="w-20 text-xs text-right bg-white border border-brand-line rounded px-2 py-1 pos-mono disabled:opacity-60"
                aria-label="Prix"
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
      )}

      <button
        type="button"
        onClick={addCustom}
        className="inline-flex items-center gap-1.5 text-sm text-pos-accent hover:text-pos-accent/80 font-medium"
      >
        <Plus size={14} /> Ajouter un produit
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
          <button
            type="button"
            onClick={onSkip}
            className="text-sm text-brand-ink-soft hover:text-brand-ink underline"
          >
            Passer cette étape
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="px-8 py-3 rounded-xl bg-pos-accent text-white font-semibold hover:bg-pos-accent/90 disabled:opacity-50"
          >
            {busy
              ? "Sauvegarde…"
              : `Continuer${selectedCount > 0 ? ` (${selectedCount})` : ""} →`}
          </button>
        </div>
      </div>
    </div>
  );
}
