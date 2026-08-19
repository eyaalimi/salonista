"use client";
import { useEffect, useState } from "react";
import { X, Delete } from "lucide-react";

const CATEGORIES = [
  { value: "FOURNISSEUR", label: "Fournisseur" },
  { value: "LIVRAISON", label: "Livraison" },
  { value: "AVANCE_SALAIRE", label: "Avance salaire" },
  { value: "ENTRETIEN", label: "Entretien" },
  { value: "AUTRE", label: "Autre" },
] as const;

type Category = typeof CATEGORIES[number]["value"];

export function ExpenseModal({
  employeeName: _employeeName,
  onClose,
  onCreated,
}: {
  employeeName: string;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  // Amount stored as a raw string ("123.45") so the numeric pad can build it
  // one keystroke at a time. We display it formatted to 3 decimals.
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<Category>("FOURNISSEUR");
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

  function pressKey(k: string) {
    setAmount((prev) => {
      if (k === "." ) {
        if (prev.includes(".")) return prev;
        return prev === "" ? "0." : prev + ".";
      }
      // Don't allow more than 3 decimals
      if (prev.includes(".") && prev.split(".")[1].length >= 3) return prev;
      // Avoid leading zeros like "007"
      if (prev === "0") return k;
      return prev + k;
    });
  }

  function backspace() {
    setAmount((prev) => prev.slice(0, -1));
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/pos/drawer/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount),
          category,
          reason: reason.trim(),
        }),
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

  const amountNum = Number(amount);
  const canSave = amountNum > 0 && !Number.isNaN(amountNum) && !busy;

  // Display value: amount with 3 decimals if "complete", otherwise the raw input
  const displayAmount = amount === "" ? "0.000" : amount;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Nouvelle dépense"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="text-xl font-semibold text-pos-ink">Nouvelle dépense</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="text-pos-ink-3 hover:text-pos-ink"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 pb-5 space-y-5">
          {/* Amount display */}
          <div>
            <label className="block text-sm font-medium text-pos-ink mb-2">
              Montant
            </label>
            <div className="w-full px-4 py-3 border-2 border-pos-accent rounded-lg bg-white text-right text-2xl font-semibold pos-mono text-pos-ink">
              {displayAmount}
            </div>
          </div>

          {/* Numeric pad */}
          <div className="grid grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => pressKey(k)}
                className="py-3 rounded-lg border border-pos-border bg-white text-lg font-medium text-pos-ink hover:bg-pos-highlight"
              >
                {k}
              </button>
            ))}
            <button
              type="button"
              onClick={() => pressKey(".")}
              className="py-3 rounded-lg border border-pos-border bg-white text-lg font-medium text-pos-ink hover:bg-pos-highlight"
            >
              .
            </button>
            <button
              type="button"
              onClick={() => pressKey("0")}
              className="py-3 rounded-lg border border-pos-border bg-white text-lg font-medium text-pos-ink hover:bg-pos-highlight"
            >
              0
            </button>
            <button
              type="button"
              onClick={backspace}
              aria-label="Effacer"
              className="py-3 rounded-lg border border-pos-border bg-white text-pos-ink hover:bg-pos-highlight flex items-center justify-center"
            >
              <Delete size={18} />
            </button>
          </div>

          {/* Categories */}
          <div>
            <label className="block text-sm font-medium text-pos-ink mb-2">
              Catégorie
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => {
                const active = category === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCategory(c.value)}
                    className={`px-4 py-1.5 rounded-full text-sm border transition ${
                      active
                        ? "bg-pos-accent border-pos-accent text-white"
                        : "bg-white border-pos-border text-pos-ink-2 hover:border-pos-accent"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-pos-ink mb-2">
              Motif <span className="text-pos-ink-3 font-normal">(optionnel)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-pos-border rounded-lg bg-white text-sm focus:border-pos-accent focus:outline-none resize-y"
              aria-label="Motif"
            />
          </div>

          {error && (
            <p className="text-sm text-pos-danger bg-pos-danger-soft px-3 py-2 rounded">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-lg border border-pos-border text-pos-ink hover:bg-pos-highlight"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!canSave}
              className="px-6 py-2 rounded-lg bg-pos-accent text-white font-medium hover:bg-pos-accent/90 disabled:opacity-50"
            >
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
