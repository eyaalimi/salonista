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

export function Step3Products({
  provider,
  onAdded,
  onNext,
  onSkip,
  onBack,
}: {
  provider: Provider;
  onAdded: (p: Provider) => void;
  onNext: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const [name, setName] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [barcode, setBarcode] = useState("");
  const [stock, setStock] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    if (!name.trim() || Number(salePrice) <= 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/pos/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          salePrice,
          costPrice: costPrice || null,
          barcode: barcode || null,
          stockQuantity: stock,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setError(j?.error ?? "Erreur");
        return;
      }
      onAdded({ ...provider, _count: { ...provider._count, products: provider._count.products + 1 } });
      setName(""); setSalePrice(""); setCostPrice(""); setBarcode(""); setStock(0);
    } finally {
      setBusy(false);
    }
  }

  function skip() {
    if (typeof window !== "undefined") {
      try { window.localStorage.setItem(`onboarding.productsSkipped.${provider.id}`, "1"); } catch {}
    }
    onSkip();
  }

  return (
    <div className="max-w-2xl space-y-3">
      <p className="text-sm text-pos-ink-2">
        Ajoutez vos produits revendus (shampoings, masques…). Vous pouvez passer cette étape.
      </p>

      {error && <div className="px-3 py-2 rounded bg-red-50 text-red-800 text-sm">{error}</div>}

      <input
        aria-label="Nom du produit"
        className="block w-full px-3 py-2 rounded border border-pos-border bg-white"
        placeholder="Nom du produit"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-3">
        <input
          aria-label="Prix de vente"
          className="px-3 py-2 rounded border border-pos-border bg-white"
          type="number" step="0.001" min="0.001"
          placeholder="Prix de vente"
          value={salePrice}
          onChange={(e) => setSalePrice(e.target.value)}
        />
        <input
          aria-label="Prix d'achat HT (facultatif)"
          className="px-3 py-2 rounded border border-pos-border bg-white"
          type="number" step="0.001"
          placeholder="Prix d'achat HT (opt.)"
          value={costPrice}
          onChange={(e) => setCostPrice(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input
          aria-label="Code-barres"
          className="px-3 py-2 rounded border border-pos-border bg-white"
          placeholder="Code-barres (scannez ici)"
          autoFocus
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
        />
        <input
          aria-label="Stock initial"
          className="px-3 py-2 rounded border border-pos-border bg-white"
          type="number" min="0"
          placeholder="Stock initial"
          value={stock}
          onChange={(e) => setStock(Number(e.target.value))}
        />
      </div>
      <button
        type="button"
        disabled={busy || !name.trim() || Number(salePrice) <= 0}
        onClick={add}
        className="px-4 py-2 rounded bg-pos-ink text-pos-bg disabled:opacity-50"
      >
        Ajouter ce produit
      </button>

      <div className="flex justify-between pt-4">
        <button type="button" onClick={onBack} className="text-sm text-pos-ink-3">← Précédent</button>
        <div className="flex gap-3">
          <button type="button" onClick={skip} className="px-4 py-2 text-sm text-pos-ink-2">Passer cette étape</button>
          <button
            type="button"
            onClick={onNext}
            disabled={provider._count.products === 0}
            className="px-5 py-2 rounded bg-pos-ink text-pos-bg disabled:opacity-50"
          >
            Suivant →
          </button>
        </div>
      </div>
    </div>
  );
}
