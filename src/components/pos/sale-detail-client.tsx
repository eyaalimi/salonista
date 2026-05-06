"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatDT, ttcToHt } from "@/lib/money";
import { RefundModal } from "./refund-modal";
import { ReceiptPrintFrame, type ReceiptData } from "./receipt";

type Sale = {
  id: string;
  receiptNumber: string;
  status: string;
  subtotal: string;
  discountAmount: string;
  taxTotal: string;
  tipTotal: string;
  total: string;
  refundedTotal: string;
  createdAt: string;
  closedAt: string | null;
  notes: string | null;
  customer: { id: string; firstName: string | null; lastName: string | null; phone: string; email: string | null } | null;
  employee: { id: string; displayName: string };
  provider: {
    salonName: string;
    address: string | null;
    city: string | null;
    phone: string | null;
    matriculeFiscal: string | null;
    receiptFooter: string | null;
  };
  items: Array<{
    id: string;
    nameSnapshot: string;
    priceSnapshot: string;
    taxRateSnapshot: string;
    quantity: number;
    refundedQuantity: number;
    discountAmount: string;
    lineTotal: string;
    productId: string | null;
    assignedEmployee: { id: string; displayName: string } | null;
  }>;
  payments: Array<{ method: string; amount: string; reference: string | null }>;
  tipAllocations: Array<{ amount: string; employee: { id: string; displayName: string } }>;
  refunds: Array<{
    id: string;
    reason: string;
    notes: string | null;
    totalAmount: string;
    refundMethod: string;
    createdAt: string;
    items: Array<{ saleItemId: string; quantity: number; amountRefunded: string }>;
    employee: { displayName: string };
  }>;
};

const METHOD_LABELS: Record<string, string> = {
  CASH: "Espèces",
  CARD: "Carte",
  TRANSFER: "Virement",
  OTHER: "Autre",
};

const REASON_LABELS: Record<string, string> = {
  CUSTOMER_REQUEST: "Demande client",
  SERVICE_ISSUE: "Problème service",
  PRODUCT_DEFECT: "Produit défectueux",
  PRICING_ERROR: "Erreur de prix",
  OTHER: "Autre",
};

