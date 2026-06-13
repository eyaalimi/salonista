"use client";
import { useEffect, useState } from "react";

const CATEGORIES = [
  { value: "FOURNISSEUR", label: "Fournisseur" },
  { value: "LIVRAISON", label: "Livraison" },
  { value: "AVANCE_SALAIRE", label: "Avance" },
  { value: "ENTRETIEN", label: "Entretien" },
  { value: "AUTRE", label: "Autre" },
] as const;

type Category = typeof CATEGORIES[number]["value"];

export function ExpenseModal({
  employeeName,
  onClose,
  onCreated,
}: {
  employeeName: string;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<Category>("AUTRE");
  const [reason, setReason] = useState("");
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
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/pos/drawer/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount), category, reason: reason.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setError(j?.error ?? "Erreur");
        return;
      }
      await onCreated();
      onClose();
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
        aria-label="Nouvelle dépense"
      >
        <header className="flex items-center justify-between mb-4">
          <p className="luxury-badge">Nouvelle dépense</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="text-brand-ink-soft hover:text-brand-ink"
          >
            ✕
          </button>
        </header>

        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

        <label className="block mb-3">
          <span className="text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft">
            Montant (DT)
          </span>
          <input
            type="number"
            step="0.001"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
            className="mt-1 w-full rounded border border-brand-line bg-white px-3 py-2 text-sm"
            aria-label="Montant en DT"
          />
        </label>

        <fieldset className="mb-3">
          <legend className="text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft mb-2">
            Catégorie
          </legend>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className={`px-3 py-1 rounded-full text-xs border ${
                  category === c.value
                    ? "bg-brand-ink text-brand-cream border-brand-ink"
                    : "border-brand-line text-brand-ink"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block mb-3">
          <span className="text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft">Motif</span>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 w-full rounded border border-brand-line bg-white px-3 py-2 text-sm"
            aria-label="Motif"
          />
        </label>

        <p className="text-xs text-brand-ink-soft mb-4">Employé : {employeeName}</p>

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
            onClick={save}
            disabled={busy || Number(amount) <= 0 || !reason.trim()}
            className="rounded-lg bg-brand-ink px-6 py-2 text-xs uppercase tracking-[0.18em] text-brand-cream disabled:opacity-50"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
