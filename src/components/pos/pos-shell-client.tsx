"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useOnlineStatus } from "@/components/pos/online-status";
import { ChargeModal } from "@/components/pos/charge-modal";
import { ReceiptPrintFrame, type ReceiptData } from "@/components/pos/receipt";
import { Results } from "@/components/pos/results";
import { Cart } from "@/components/pos/cart";
import { SidePanel } from "@/components/pos/side-panel";
import { ShortcutHelpOverlay } from "@/components/pos/shortcut-help-overlay";
import { usePOSShortcut } from "@/lib/use-pos-shortcuts";
import {
  refreshCatalog,
  getCachedCatalog,
  queueSale,
  type CachedCatalog,
} from "@/lib/pos-offline-db";
import { usePosStore } from "@/lib/pos-store";
import { computeTotals } from "@/lib/sale-totals";

type Permission = string;
type EmployeeProp = {
  id: string;
  displayName: string;
  role: string;
  permissions: Record<Permission, boolean>;
};

/**
 * Phase 2 Design 2 — top-level POS shell. Hosts the three center panels
 * (Results | Cart | Side) and the global ChargeModal. State lives in the
 * Zustand store at `@/lib/pos-store`; this component is mostly orchestration.
 */
export function PosShellClient({ employee }: { employee: EmployeeProp }) {
  const { online } = useOnlineStatus();
  const router = useRouter();
  const [catalog, setCatalog] = useState<CachedCatalog | null>(null);
  const [lastReceipt, setLastReceipt] = useState<ReceiptData | null>(null);
  const [printNow, setPrintNow] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);
  const [bookingsTodayCount, setBookingsTodayCount] = useState(0);
  const [successToast, setSuccessToast] = useState<{ total: string; receiptNumber: string } | null>(null);

  const cart = usePosStore((s) => s.cart);
  const customer = usePosStore((s) => s.customer);
  const tipTotal = usePosStore((s) => s.tipTotal);
  const cartNote = usePosStore((s) => s.cartNote);
  const saleDiscount = usePosStore((s) => s.saleDiscount);
  const attachedBookingId = usePosStore((s) => s.attachedBookingId);
  const chargeOpen = usePosStore((s) => s.chargeOpen);
  const setChargeOpen = usePosStore((s) => s.setChargeOpen);
  const clearCart = usePosStore((s) => s.clearCart);

  // computeTotals returns a new object each call — keep it out of the
  // Zustand selector chain (would violate getSnapshot stability and
  // infinitely re-render). useMemo here is safe.
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

  // Load catalog (refresh online, fall back to cache).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fresh = await refreshCatalog();
      if (cancelled) return;
      if (fresh) setCatalog(fresh);
      else {
        const cached = await getCachedCatalog();
        if (cached) setCatalog(cached);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Redirect fresh OWNER providers to the onboarding welcome page.
  useEffect(() => {
    if (!catalog) return;
    const onboarding = catalog.onboarding;
    if (!onboarding) return;
    if (employee.role !== "OWNER") return;
    if (onboarding.dismissedAt) return;
    if (onboarding.offersCount > 0) return;
    if (onboarding.productsCount > 0) return;
    if (onboarding.salesCount > 0) return;
    router.replace("/pos/bienvenue");
  }, [catalog, employee.role, router]);

  // OWNER login → if no drawer is open, send them to open one first.
  useEffect(() => {
    if (!catalog) return;
    if (employee.role !== "OWNER") return;
    // Don't preempt the onboarding redirect above.
    const onboarding = catalog.onboarding;
    if (onboarding && !onboarding.dismissedAt && onboarding.offersCount === 0 && onboarding.productsCount === 0 && onboarding.salesCount === 0) return;
    if (catalog.cashDrawer?.openSessionId) return;
    router.replace("/pos/cash-drawer");
  }, [catalog, employee.role, router]);

  // Poll today's bookings count for the cart header pill.
  useEffect(() => {
    if (!employee.permissions["bookings.view"]) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/pos/bookings/today");
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          bookings: Array<{ saleId: string | null }>;
        };
        if (!cancelled) {
          // Count only un-encaissé bookings (no saleId yet)
          const open = data.bookings.filter((b) => !b.saleId).length;
          setBookingsTodayCount(open);
        }
      } catch {
        // ignore
      }
    }
    void load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [employee.permissions]);

  // Trigger window.print() after a receipt is staged + flagged.
  // After printing, unmount the receipt so it never lingers in the UI.
  useEffect(() => {
    if (lastReceipt && printNow) {
      const id = setTimeout(() => {
        window.print();
        setPrintNow(false);
        // Drop the receipt from state after the print dialog opens, so the
        // hidden frame is unmounted and not visible on screen anymore.
        setTimeout(() => setLastReceipt(null), 500);
      }, 200);
      return () => clearTimeout(id);
    }
  }, [lastReceipt, printNow]);

  // Auto-dismiss the success toast.
  useEffect(() => {
    if (!successToast) return;
    const id = setTimeout(() => setSuccessToast(null), 2500);
    return () => clearTimeout(id);
  }, [successToast]);

  function handleCompleted(receipt: ReceiptData, shouldPrint: boolean) {
    if (shouldPrint) {
      setLastReceipt(receipt);
      setPrintNow(true);
    }
    setSuccessToast({ total: receipt.total, receiptNumber: receipt.receiptNumber });
    setChargeOpen(false);
    clearCart();
  }

  // ESC closes the side drawer.
  useEffect(() => {
    if (!sideOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSideOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sideOpen]);

  // Ctrl+F (customer search) now opens the side drawer first; the
  // CustomerBlock's own focus shortcut handles the input focus once mounted.
  usePOSShortcut("customer.search", () => {
    setSideOpen(true);
  });

  return (
    <div
      className="h-full grid relative"
      style={{ gridTemplateColumns: "1fr 420px" }}
    >
      <section className="overflow-hidden bg-pos-bg flex flex-col">
        <Results defaultEmployeeId={employee.id} />
      </section>

      <Cart
        employees={catalog?.employees ?? []}
        permissions={employee.permissions}
        onCharge={() => setChargeOpen(true)}
        onOpenSide={() => setSideOpen(true)}
        bookingsTodayCount={bookingsTodayCount}
      />

      {/* Side drawer (Client / RDV / Recent sales) */}
      {sideOpen && (
        <>
          <div
            className="absolute inset-0 z-30 bg-black/30"
            onClick={() => setSideOpen(false)}
            aria-hidden="true"
          />
          <aside
            role="dialog"
            aria-modal="true"
            className="absolute top-0 right-0 z-40 h-full w-[360px] bg-pos-surface border-l border-pos-border shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between px-4 h-11 border-b border-pos-border">
              <span className="text-sm font-semibold">Client / RDV / Ventes</span>
              <button
                type="button"
                onClick={() => setSideOpen(false)}
                aria-label="Fermer"
                className="text-pos-ink-3 hover:text-pos-ink text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <SidePanel
                defaultEmployeeId={employee.id}
                permissions={employee.permissions}
              />
            </div>
          </aside>
        </>
      )}

      {chargeOpen && (
        <ChargeModal
          cart={cart}
          totals={totals}
          customerId={customer?.id ?? null}
          customerEmail={customer?.email ?? null}
          notes={cartNote}
          employees={catalog?.employees ?? []}
          tipTotal={tipTotal}
          saleDiscount={saleDiscount}
          provider={catalog?.provider ?? null}
          employee={employee}
          online={online}
          bookingId={attachedBookingId}
          wallet={customer?.wallet ?? null}
          onClose={() => setChargeOpen(false)}
          onCompleted={handleCompleted}
          queueOffline={queueSale}
        />
      )}

      {lastReceipt && printNow && <ReceiptPrintFrame data={lastReceipt} />}

      {successToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl bg-emerald-600 text-white shadow-xl animate-in fade-in slide-in-from-bottom-4"
        >
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/20 text-lg">
            ✓
          </span>
          <div>
            <div className="font-semibold text-sm">Paiement encaissé</div>
            <div className="text-xs opacity-90 pos-mono">
              {successToast.receiptNumber} · {successToast.total} DT
            </div>
          </div>
        </div>
      )}

      <ShortcutHelpOverlay />
    </div>
  );
}