export function SaleDetailClient({
  saleId,
  canRefund,
}: {
  saleId: string;
  canRefund: boolean;
}) {
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [refundOpen, setRefundOpen] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/pos/sales/${saleId}`);
    if (res.ok) setSale(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleId]);

  async function resendEmail() {
    if (!sale) return;
    setEmailSending(true);
    setEmailMsg(null);
    try {
      const res = await fetch(`/api/pos/sales/${sale.id}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setEmailMsg(res.ok ? "Email envoyé" : data.error ?? "Erreur");
    } finally {
      setEmailSending(false);
    }
  }

  // Build the receipt-print payload from the loaded sale so "Réimprimer"
  // actually has something to print. Without rendering ReceiptPrintFrame the
  // global @media print rule hides everything and produces a blank page.
  const receiptData: ReceiptData | null = useMemo(() => {
    if (!sale) return null;
    const breakdownByRate = new Map<string, { baseM: number; taxM: number }>();
    for (const it of sale.items) {
      const rate = String(it.taxRateSnapshot);
      const ht = Number(ttcToHt(String(it.lineTotal), rate));
      const tax = Number(it.lineTotal) - ht;
      const entry = breakdownByRate.get(rate) ?? { baseM: 0, taxM: 0 };
      entry.baseM += Math.round(ht * 1000);
      entry.taxM += Math.round(tax * 1000);
      breakdownByRate.set(rate, entry);
    }
    const taxBreakdown = Array.from(breakdownByRate.entries())
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([rate, { baseM, taxM }]) => ({
        rate,
        base: (baseM / 1000).toFixed(3),
        tax: (taxM / 1000).toFixed(3),
      }));
    return {
      receiptNumber: sale.receiptNumber,
      provider: {
        id: "",
        salonName: sale.provider.salonName,
        address: sale.provider.address,
        city: sale.provider.city,
        phone: sale.provider.phone,
        matriculeFiscal: sale.provider.matriculeFiscal,
        receiptFooter: sale.provider.receiptFooter,
      },
      employee: { displayName: sale.employee.displayName },
      customerName: sale.customer
        ? [sale.customer.firstName, sale.customer.lastName].filter(Boolean).join(" ") ||
          sale.customer.phone
        : null,
      items: sale.items.map((it) => ({
        name: it.nameSnapshot,
        quantity: it.quantity,
        assignedEmployee: it.assignedEmployee?.displayName ?? null,
        lineTotal: String(it.lineTotal),
        taxRate: String(it.taxRateSnapshot),
      })),
      subtotal: String(sale.subtotal),
      discountAmount: String(sale.discountAmount),
      taxBreakdown,
      tipTotal: String(sale.tipTotal),
      total: String(sale.total),
      payments: sale.payments.map((p) => ({ method: p.method, amount: String(p.amount) })),
      date: sale.closedAt ?? sale.createdAt,
      offline: false,
    };
  }, [sale]);

  if (loading) return <p className="p-6 text-sm text-brand-ink-soft">Chargement…</p>;
  if (!sale) return <p className="p-6 text-sm text-brand-ink-soft">Vente introuvable.</p>;

  const refundable =
    canRefund && (sale.status === "PAID" || sale.status === "PARTIALLY_REFUNDED");

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="luxury-badge mb-2">Reçu</p>
          <h1 className="luxury-heading text-3xl text-brand-ink">{sale.receiptNumber}</h1>
        </div>
        <Link
          href="/pos/sales"
          className="text-xs uppercase tracking-[0.18em] text-brand-ink-soft hover:text-brand-ink"
        >
          ← Toutes les ventes
        </Link>
      </div>

      <div className="rounded-2xl border border-brand-line bg-white p-6 mb-6">
        <div className="grid grid-cols-2 gap-4 text-sm mb-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft">Date</p>
            <p>{new Date(sale.closedAt ?? sale.createdAt).toLocaleString("fr-FR")}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft">Caissier·ère</p>
            <p>{sale.employee.displayName}</p>
          </div>
          {sale.customer && (
            <div className="col-span-2">
              <p className="text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft">Client</p>
              <p>
                {[sale.customer.firstName, sale.customer.lastName].filter(Boolean).join(" ") ||
                  sale.customer.phone}
              </p>
            </div>
          )}
        </div>

        <table className="w-full text-sm mb-4">
          <tbody>
            {sale.items.map((it) => (
              <tr key={it.id} className="border-t border-brand-line">
                <td className="py-3">
                  <p>
                    {it.quantity}× {it.nameSnapshot}
                  </p>
                  {it.assignedEmployee && (
                    <p className="text-xs text-brand-ink-soft">par {it.assignedEmployee.displayName}</p>
                  )}
                  {it.refundedQuantity > 0 && (
                    <p className="text-xs text-amber-700">
                      {it.refundedQuantity} remboursé(s)
                    </p>
                  )}
                </td>
                <td className="py-3 text-right">{formatDT(it.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t border-brand-line pt-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-brand-ink-soft">Sous-total</span>
            <span>{formatDT(sale.subtotal)}</span>
          </div>
          {Number(sale.discountAmount) > 0 && (
            <div className="flex justify-between">
              <span className="text-brand-ink-soft">Remise</span>
              <span>-{formatDT(sale.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-brand-ink-soft">TVA</span>
            <span>{formatDT(sale.taxTotal)}</span>
          </div>
          {Number(sale.tipTotal) > 0 && (
            <div className="flex justify-between">
              <span className="text-brand-ink-soft">Pourboire</span>
              <span>{formatDT(sale.tipTotal)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold pt-2 border-t border-brand-line">
            <span>Total</span>
            <span>{formatDT(sale.total)}</span>
          </div>
          {Number(sale.refundedTotal) > 0 && (
            <div className="flex justify-between text-red-700">
              <span>Remboursé</span>
              <span>-{formatDT(sale.refundedTotal)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-brand-line bg-white p-6 mb-6">
        <h2 className="luxury-heading text-lg text-brand-ink mb-3">Paiements</h2>
        <ul className="space-y-1 text-sm">
          {sale.payments.map((p, i) => (
            <li key={i} className="flex justify-between">
              <span>
                {METHOD_LABELS[p.method] ?? p.method}
                {p.reference && (
                  <span className="ml-2 text-brand-ink-soft">({p.reference})</span>
                )}
              </span>
              <span>{formatDT(p.amount)}</span>
            </li>
          ))}
        </ul>
        {sale.tipAllocations.length > 0 && (
          <>
            <h3 className="text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft mt-4 mb-2">
              Pourboires
            </h3>
            <ul className="space-y-1 text-sm">
              {sale.tipAllocations.map((t, i) => (
                <li key={i} className="flex justify-between">
                  <span>{t.employee.displayName}</span>
                  <span>{formatDT(t.amount)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {sale.refunds.length > 0 && (
        <div className="rounded-2xl border border-brand-line bg-white p-6 mb-6">
          <h2 className="luxury-heading text-lg text-brand-ink mb-3">Remboursements</h2>
          <ul className="space-y-3 text-sm">
            {sale.refunds.map((r) => (
              <li key={r.id} className="border-b border-brand-line pb-3 last:border-0">
                <div className="flex justify-between">
                  <span className="font-medium">
                    {REASON_LABELS[r.reason] ?? r.reason}
                  </span>
                  <span>-{formatDT(r.totalAmount)}</span>
                </div>
                <p className="text-xs text-brand-ink-soft">
                  {new Date(r.createdAt).toLocaleString("fr-FR")} — {r.employee.displayName} —{" "}
                  {METHOD_LABELS[r.refundMethod] ?? r.refundMethod}
                </p>
                {r.notes && <p className="text-xs italic mt-1">{r.notes}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg border border-brand-line bg-white px-4 py-2 text-xs uppercase tracking-[0.18em] text-brand-ink hover:border-brand-gold"
        >
          Réimprimer
        </button>
        <button
          type="button"
          onClick={resendEmail}
          disabled={emailSending}
          className="rounded-lg border border-brand-line bg-white px-4 py-2 text-xs uppercase tracking-[0.18em] text-brand-ink hover:border-brand-gold disabled:opacity-50"
        >
          {emailSending ? "Envoi…" : "Renvoyer par email"}
        </button>
        {refundable && (
          <button
            type="button"
            onClick={() => setRefundOpen(true)}
            className="rounded-lg bg-brand-ink px-4 py-2 text-xs uppercase tracking-[0.18em] text-brand-cream hover:bg-brand-ink-soft"
          >
            Rembourser
          </button>
        )}
      </div>
      {emailMsg && <p className="mt-3 text-xs text-brand-ink-soft">{emailMsg}</p>}

      {refundOpen && (
        <RefundModal
          saleId={sale.id}
          items={sale.items.map((it) => ({
            id: it.id,
            name: it.nameSnapshot,
            quantity: it.quantity,
            refundedQuantity: it.refundedQuantity,
            unitTotal: String((Number(it.lineTotal) / it.quantity).toFixed(3)),
            isProduct: !!it.productId,
          }))}
          payments={sale.payments}
          onClose={() => setRefundOpen(false)}
          onCompleted={async () => {
            setRefundOpen(false);
            await load();
          }}
        />
      )}

      {receiptData && <ReceiptPrintFrame data={receiptData} />}
    </div>
  );
}
