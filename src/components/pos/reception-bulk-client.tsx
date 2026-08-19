"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Product = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  costPrice: string | null;
};

type Row = {
  productId: string;
  barcode: string;
  name: string;
  quantity: number;
  unitCost: string;
  updateCostPrice: boolean;
};

const EMPTY_ROW: Row = {
  productId: "",
  barcode: "",
  name: "",
  quantity: 0,
  unitCost: "",
  updateCostPrice: true,
};

export function ReceptionBulkClient({ products }: { products: Product[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([{ ...EMPTY_ROW }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(i: number, patch: Partial<Row>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((r) => [...r, { ...EMPTY_ROW }]);
  }

  function onBarcodeBlur(i: number) {
    const row = rows[i];
    if (!row.barcode.trim()) return;
    const match = products.find((p) => p.barcode === row.barcode || p.sku === row.barcode);
    if (match) {
      update(i, {
        productId: match.id,
        name: match.name,
        unitCost: row.unitCost || match.costPrice || "",
      });
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const items = rows
      .filter((r) => r.productId && r.quantity > 0)
      .map((r) => ({
        productId: r.productId,
        quantity: r.quantity,
        unitCost: r.unitCost || null,
        updateCostPrice: r.updateCostPrice,
      }));
    if (items.length === 0) {
      setError("Aucun item valide");
      setBusy(false);
      return;
    }
    try {
      const res = await fetch("/api/pos/products/reception-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (res.ok) {
        router.push("/pos/products");
      } else {
        const j = await res.json().catch(() => null);
        setError(j?.error ?? "Erreur");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-brand-cream p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="luxury-badge">Réception</p>
          <h1 className="luxury-heading text-2xl text-brand-ink">
            Réception multiple
          </h1>
        </div>
        <a
          href="/pos/products"
          className="text-xs uppercase tracking-[0.18em] text-brand-ink-soft hover:text-brand-ink"
        >
          ← Retour
        </a>
      </header>

      {error && (
        <div className="mb-4 rounded border border-pos-danger bg-pos-danger-soft px-3 py-2 text-sm text-pos-danger">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-brand-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-brand-cream text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft">
            <tr>
              <th className="px-3 py-2 text-left">Code-barres</th>
              <th className="px-3 py-2 text-left">Produit</th>
              <th className="px-3 py-2 text-right">Quantité</th>
              <th className="px-3 py-2 text-right">Prix d&apos;achat HT</th>
              <th className="px-3 py-2 text-center">MAJ prix</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-brand-line">
                <td className="px-3 py-2">
                  <input
                    aria-label={`Code-barres ligne ${i + 1}`}
                    type="text"
                    className="w-full rounded border border-brand-line bg-white px-2 py-1"
                    value={r.barcode}
                    onChange={(e) => update(i, { barcode: e.target.value })}
                    onBlur={() => onBarcodeBlur(i)}
                    autoFocus={i === rows.length - 1}
                  />
                </td>
                <td className="px-3 py-2 text-brand-ink">
                  {r.name || <span className="text-brand-ink-soft italic">(inconnu)</span>}
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    aria-label={`Quantité ligne ${i + 1}`}
                    type="number"
                    min="1"
                    step="1"
                    className="w-24 rounded border border-brand-line bg-white px-2 py-1 text-right"
                    value={r.quantity || ""}
                    onChange={(e) => update(i, { quantity: Number(e.target.value) })}
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    aria-label={`Prix d'achat ligne ${i + 1}`}
                    type="number"
                    step="0.001"
                    min="0"
                    className="w-24 rounded border border-brand-line bg-white px-2 py-1 text-right"
                    value={r.unitCost}
                    onChange={(e) => update(i, { unitCost: e.target.value })}
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    aria-label={`Mettre à jour prix d'achat ligne ${i + 1}`}
                    checked={r.updateCostPrice}
                    onChange={(e) => update(i, { updateCostPrice: e.target.checked })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={addRow}
          className="rounded border border-brand-line bg-white px-3 py-1 text-xs uppercase tracking-[0.18em] text-brand-ink-soft hover:bg-brand-cream"
        >
          + Ligne
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="rounded-lg bg-brand-ink px-6 py-2 text-xs uppercase tracking-[0.18em] text-brand-cream hover:bg-brand-ink-soft disabled:opacity-50"
        >
          Valider la réception
        </button>
      </div>
    </div>
  );
}
