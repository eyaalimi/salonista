"use client";

import { useMemo, useState } from "react";
import { formatDT, toMillimes, fromMillimes, addMoney } from "@/lib/money";
import type { ComputedTotals } from "@/lib/sale-totals";
import type { CartLine } from "./pos-client";
import type { ReceiptData } from "./receipt";
import type { CachedCatalogProvider } from "@/lib/pos-offline-db";

type EmployeeLite = { id: string; displayName: string; role: string };
type EmployeePerm = { id: string; displayName: string; role: string; permissions: Record<string, boolean> };

type Method = "CASH" | "CARD" | "TRANSFER" | "OTHER" | "LOYALTY_POINTS";

const METHOD_LABELS: Record<Method, string> = {
  CASH: "Espèces",
  CARD: "Carte",
  TRANSFER: "Virement",
  OTHER: "Autre",
  LOYALTY_POINTS: "Points fidélité",
};

type Payment = {
  method: Method;
  amount: string;
  reference?: string;
  pointsRedeemed?: number;
  walletId?: string;
};

export type WalletForCharge = {
  walletId: string;
  balance: number;
  minPointsToRedeem: number;
  maxRedemptionPctPerSale: number;
  dinarPerPoint: string;
};

export function ChargeModal({
  cart,
  totals,
  customerId,
  customerEmail,
  notes,
  employees,
  tipTotal,
  saleDiscount,
  provider,
  employee,
  online,
  bookingId,
  wallet,
  onClose,
  onCompleted,
  queueOffline,
}: {
  cart: CartLine[];
  totals: ComputedTotals;
  customerId: string | null;
  customerEmail: string | null;
  notes: string;
  employees: EmployeeLite[];
  tipTotal: string;
  saleDiscount: { value: string; isPercent: boolean } | null;
  provider: CachedCatalogProvider | null;
  employee: EmployeePerm;
  online: boolean;
  bookingId?: string | null;
  wallet?: WalletForCharge | null;
  onClose: () => void;
  onCompleted: (receipt: ReceiptData, shouldPrint: boolean) => void;
  queueOffline: (payload: import("@/lib/pos-sale-create").SalePayload & { clientTotal?: string }) => Promise<void>;
}) {
  const [step, setStep] = useState<"payment" | "tips" | "receipt">("payment");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [showLoyaltyExpansion, setShowLoyaltyExpansion] = useState(false);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [tipAllocs, setTipAllocs] = useState<Array<{ employeeId: string; amount: string }>>([]);
  const [printOnSave, setPrintOnSave] = useState(true);
  const [emailReceipt, setEmailReceipt] = useState(!!customerEmail);
  const [emailOverride, setEmailOverride] = useState(customerEmail ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalM = toMillimes(totals.total);
  const paidM = payments.reduce((s, p) => s + toMillimes(p.amount), 0);
  const remainingM = totalM - paidM;
  const remaining = fromMillimes(Math.max(0, remainingM));
  const change = paidM > totalM ? fromMillimes(paidM - totalM) : "0.000";
  const canContinue = paidM >= totalM;

  // Loyalty redemption helpers — math mirrors the server (rewards/redeem.ts):
  //   maxM_DT_in_millimes = floor(totalM × maxPct / 100)
  //   maxPts              = floor(maxM / (dpp × 1000))
  // Doing it this way avoids a one-point divergence with custom dpp values
  // that would otherwise cause the server to reject at submit time.
  const dpp = wallet ? Number(wallet.dinarPerPoint) : 0.01;
  const loyaltyValueM = wallet ? Math.round(loyaltyPoints * dpp * 1000) : 0;
  const loyaltyValue = fromMillimes(loyaltyValueM);
  const maxByPctPts = wallet
    ? Math.floor(Math.floor((totalM * wallet.maxRedemptionPctPerSale) / 100) / (dpp * 1000))
    : 0;
  const loyaltyMax = wallet ? Math.min(wallet.balance, maxByPctPts) : 0;
  const loyaltyAlreadyApplied = payments.some((p) => p.method === "LOYALTY_POINTS");
  const loyaltyTileEligible =
    !!wallet && wallet.balance >= wallet.minPointsToRedeem && !loyaltyAlreadyApplied && online;

  function addPayment(method: Method) {
    if (!online && method === "CARD") return;
    if (method === "LOYALTY_POINTS") {
      if (!loyaltyTileEligible || !wallet) return;
      setLoyaltyPoints(Math.min(loyaltyMax, wallet.minPointsToRedeem));
      setShowLoyaltyExpansion(true);
      return;
    }
    setPayments((ps) => [
      ...ps,
      { method, amount: remainingM > 0 ? remaining : "0.000" },
    ]);
  }

  function applyLoyaltyRedemption() {
    if (!wallet || loyaltyPoints <= 0) return;
    setPayments((ps) => [
      ...ps,
      {
        method: "LOYALTY_POINTS",
        amount: loyaltyValue,
        pointsRedeemed: loyaltyPoints,
        walletId: wallet.walletId,
      },
    ]);
    setShowLoyaltyExpansion(false);
  }

  function updatePayment(idx: number, patch: Partial<Payment>) {
    setPayments((ps) => ps.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }

  function removePayment(idx: number) {
    setPayments((ps) => ps.filter((_, i) => i !== idx));
  }

  // Default tip split: equally among assigned employees on the sale (or current employee).
  const tipTargets = useMemo(() => {
    const set = new Set<string>();
    cart.forEach((l) => {
      if (l.assignedEmployeeId) set.add(l.assignedEmployeeId);
    });
    if (set.size === 0) set.add(employee.id);
    return Array.from(set);
  }, [cart, employee.id]);

  function defaultTipSplit() {
    const tipM = toMillimes(tipTotal);
    if (tipTargets.length === 0) return [];
    const each = Math.floor(tipM / tipTargets.length);
    const remainder = tipM - each * tipTargets.length;
    return tipTargets.map((id, i) => ({
      employeeId: id,
      amount: fromMillimes(each + (i === 0 ? remainder : 0)),
    }));
  }

  function goToTips() {
    if (toMillimes(tipTotal) > 0) {
      setTipAllocs(defaultTipSplit());
      setStep("tips");
    } else {
      setStep("receipt");
    }
  }

  function tipAllocSum(): string {
    return tipAllocs.reduce((acc, t) => addMoney(acc, t.amount), "0.000");
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const offlineId = crypto.randomUUID();
      const payload = {
        offlineId,
        customerId: customerId ?? null,
        bookingId: bookingId ?? null,
        lines: cart.map((l) => ({
          kind: l.kind,
          offerId: l.offerId,
          productId: l.productId,
          quantity: l.quantity,
          discount: l.discount,
          assignedEmployeeId: l.assignedEmployeeId,
        })),
        saleDiscount: saleDiscount ?? undefined,
        payments: payments.map((p) => ({
          method: p.method,
          amount: p.amount,
          reference: p.reference ?? null,
          pointsRedeemed: p.pointsRedeemed,
          walletId: p.walletId,
        })),
        tipTotal,
        tipAllocations: tipAllocs.length > 0 ? tipAllocs : undefined,
        notes: notes || null,
        clientTotal: totals.total,
      };

      let saleId: string | null = null;
      let receiptNumber: string;
      let rewardsResp:
        | { earned: number; redeemed: number; welcomeBonus: number; birthdayBonus: number; newBalance?: number }
        | undefined;

      if (online) {
        const res = await fetch("/api/pos/sales", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? `Erreur ${res.status}`);
          setSubmitting(false);
          return;
        }
        const data = await res.json();
        saleId = data.sale.id;
        receiptNumber = data.sale.receiptNumber;
        if (data.rewards) rewardsResp = data.rewards;

        if (emailReceipt && saleId) {
          fetch(`/api/pos/sales/${saleId}/email`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: emailOverride || customerEmail }),
          }).catch(() => {});
        }
      } else {
        await queueOffline(payload);
        receiptNumber = `OFF-${offlineId.slice(0, 8)}`;
      }

      const receipt: ReceiptData = {
        receiptNumber,
        provider,
        employee: { displayName: employee.displayName },
        customerName: null, // populated by caller if needed
        items: cart.map((l, i) => ({
          name: l.nameSnapshot,
          quantity: l.quantity,
          assignedEmployee:
            employees.find((e) => e.id === l.assignedEmployeeId)?.displayName ?? null,
          lineTotal: totals.lines[i].lineTotal,
          taxRate: l.taxRateSnapshot,
        })),
        subtotal: totals.subtotal,
        discountAmount: totals.saleDiscountAmount,
        taxBreakdown: totals.taxBreakdown,
        tipTotal: totals.tipTotal,
        total: totals.total,
        payments: payments.map((p) => ({
          method: p.method,
          amount: p.amount,
          pointsRedeemed: p.pointsRedeemed,
        })),
        date: new Date().toISOString(),
        offline: !online,
        rewards: rewardsResp,
      };

      onCompleted(receipt, printOnSave);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl bg-brand-cream p-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <p className="luxury-badge">Encaissement — {step === "payment" ? "Paiement" : step === "tips" ? "Pourboires" : "Reçu"}</p>
          <button
            type="button"
            onClick={onClose}
            className="text-brand-ink-soft hover:text-brand-ink"
          >
            ✕
          </button>
        </div>

        {step === "payment" && (
          <>
            <p className="luxury-heading text-3xl text-brand-ink mb-1">{formatDT(totals.total)}</p>
            <p className="text-sm text-brand-ink-soft mb-6">
              Restant: <span className="font-semibold">{formatDT(remaining)}</span>
              {paidM > totalM && (
                <span className="ml-3 text-emerald-700">
                  Rendu: {formatDT(change)}
                </span>
              )}
            </p>

            <ul className="space-y-2 mb-4">
              {payments.map((p, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 rounded-lg border border-brand-line bg-white p-3"
                >
                  <span className="text-xs uppercase tracking-[0.18em] text-brand-ink-soft w-20">
                    {METHOD_LABELS[p.method]}
                  </span>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={p.amount}
                    onChange={(e) => updatePayment(i, { amount: e.target.value })}
                    className="flex-1 rounded border border-brand-line bg-white px-2 py-1 text-sm"
                  />
                  {(p.method === "CARD" || p.method === "TRANSFER") && (
                    <input
                      type="text"
                      value={p.reference ?? ""}
                      onChange={(e) => updatePayment(i, { reference: e.target.value })}
                      placeholder="Référence"
                      className="w-28 rounded border border-brand-line bg-white px-2 py-1 text-xs"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => removePayment(i)}
                    className="text-brand-ink-soft hover:text-red-600 text-xs"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
              {(["CASH", "CARD", "TRANSFER", "OTHER"] as Method[]).map((m) => {
                const disabled = !online && m === "CARD";
                return (
                  <button
                    key={m}
                    type="button"
                    disabled={disabled}
                    onClick={() => addPayment(m)}
                    title={disabled ? "Carte indisponible hors ligne" : ""}
                    className="rounded-2xl border border-brand-line bg-white py-4 text-xs uppercase tracking-[0.18em] hover:border-brand-gold disabled:opacity-40"
                  >
                    {METHOD_LABELS[m]}
                  </button>
                );
              })}
            </div>

            {wallet && (
              <button
                type="button"
                disabled={!loyaltyTileEligible}
                onClick={() => addPayment("LOYALTY_POINTS")}
                title={
                  !online
                    ? "Indisponible hors ligne — utilisez les points lors de la prochaine connexion"
                    : wallet.balance < wallet.minPointsToRedeem
                      ? `Minimum ${wallet.minPointsToRedeem} pts requis`
                      : loyaltyAlreadyApplied
                        ? "Déjà appliqué"
                        : ""
                }
                className="w-full mb-6 rounded-2xl border-2 border-brand-gold bg-brand-gold-soft/30 py-4 px-4 text-left text-brand-ink hover:bg-brand-gold-soft/50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <p className="text-xs uppercase tracking-[0.18em] mb-1">★ Points fidélité</p>
                <p className="text-sm">
                  Solde: <span className="font-semibold">{wallet.balance} pts</span>
                  <span className="text-brand-ink-soft"> (≈ {formatDT(fromMillimes(Math.round(wallet.balance * dpp * 1000)))})</span>
                </p>
              </button>
            )}

            {showLoyaltyExpansion && wallet && (
              <div className="rounded-2xl border-2 border-brand-gold bg-brand-cream p-4 mb-6">
                <p className="luxury-badge mb-2">Utiliser des points</p>
                <p className="text-sm text-brand-ink-soft mb-4">
                  Solde disponible: {wallet.balance} pts (≈ {formatDT(fromMillimes(Math.round(wallet.balance * dpp * 1000)))})
                </p>
                <div className="flex items-center gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setLoyaltyPoints((p) => Math.max(wallet.minPointsToRedeem, p - 10))}
                    className="rounded border border-brand-line bg-white px-3 py-2"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={wallet.minPointsToRedeem}
                    max={loyaltyMax}
                    step={1}
                    value={loyaltyPoints}
                    onChange={(e) =>
                      setLoyaltyPoints(
                        Math.max(
                          wallet.minPointsToRedeem,
                          Math.min(loyaltyMax, Math.floor(Number(e.target.value) || 0)),
                        ),
                      )
                    }
                    className="flex-1 rounded border border-brand-line bg-white px-2 py-2 text-center"
                  />
                  <button
                    type="button"
                    onClick={() => setLoyaltyPoints((p) => Math.min(loyaltyMax, p + 10))}
                    className="rounded border border-brand-line bg-white px-3 py-2"
                  >
                    +
                  </button>
                  <span className="text-xs text-brand-ink-soft">pts</span>
                </div>
                <p className="text-sm mb-1">
                  Valeur: <span className="font-semibold">{formatDT(loyaltyValue)}</span>
                </p>
                <p className="text-xs text-brand-ink-soft mb-4">
                  Maximum sur cette vente: {loyaltyMax} pts ({wallet.maxRedemptionPctPerSale}%)
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowLoyaltyExpansion(false)}
                    className="text-xs uppercase tracking-[0.18em] text-brand-ink-soft hover:text-brand-ink px-4"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={applyLoyaltyRedemption}
                    disabled={loyaltyPoints < wallet.minPointsToRedeem || loyaltyPoints > loyaltyMax}
                    className="rounded-lg bg-brand-gold px-6 py-2 text-xs uppercase tracking-[0.18em] text-brand-ink hover:bg-brand-gold-soft disabled:opacity-40"
                  >
                    Appliquer
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={goToTips}
                disabled={!canContinue}
                className="rounded-lg bg-brand-ink px-6 py-3 text-xs uppercase tracking-[0.18em] text-brand-cream disabled:opacity-40"
              >
                Continuer
              </button>
            </div>
          </>
        )}

        {step === "tips" && (
          <>
            <p className="text-sm text-brand-ink-soft mb-4">
              Pourboire total: <span className="font-semibold">{formatDT(tipTotal)}</span>
            </p>
            <ul className="space-y-2 mb-4">
              {tipAllocs.map((alloc, i) => {
                const emp = employees.find((e) => e.id === alloc.employeeId);
                return (
                  <li key={alloc.employeeId} className="flex items-center gap-2">
                    <span className="text-sm flex-1">{emp?.displayName ?? "—"}</span>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={alloc.amount}
                      onChange={(e) =>
                        setTipAllocs((a) =>
                          a.map((x, j) => (i === j ? { ...x, amount: e.target.value } : x)),
                        )
                      }
                      className="w-24 rounded border border-brand-line bg-white px-2 py-1 text-sm"
                    />
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-brand-ink-soft mb-6">
              Somme allouée: {formatDT(tipAllocSum())}
            </p>
            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep("payment")}
                className="text-xs uppercase tracking-[0.18em] text-brand-ink-soft"
              >
                ← Retour
              </button>
              <button
                type="button"
                onClick={() => setStep("receipt")}
                disabled={
                  toMillimes(tipAllocSum()) !== toMillimes(tipTotal)
                }
                className="rounded-lg bg-brand-ink px-6 py-3 text-xs uppercase tracking-[0.18em] text-brand-cream disabled:opacity-40"
              >
                Continuer
              </button>
            </div>
          </>
        )}

        {step === "receipt" && (
          <>
            <div className="space-y-3 mb-6">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={printOnSave}
                  onChange={(e) => setPrintOnSave(e.target.checked)}
                />
                Imprimer le reçu
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={emailReceipt}
                  disabled={!online}
                  onChange={(e) => setEmailReceipt(e.target.checked)}
                />
                Envoyer par email {!online && <span className="text-xs text-brand-ink-soft">(en file d&apos;attente)</span>}
              </label>
              {emailReceipt && (
                <input
                  type="email"
                  value={emailOverride}
                  onChange={(e) => setEmailOverride(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full rounded border border-brand-line bg-white px-2 py-1 text-sm"
                />
              )}
            </div>
            {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep(toMillimes(tipTotal) > 0 ? "tips" : "payment")}
                className="text-xs uppercase tracking-[0.18em] text-brand-ink-soft"
              >
                ← Retour
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="rounded-lg bg-brand-gold px-6 py-3 text-xs uppercase tracking-[0.18em] text-brand-ink hover:bg-brand-gold-soft disabled:opacity-50"
              >
                {submitting ? "Enregistrement…" : "Confirmer"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
