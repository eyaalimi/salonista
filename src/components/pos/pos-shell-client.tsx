"use client";

import { useEffect, useState } from "react";
import { useOnlineStatus } from "@/components/pos/online-status";
import { ChargeModal } from "@/components/pos/charge-modal";
import { ReceiptPrintFrame, type ReceiptData } from "@/components/pos/receipt";
import { Results } from "@/components/pos/results";
import { Cart } from "@/components/pos/cart";
import { SidePanel } from "@/components/pos/side-panel";
import { ShortcutHelpOverlay } from "@/components/pos/shortcut-help-overlay";
import {
  refreshCatalog,
  getCachedCatalog,
  queueSale,
  type CachedCatalog,
} from "@/lib/pos-offline-db";
import { usePosStore, selectComputedTotals } from "@/lib/pos-store";

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
  const [catalog, setCatalog] = useState<CachedCatalog | null>(null);
  const [lastReceipt, setLastReceipt] = useState<ReceiptData | null>(null);
  const [printNow, setPrintNow] = useState(false);

  const cart = usePosStore((s) => s.cart);
  const customer = usePosStore((s) => s.customer);
  const totals = usePosStore(selectComputedTotals);
  const tipTotal = usePosStore((s) => s.tipTotal);
  const cartNote = usePosStore((s) => s.cartNote);
  const saleDiscount = usePosStore((s) => s.saleDiscount);
  const attachedBookingId = usePosStore((s) => s.attachedBookingId);
  const chargeOpen = usePosStore((s) => s.chargeOpen);
  const setChargeOpen = usePosStore((s) => s.setChargeOpen);
  const clearCart = usePosStore((s) => s.clearCart);

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

  // Trigger window.print() after a receipt is staged + flagged.
  useEffect(() => {
    if (lastReceipt && printNow) {
      const id = setTimeout(() => {
        window.print();
        setPrintNow(false);
      }, 200);
      return () => clearTimeout(id);
    }
  }, [lastReceipt, printNow]);

  function handleCompleted(receipt: ReceiptData, shouldPrint: boolean) {
    setLastReceipt(receipt);
    setPrintNow(shouldPrint);
    setChargeOpen(false);
    clearCart();
  }

  return (
    <div
      className="h-full grid"
      style={{ gridTemplateColumns: "1fr 380px 320px" }}
    >
      <section className="overflow-hidden bg-pos-bg flex flex-col">
        <Results defaultEmployeeId={employee.id} />
      </section>

      <Cart
        employees={catalog?.employees ?? []}
        permissions={employee.permissions}
        onCharge={() => setChargeOpen(true)}
      />

      <SidePanel
        defaultEmployeeId={employee.id}
        permissions={employee.permissions}
      />

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

      {lastReceipt && <ReceiptPrintFrame data={lastReceipt} />}

      <ShortcutHelpOverlay />
    </div>
  );
}
