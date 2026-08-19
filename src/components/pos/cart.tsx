"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Minus, Trash2, UserPlus, Calendar, Percent } from "lucide-react";
import { usePosStore } from "@/lib/pos-store";
import { computeTotals } from "@/lib/sale-totals";
import { formatDT, toMillimes } from "@/lib/money";
import { usePOSShortcut } from "@/lib/use-pos-shortcuts";
import { getShortcutLabel } from "@/lib/pos-shortcuts";
import { BookingStrip } from "@/components/pos/booking-strip";
import { CartSuggestions } from "@/components/pos/cart-suggestions";

type Permission = string;
type Employee = { id: string; displayName: string; role: string };

export function Cart({
  employees,
  permissions,
  onCharge,
  onOpenSide,
  bookingsTodayCount = 0,
}: {
  employees: Employee[];
  permissions: Record<Permission, boolean>;
  onCharge: () => void;
  onOpenSide?: () => void;
  bookingsTodayCount?: number;
}) {
  const cart = usePosStore((s) => s.cart);
  const customer = usePosStore((s) => s.customer);
  const setCustomer = usePosStore((s) => s.setCustomer);
  const saleDiscount = usePosStore((s) => s.saleDiscount);
  const tipTotal = usePosStore((s) => s.tipTotal);
  const removeLine = usePosStore((s) => s.removeLine);
  const updateQty = usePosStore((s) => s.updateQty);
  const setLineEmployee = usePosStore((s) => s.setLineEmployee);
  const setLineDiscount = usePosStore((s) => s.setLineDiscount);
  const clearCart = usePosStore((s) => s.clearCart);
  const [discountEditUid, setDiscountEditUid] = useState<string | null>(null);
  const receiptPreview = usePosStore((s) => s.receiptNumberPreview);
  const setReceiptPreview = usePosStore((s) => s.setReceiptNumberPreview);

  // Compute totals locally — see comment in pos-shell-client.tsx.
  const totals = useMemo(
    () =>
      computeTotals({
        lines: cart.map((l) => ({
          kind: l.kind,
          offerId: l.offerId,
          productId: l.productId,
          nameSnapshot: l.nameSnapshot,
          priceSnapshot: l.priceSnapshot,
          taxRateSnapshot: l.taxRateSnapshot,
          quantity: l.quantity,
          discount: l.discount,
          assignedEmployeeId: l.assignedEmployeeId,
        })),
        saleDiscount: saleDiscount ?? undefined,
        tipTotal,
      }),
    [cart, saleDiscount, tipTotal],
  );

  // Fetch the receipt-number preview once on mount.
  useEffect(() => {
    fetch("/api/pos/sales/preview-receipt-number")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setReceiptPreview(d.receiptNumber as string))
      .catch(() => {});
  }, [setReceiptPreview]);

  usePOSShortcut("cart.clear", () => {
    if (cart.length > 0) clearCart();
  });
  usePOSShortcut("cart.charge", () => {
    if (cart.length > 0 && toMillimes(totals.total) > 0) onCharge();
  });

  const itemsLabel = `${cart.length} article${cart.length !== 1 ? "s" : ""}`;

  const customerName =
    customer && (`${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim() || "Client passager");

  return (
    <div className="bg-pos-surface border-l border-pos-border flex flex-col h-full">
      {/* Header: title + Vider + RDV pill */}
      <div className="flex items-center justify-between px-4 h-11 border-b border-pos-border gap-2">
        <div className="flex items-center gap-2 text-xs min-w-0">
          <span className="font-semibold text-base">Panier</span>
          <span className="text-pos-ink-3">·</span>
          <span className="text-pos-ink-3 truncate">{itemsLabel}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onOpenSide && bookingsTodayCount > 0 && (
            <button
              type="button"
              onClick={onOpenSide}
              title="Voir les RDV du jour"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-pos-highlight text-pos-warn border border-pos-warn text-[11px] font-semibold hover:bg-pos-highlight"
            >
              <Calendar size={11} />
              RDV {bookingsTodayCount}
            </button>
          )}
          <button
            type="button"
            onClick={clearCart}
            disabled={cart.length === 0}
            className="text-[10px] uppercase tracking-[0.18em] text-pos-ink-3 hover:text-pos-danger disabled:opacity-30"
          >
            Vider <kbd>{getShortcutLabel("cart.clear")}</kbd>
          </button>
        </div>
      </div>

      {/* Customer card / add-customer button */}
      <div className="px-3 pt-2 pb-1.5">
        {customer ? (
          <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md border border-pos-border bg-pos-bg">
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-pos-accent/15 text-pos-accent text-[10px] font-semibold shrink-0">
                {(customerName ?? "?").charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="text-xs font-medium text-pos-ink truncate capitalize">{customerName}</div>
                {customer.phone && !customer.phone.startsWith("walk-in-") && (
                  <div className="text-[10px] text-pos-ink-3 pos-mono truncate leading-tight">{customer.phone}</div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCustomer(null)}
              aria-label="Retirer la cliente"
              className="text-pos-ink-3 hover:text-pos-danger shrink-0"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenSide}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-pos-accent/10 text-pos-accent text-xs font-medium hover:bg-pos-accent/20"
          >
            <UserPlus size={14} />
            Ajouter une cliente
          </button>
        )}
      </div>

      <BookingStrip />

      {cart.length === 0 ? (
        <div className="flex-1 flex items-center justify-center px-6 text-center">
          <p className="text-sm text-pos-ink-3">
            <kbd>{getShortcutLabel("search.focus")}</kbd>
            <br />
            Cherchez ou scannez un article pour démarrer une vente.
          </p>
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto">
          {cart.map((l) => {
            const lineGross = Math.round(toMillimes(l.priceSnapshot) * l.quantity) / 1000;
            const discountAmount = l.discount
              ? l.discount.isPercent
                ? Math.round(lineGross * Number(l.discount.value || 0) * 10) / 1000
                : Number(l.discount.value || 0)
              : 0;
            const lineNet = Math.max(0, lineGross - discountAmount);
            const canDiscount = permissions["pos.discount"];
            const editing = discountEditUid === l.uid;
            return (
              <li key={l.uid} className="border-b border-pos-border px-3 py-2">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span
                      className={`pos-mono text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${
                        l.kind === "SERVICE"
                          ? "bg-[#EAE5DC] text-[#6B5A2E]"
                          : "bg-[#DCEAE3] text-[#1F6F4E]"
                      }`}
                    >
                      {l.kind === "SERVICE" ? "SVC" : "PRD"}
                    </span>
                    <span className="text-sm font-medium truncate capitalize">{l.nameSnapshot}</span>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    {l.discount && discountAmount > 0 ? (
                      <>
                        <span className="pos-mono text-[10px] text-pos-ink-3 line-through">
                          {formatDT(String(lineGross))}
                        </span>
                        <span className="pos-mono text-sm font-medium text-pos-accent">
                          {formatDT(String(lineNet))}
                        </span>
                      </>
                    ) : (
                      <span className="pos-mono text-sm font-medium">
                        {formatDT(String(lineGross))}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-pos-ink-3">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (l.quantity <= 1) removeLine(l.uid);
                        else updateQty(l.uid, l.quantity - 1);
                      }}
                      className="w-5 h-5 rounded border border-pos-border hover:bg-pos-highlight flex items-center justify-center"
                    >
                      <Minus size={10} />
                    </button>
                    <span className="pos-mono w-5 text-center">{l.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQty(l.uid, l.quantity + 1)}
                      className="w-5 h-5 rounded border border-pos-border hover:bg-pos-highlight flex items-center justify-center"
                    >
                      <Plus size={10} />
                    </button>
                  </div>
                  {l.kind === "SERVICE" ? (
                    <select
                      value={l.assignedEmployeeId ?? ""}
                      onChange={(e) =>
                        setLineEmployee(l.uid, e.target.value || undefined)
                      }
                      className="text-[11px] bg-transparent border-0 border-b border-dotted border-pos-ink-3 focus:outline-none"
                    >
                      <option value="">— sans</option>
                      {employees.map((e) => (
                        <option key={e.id} value={e.id}>
                          par {e.displayName}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span>—</span>
                  )}
                  {canDiscount && (
                    <button
                      type="button"
                      onClick={() => setDiscountEditUid(editing ? null : l.uid)}
                      title="Remise"
                      className={`ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${
                        l.discount && discountAmount > 0
                          ? "border-pos-accent text-pos-accent bg-pos-accent/10"
                          : "border-pos-border text-pos-ink-3 hover:border-pos-accent hover:text-pos-accent"
                      }`}
                    >
                      <Percent size={10} />
                      {l.discount && discountAmount > 0
                        ? l.discount.isPercent
                          ? `−${l.discount.value}%`
                          : `−${formatDT(l.discount.value)}`
                        : "Remise"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeLine(l.uid)}
                    className={`${canDiscount ? "" : "ml-auto"} text-pos-ink-4 hover:text-pos-danger`}
                    aria-label="Retirer la ligne"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                {editing && canDiscount && (
                  <LineDiscountEditor
                    initial={l.discount}
                    maxAmount={lineGross}
                    onCancel={() => setDiscountEditUid(null)}
                    onApply={(d) => {
                      setLineDiscount(l.uid, d);
                      setDiscountEditUid(null);
                    }}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      <CartSuggestions />

      <div className="border-t-2 border-pos-ink bg-pos-bg pos-mono px-3 py-2 text-xs">
        <Row label="Sous-total" value={totals.subtotal} />
        {Number(totals.taxTotal) > 0 && <Row label="TVA" value={totals.taxTotal} />}
        {Number(totals.saleDiscountAmount) > 0 && (
          <Row label="Remise" value={`−${totals.saleDiscountAmount}`} />
        )}
        {Number(totals.tipTotal) > 0 && <Row label="Pourboire" value={totals.tipTotal} />}
        <div className="border-t border-dashed border-pos-ink-3 mt-1.5 pt-1.5 flex justify-between text-sm font-semibold">
          <span>À régler</span>
          <span>{formatDT(totals.total)}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onCharge}
        disabled={cart.length === 0 || toMillimes(totals.total) <= 0}
        className="bg-pos-accent text-white flex items-center justify-between px-4 h-14 text-base font-semibold hover:bg-pos-accent active:bg-pos-accent disabled:opacity-40 disabled:hover:bg-pos-accent shadow-md shadow-emerald-600/30 transition"
      >
        <span className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/20 text-base">
            ✓
          </span>
          Encaisser
        </span>
        <span className="flex items-center gap-2 pos-mono">
          {formatDT(totals.total)}
          <kbd className="bg-white/15 text-white border-white/20">
            {getShortcutLabel("cart.charge")}
          </kbd>
        </span>
      </button>

      {!permissions["pos.discount"] && cart.length > 0 && (
        <p className="text-[10px] text-pos-ink-4 px-4 py-1 text-center">
          Remises et pourboires non disponibles avec votre rôle.
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-pos-ink-2 mb-0.5">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function LineDiscountEditor({
  initial,
  maxAmount,
  onApply,
  onCancel,
}: {
  initial?: { value: string; isPercent: boolean };
  maxAmount: number;
  onApply: (d?: { value: string; isPercent: boolean }) => void;
  onCancel: () => void;
}) {
  const [isPercent, setIsPercent] = useState(initial?.isPercent ?? true);
  const [value, setValue] = useState(initial?.value ?? "");

  function apply() {
    const num = Number(value);
    if (!value || Number.isNaN(num) || num <= 0) {
      onApply(undefined);
      return;
    }
    if (isPercent && num > 100) return;
    if (!isPercent && num > maxAmount) return;
    onApply({ value: String(num), isPercent });
  }

  return (
    <div className="mt-2 p-2 rounded-lg border border-pos-accent/40 bg-pos-accent/5 flex items-center gap-2">
      <div className="inline-flex rounded border border-pos-border overflow-hidden">
        <button
          type="button"
          onClick={() => setIsPercent(true)}
          className={`px-2 py-1 text-[11px] ${isPercent ? "bg-pos-accent text-white" : "bg-white text-pos-ink-2"}`}
        >
          %
        </button>
        <button
          type="button"
          onClick={() => setIsPercent(false)}
          className={`px-2 py-1 text-[11px] ${!isPercent ? "bg-pos-accent text-white" : "bg-white text-pos-ink-2"}`}
        >
          TND
        </button>
      </div>
      <input
        type="number"
        inputMode="decimal"
        step={isPercent ? "1" : "0.001"}
        min="0"
        max={isPercent ? 100 : maxAmount}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") apply();
          if (e.key === "Escape") onCancel();
        }}
        autoFocus
        placeholder={isPercent ? "ex. 10" : "ex. 5.000"}
        className="flex-1 min-w-0 px-2 py-1 text-sm pos-mono border border-pos-border rounded focus:border-pos-accent focus:outline-none"
      />
      <button
        type="button"
        onClick={() => onApply(undefined)}
        className="px-2 py-1 text-[11px] text-pos-ink-3 hover:text-pos-danger"
        title="Retirer la remise"
      >
        ✕
      </button>
      <button
        type="button"
        onClick={apply}
        className="px-3 py-1 text-[11px] rounded bg-pos-accent text-white font-medium hover:bg-pos-accent/90"
      >
        OK
      </button>
    </div>
  );
}
