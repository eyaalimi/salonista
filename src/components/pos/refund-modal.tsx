"use client";

import { useMemo, useState } from "react";
import { formatDT, addMoney } from "@/lib/money";

type Method = "CASH" | "CARD" | "TRANSFER" | "OTHER";

const METHOD_LABELS: Record<Method, string> = {
  CASH: "Espèces",
  CARD: "Carte",
  TRANSFER: "Virement",
  OTHER: "Autre",
};

const REASONS = [
  { value: "CUSTOMER_REQUEST", label: "Demande client" },
  { value: "SERVICE_ISSUE", label: "Problème service" },
  { value: "PRODUCT_DEFECT", label: "Produit défectueux" },
  { value: "PRICING_ERROR", label: "Erreur de prix" },
  { value: "OTHER", label: "Autre" },
] as const;

type RefundLineState = {
  id: string;
  name: string;
  quantity: number;
  refundedQuantity: number;
  unitTotal: string;
  isProduct: boolean;
  selectedQty: number;
  restock: boolean;
};

export function RefundModal({
  saleId,
  items,
  payments,
  onClose,
  onCompleted,
}: {
  saleId: string;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    refundedQuantity: number;
    unitTotal: string;
    isProduct: boolean;
  }>;
  payments: Array<{ method: string; amount: string }>;
  onClose: () => void;
  onCompleted: () => Promise<void>;
}) {
  const [lines, setLines] = useState<RefundLineState[]>(
    items.map((it) => ({ ...it, selectedQty: 0, restock: it.isProduct })),
  );
  const [reason, setReason] = useState<typeof REASONS[number]["value"]>("CUSTOMER_REQUEST");
  const [notes, setNotes] = useState("");
  const [refundMethod, setRefundMethod] = useState<Method>(
    (payments[0]?.method as Method) ?? "CASH",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = useMemo(() => {
    let sum = "0.000";
    for (const l of lines) {
      if (l.selectedQty <= 0) continue;
      const lineRefund = (Number(l.unitTotal) * l.selectedQty).toFixed(3);
      sum = addMoney(sum, lineRefund);
    }
    return sum;
  }, [lines]);

  const anySelected = lines.some((l) => l.selectedQty > 0);

  function setQty(id: string, qty: number) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const max = l.quantity - l.refundedQuantity;
        return { ...l, selectedQty: Math.min(Math.max(0, qty), max) };
      }),
    );
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        reason,
        notes: notes || null,
        refundMethod,
        items: lines
          .filter((l) => l.selectedQty > 0)
          .map((l) => ({
            saleItemId: l.id,
            quantity: l.selectedQty,
            restock: l.isProduct ? l.restock : false,
          })),
      };
      const res = await fetch(`/api/pos/sales/${saleId}/refunds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Erreur ${res.status}`);
        return;
      }
      await onCompleted();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl bg-brand-cream p-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <p className="luxury-badge">Remboursement</p>
          <button
            type="button"
            onClick={onClose}
            className="text-brand-ink-soft hover:text-brand-ink"
          >
            ✕
          </button>
        </div>

        <ul className="space-y-3 mb-6">
          {lines.map((l) => {
            const remaining = l.quantity - l.refundedQuantity;
            return (
              <li
                key={l.id}
                className="rounded-2xl border border-brand-line bg-white p-3"
              >
                <div className="flex justify-between text-sm mb-2">
                  <span>{l.name}</span>
                  <span className="text-brand-ink-soft">
                    {formatDT(l.unitTotal)} / unité · {remaining} disponible
                    {remaining > 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => setQty(l.id, l.selectedQty - 1)}
                    className="h-7 w-7 rounded border border-brand-line bg-white"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm">{l.selectedQty}</span>
                  <button
                    type="button"
                    onClick={() => setQty(l.id, l.selectedQty + 1)}
                    className="h-7 w-7 rounded border border-brand-line bg-white"
                  >
                    +
                  </button>
                  {l.isProduct && l.selectedQty > 0 && (
                    <label className="flex items-center gap-1 ml-3 text-brand-ink-soft">
                      <input
                        type="checkbox"
                        checked={l.restock}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((x) =>
                              x.id === l.id ? { ...x, restock: e.target.checked } : x,
                            ),
                          )
                        }
                      />
                      Remettre en stock
                    </label>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="space-y-3 mb-6">
          <div>
            <label className="block text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft mb-1">
              Raison
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as typeof REASONS[number]["value"])}
              className="w-full rounded border border-brand-line bg-white px-3 py-2 text-sm"
            >
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft mb-1">
              Méthode de remboursement
            </label>
            <select
              value={refundMethod}
              onChange={(e) => setRefundMethod(e.target.value as Method)}
              className="w-full rounded border border-brand-line bg-white px-3 py-2 text-sm"
            >
              {(["CASH", "CARD", "TRANSFER", "OTHER"] as Method[]).map((m) => (
                <option key={m} value={m}>
                  {METHOD_LABELS[m]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded border border-brand-line bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex justify-between items-center mb-4">
          <span className="text-sm text-brand-ink-soft">Montant à rembourser</span>
          <span className="luxury-heading text-xl text-brand-ink">{formatDT(total)}</span>
        </div>

        {error && <p className="text-sm text-pos-danger mb-3">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-xs uppercase tracking-[0.18em] text-brand-ink-soft"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!anySelected || submitting}
            className="rounded-lg bg-brand-ink px-6 py-3 text-xs uppercase tracking-[0.18em] text-brand-cream disabled:opacity-40"
          >
            {submitting ? "…" : "Confirmer le remboursement"}
          </button>
        </div>
      </div>
    </div>
  );
}
