"use client";
import { useEffect, useState } from "react";

export function ReceptionModal({
  productId,
  productName,
  currentCost,
  onClose,
  onDone,
}: {
  productId: string;
  productName: string;
  currentCost: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [quantity, setQuantity] = useState(0);
  const [unitCost, setUnitCost] = useState(currentCost ?? "");
  const [updateCostPrice, setUpdateCostPrice] = useState(true);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setError("Quantité entière supérieure à 0 requise");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/pos/products/${productId}/stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          delta: quantity,
          reason: "PURCHASE",
          unitCost: unitCost || null,
          updateCostPrice,
          note: note.trim() || null,
        }),
      });
      if (res.ok) {
        onDone();
        onClose();
      } else {
        const j = await res.json().catch(() => null);
        setError(j?.error ?? "Erreur");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-brand-cream p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Réception ${productName}`}
      >
        <header className="flex items-center justify-between mb-4">
          <p className="luxury-badge">Réception</p>
          <button
            onClick={onClose}
            aria-label="Fermer"
            type="button"
            className="text-brand-ink-soft hover:text-brand-ink"
          >
            ✕
          </button>
        </header>
        <h2 className="luxury-heading text-lg text-brand-ink mb-4">{productName}</h2>

        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

        <label className="block mb-3">
          <span className="text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft">
            Quantité reçue
          </span>
          <input
            aria-label="Quantité reçue"
            type="number"
            min="1"
            step="1"
            value={quantity || ""}
            onChange={(e) => setQuantity(Number(e.target.value))}
            autoFocus
            className="mt-1 w-full rounded border border-brand-line bg-white px-3 py-2 text-sm"
          />
        </label>

        <label className="block mb-3">
          <span className="text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft">
            Prix d&apos;achat HT (DT)
          </span>
          <input
            aria-label="Prix d'achat HT en DT"
            type="number"
            step="0.001"
            min="0"
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
            className="mt-1 w-full rounded border border-brand-line bg-white px-3 py-2 text-sm"
          />
          {currentCost && (
            <p className="mt-1 text-xs text-brand-ink-soft">
              Actuel : {Number(currentCost).toFixed(3)} DT
            </p>
          )}
        </label>

        <label className="flex items-center gap-2 mb-3 text-sm text-brand-ink">
          <input
            type="checkbox"
            checked={updateCostPrice}
            onChange={(e) => setUpdateCostPrice(e.target.checked)}
          />
          Mettre à jour le prix d&apos;achat de référence
        </label>

        <label className="block mb-4">
          <span className="text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft">
            Note (facultative)
          </span>
          <input
            aria-label="Note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1 w-full rounded border border-brand-line bg-white px-3 py-2 text-sm"
          />
        </label>

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="text-xs uppercase tracking-[0.18em] text-brand-ink-soft"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={busy || quantity <= 0}
            onClick={save}
            className="rounded-lg bg-brand-ink px-6 py-2 text-xs uppercase tracking-[0.18em] text-brand-cream disabled:opacity-50"
          >
            Valider
          </button>
        </div>
      </div>
    </div>
  );
}
