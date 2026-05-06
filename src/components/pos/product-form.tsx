"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const TVA_PRESETS = [
  { value: "0", label: "0% – Exonéré" },
  { value: "7", label: "7% – TVA réduite" },
  { value: "13", label: "13% – TVA intermédiaire" },
  { value: "19", label: "19% – TVA standard" },
];

type ProductInput = {
  id?: string;
  name: string;
  description: string | null;
  category: string | null;
  sku: string;
  barcode: string | null;
  purchasePrice: string;
  salePrice: string;
  taxRate: string;
  stockQuantity: number;
  lowStockThreshold: number;
  photo: string | null;
  active?: boolean;
};

type Props =
  | { mode: "create"; initial?: undefined }
  | { mode: "edit"; initial: ProductInput };

export function ProductForm(props: Props) {
  const router = useRouter();
  const [form, setForm] = useState<ProductInput>(
    props.mode === "edit"
      ? props.initial
      : {
          name: "",
          description: null,
          category: null,
          sku: "",
          barcode: null,
          purchasePrice: "0.000",
          salePrice: "0.000",
          taxRate: "19",
          stockQuantity: 0,
          lowStockThreshold: 5,
          photo: null,
        },
  );
  const [taxMode, setTaxMode] = useState<"preset" | "custom">(
    ["0", "7", "13", "19"].includes(form.taxRate) ? "preset" : "custom",
  );
  const [customTax, setCustomTax] = useState(taxMode === "custom" ? form.taxRate : "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof ProductInput>(k: K, v: ProductInput[K]) {
    setForm({ ...form, [k]: v });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const taxRate = taxMode === "custom" ? customTax : form.taxRate;
      const tax = parseFloat(taxRate);
      if (Number.isNaN(tax) || tax < 0 || tax > 100) {
        setError("Taux de TVA invalide (0–100)");
        return;
      }
      const body = {
        name: form.name,
        description: form.description,
        category: form.category,
        sku: form.sku,
        barcode: form.barcode || null,
        purchasePrice: form.purchasePrice,
        salePrice: form.salePrice,
        taxRate,
        lowStockThreshold: form.lowStockThreshold,
        photo: form.photo,
        ...(props.mode === "create" ? { stockQuantity: form.stockQuantity } : { active: form.active }),
      };
      const url = props.mode === "create" ? "/api/pos/products" : `/api/pos/products/${form.id}`;
      const method = props.mode === "create" ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Erreur ${res.status}`);
        return;
      }
      router.push("/pos/products");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="luxury-badge mb-2">Caisse</p>
          <h1 className="luxury-heading text-3xl text-brand-ink">
            {props.mode === "create" ? "Nouveau produit" : "Modifier le produit"}
          </h1>
        </div>
        <Link
          href="/pos/products"
          className="text-xs uppercase tracking-[0.18em] text-brand-ink-soft hover:text-brand-ink"
        >
          ← Produits
        </Link>
      </div>

      <form
        onSubmit={submit}
        className="rounded-2xl border border-brand-line bg-white p-6 space-y-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft mb-1">
              Nom *
            </label>
            <input
              required
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className="w-full rounded border border-brand-line bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft mb-1">
              Catégorie
            </label>
            <input
              value={form.category ?? ""}
              onChange={(e) => set("category", e.target.value || null)}
              className="w-full rounded border border-brand-line bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft mb-1">
              SKU *
            </label>
            <input
              required
              value={form.sku}
              onChange={(e) => set("sku", e.target.value)}
              className="w-full rounded border border-brand-line bg-white px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft mb-1">
              Code-barres
            </label>
            <input
              value={form.barcode ?? ""}
              onChange={(e) => set("barcode", e.target.value || null)}
              className="w-full rounded border border-brand-line bg-white px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft mb-1">
              Prix d&apos;achat HT *
            </label>
            <input
              required
              type="number"
              step="0.001"
              min="0"
              value={form.purchasePrice}
              onChange={(e) => set("purchasePrice", e.target.value)}
              className="w-full rounded border border-brand-line bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft mb-1">
              Prix de vente TTC *
            </label>
            <input
              required
              type="number"
              step="0.001"
              min="0"
              value={form.salePrice}
              onChange={(e) => set("salePrice", e.target.value)}
              className="w-full rounded border border-brand-line bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft mb-1">
              TVA *
            </label>
            <select
              value={taxMode === "custom" ? "custom" : form.taxRate}
              onChange={(e) => {
                if (e.target.value === "custom") {
                  setTaxMode("custom");
                } else {
                  setTaxMode("preset");
                  set("taxRate", e.target.value);
                }
              }}
              className="w-full rounded border border-brand-line bg-white px-3 py-2 text-sm"
            >
              {TVA_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
              <option value="custom">Personnalisé…</option>
            </select>
            {taxMode === "custom" && (
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={customTax}
                onChange={(e) => setCustomTax(e.target.value)}
                placeholder="%"
                className="mt-2 w-full rounded border border-brand-line bg-white px-3 py-2 text-sm"
              />
            )}
          </div>
          {props.mode === "create" && (
            <div>
              <label className="block text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft mb-1">
                Stock initial
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.stockQuantity}
                onChange={(e) => set("stockQuantity", parseInt(e.target.value) || 0)}
                className="w-full rounded border border-brand-line bg-white px-3 py-2 text-sm"
              />
            </div>
          )}
          <div>
            <label className="block text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft mb-1">
              Seuil stock faible
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={form.lowStockThreshold}
              onChange={(e) => set("lowStockThreshold", parseInt(e.target.value) || 0)}
              className="w-full rounded border border-brand-line bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft mb-1">
            Description
          </label>
          <textarea
            value={form.description ?? ""}
            onChange={(e) => set("description", e.target.value || null)}
            rows={3}
            className="w-full rounded border border-brand-line bg-white px-3 py-2 text-sm"
          />
        </div>

        {props.mode === "edit" && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active ?? true}
              onChange={(e) => set("active", e.target.checked)}
            />
            Produit actif
          </label>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3 pt-2 border-t border-brand-line">
          <Link
            href="/pos/products"
            className="text-xs uppercase tracking-[0.18em] text-brand-ink-soft self-center"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-brand-ink px-6 py-2.5 text-xs uppercase tracking-[0.18em] text-brand-cream disabled:opacity-50"
          >
            {submitting ? "…" : props.mode === "create" ? "Créer" : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
}
