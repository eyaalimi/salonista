"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, ShoppingCart, X, ArrowLeft, ArrowRight } from "lucide-react";
import { useOnlineStatus } from "@/components/pos/online-status";
import { ChargeModal } from "@/components/pos/charge-modal";
import { ReceiptPrintFrame, type ReceiptData } from "@/components/pos/receipt";
import { Results } from "@/components/pos/results";
import { Cart } from "@/components/pos/cart";
import { SidePanel } from "@/components/pos/side-panel";
import { AttacheRdvDepuisUrl } from "@/components/pos/attache-rdv-url";
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
  const [cartOpen, setCartOpen] = useState(false);
  // Tracks the previous customer id so we can auto-close the mobile side
  // drawer when the cashier picks/creates a customer (no bounce-back button
  // otherwise — see the mobile "Client / RDV / Ventes" flow).
  const prevCustomerIdRef = useRef<string | null>(null);
  const [bookingsTodayCount, setBookingsTodayCount] = useState(0);
  const [whatsappTemplate, setWhatsappTemplate] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<{
    total: string;
    receiptNumber: string;
    whatsappUrl: string | null;
  } | null>(null);

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

  // Auto-dismiss the success toast (longer if there's a WhatsApp CTA).
  useEffect(() => {
    if (!successToast) return;
    const timeoutMs = successToast.whatsappUrl ? 8000 : 2500;
    const id = setTimeout(() => setSuccessToast(null), timeoutMs);
    return () => clearTimeout(id);
  }, [successToast]);

  // Load the WhatsApp message template once on mount. Fails silently if the
  // REWARDS module is off or the fetch errors — the toast just skips the CTA.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/rewards/program", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { whatsappMessage?: string | null };
        if (!cancelled) setWhatsappTemplate(data.whatsappMessage ?? null);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleCompleted(receipt: ReceiptData, shouldPrint: boolean) {
    if (shouldPrint) {
      setLastReceipt(receipt);
      setPrintNow(true);
    }
    // Build an optional wa.me URL if the salon has configured a template AND
    // this sale earned points AND we have a customer phone snapshot.
    const totalEarned =
      (receipt.rewards?.earned ?? 0) +
      (receipt.rewards?.welcomeBonus ?? 0) +
      (receipt.rewards?.birthdayBonus ?? 0);
    const whatsappUrl =
      whatsappTemplate && totalEarned > 0 && customer?.phone
        ? buildWhatsappLink(whatsappTemplate, {
            phone: customer.phone,
            name: (`${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim()) || "",
            earned: totalEarned,
            balance: receipt.rewards?.newBalance ?? 0,
          })
        : null;
    setSuccessToast({
      total: receipt.total,
      receiptNumber: receipt.receiptNumber,
      whatsappUrl,
    });
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

  // Mobile only: when the cashier picks/creates a customer from the side
  // drawer, auto-close it and reopen the cart sheet — otherwise there's no
  // obvious way back to encaissement (feedback: "pas de retour au
  // encaissement une chose qui peut valider quand a mis le client").
  // We detect the null→non-null transition on `customer.id` so it doesn't
  // fire when the drawer merely opens while a customer was already picked.
  useEffect(() => {
    const prev = prevCustomerIdRef.current;
    const now = customer?.id ?? null;
    prevCustomerIdRef.current = now;
    if (!sideOpen) return;
    if (prev === null && now !== null && window.matchMedia("(max-width: 767px)").matches) {
      setSideOpen(false);
      // Reopen the cart if it isn't already, so the cashier lands on the
      // charge flow with the customer attached.
      if (cart.length > 0) setCartOpen(true);
    }
  }, [customer?.id, sideOpen, cart.length]);

  // Ctrl+F (customer search) now opens the side drawer first; the
  // CustomerBlock's own focus shortcut handles the input focus once mounted.
  usePOSShortcut("customer.search", () => {
    setSideOpen(true);
  });

  const cartItemCount = cart.reduce((n, l) => n + l.quantity, 0);

  return (
    <div className="h-full md:grid flex flex-col relative md:[grid-template-columns:1fr_420px]">
      {/* Arrivee depuis « Encaisser » (agenda, verification du QR) :
          `/pos?bookingId=…`. Monte INCONDITIONNELLEMENT — cette lecture
          vivait dans `side-panel.tsx`, qui n'est rendu que si le tiroir est
          ouvert, si bien que le panier restait vide a l'arrivee. */}
      <AttacheRdvDepuisUrl defaultEmployeeId={employee.id} />

      <section className="overflow-hidden bg-pos-bg flex flex-col min-h-0 flex-1 md:flex-initial">
        <Results defaultEmployeeId={employee.id} />
      </section>

      {/* Desktop: cart inline on the right. Mobile: cart hidden, opens as bottom-sheet. */}
      <div className="hidden md:flex md:flex-col md:h-full min-h-0">
        <Cart
          employees={catalog?.employees ?? []}
          permissions={employee.permissions}
          onCharge={() => setChargeOpen(true)}
          onOpenSide={() => setSideOpen(true)}
          bookingsTodayCount={bookingsTodayCount}
        />
      </div>

      {/* Mobile action bar — bar pinned to the bottom of the screen, inset
          from the left to clear the side rail, with cart count + total +
          explicit CTA. Visible any time the cart has items; disappears when
          the sheet is open. Sized to be obviously tappable and to
          communicate "you must tap this to finalize". */}
      {cartItemCount > 0 && !cartOpen && (
        <div
          className="md:hidden fixed z-40 pr-3"
          style={{
            // Decalee de la largeur du rail (56px) pour ne pas le recouvrir.
            // Plus de bottom-bar a eviter : la barre se colle au bas de l'ecran.
            left: "56px",
            right: 0,
            bottom: "calc(env(safe-area-inset-bottom) + 12px)",
          }}
        >
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="w-full flex items-center justify-between gap-3 px-5 py-3.5 rounded-2xl bg-pos-ink text-pos-bg shadow-2xl active:scale-[0.98] transition border-2 border-pos-yellow/60"
            aria-label={`Voir le panier — ${cartItemCount} article${cartItemCount > 1 ? "s" : ""}`}
          >
            <span className="flex items-center gap-3">
              <span className="relative inline-flex items-center justify-center h-10 w-10 rounded-full bg-pos-yellow/20">
                <ShoppingCart size={22} className="text-pos-yellow" />
                <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-pos-yellow text-pos-ink text-[11px] font-bold flex items-center justify-center">
                  {cartItemCount}
                </span>
              </span>
              <span className="flex flex-col items-start leading-tight">
                <span className="text-[11px] uppercase tracking-[0.14em] text-pos-bg/70">
                  Voir panier
                </span>
                <span className="text-base font-semibold">
                  {cartItemCount} article{cartItemCount > 1 ? "s" : ""}
                </span>
              </span>
            </span>
            <span className="flex flex-col items-end leading-tight">
              <span className="text-[10px] uppercase tracking-[0.14em] text-pos-bg/70">Total</span>
              <span className="pos-mono text-lg font-semibold">
                {formatCartTotal(totals.total)} TND
              </span>
            </span>
          </button>
        </div>
      )}

      {/* Mobile bottom-sheet — full-screen drawer with the Cart inside. */}
      {cartOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col bg-pos-surface">
          <div className="flex items-center justify-between h-11 px-3 border-b border-pos-border shrink-0">
            <span className="font-semibold text-sm">Panier</span>
            <button
              type="button"
              onClick={() => setCartOpen(false)}
              aria-label="Fermer"
              className="p-2 -mr-2 text-pos-ink-3 hover:text-pos-ink"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <Cart
              employees={catalog?.employees ?? []}
              permissions={employee.permissions}
              onCharge={() => {
                setCartOpen(false);
                setChargeOpen(true);
              }}
              onOpenSide={() => setSideOpen(true)}
              bookingsTodayCount={bookingsTodayCount}
            />
          </div>
        </div>
      )}

      {/* Side drawer (Client / RDV / Recent sales).
          Desktop: absolute inside the shell, 360px wide, z-40.
          Mobile: fixed full-screen, z-[60] so it sits ABOVE the cart sheet
          (z-50) — otherwise "Ajouter cliente" opens invisibly beneath it. */}
      {sideOpen && (
        <>
          <div
            className="md:absolute fixed inset-0 md:z-30 z-[55] bg-black/30"
            onClick={() => setSideOpen(false)}
            aria-hidden="true"
          />
          <aside
            role="dialog"
            aria-modal="true"
            className="md:absolute fixed top-0 right-0 md:z-40 z-[60] h-full md:h-full h-dvh md:w-[360px] w-full bg-pos-surface border-l border-pos-border shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between px-4 h-11 border-b border-pos-border shrink-0">
              <span className="text-sm font-semibold">Client / RDV / Ventes</span>
              <button
                type="button"
                onClick={() => setSideOpen(false)}
                aria-label="Fermer"
                className="text-pos-ink-3 hover:text-pos-ink text-lg leading-none p-2 -mr-2"
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

            {/* Mobile-only sticky footer — always offers a clear way back to
                the cart. Without this the cashier lands in a dead-end after
                picking a customer, with no visible action to resume the sale. */}
            <div
              className="md:hidden shrink-0 border-t border-pos-border bg-pos-surface px-3 pt-3 flex flex-col gap-2"
              style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
            >
              {cart.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setSideOpen(false);
                    setCartOpen(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-pos-ink text-pos-bg text-sm font-semibold active:scale-[0.98] transition"
                >
                  {customer
                    ? "Retour au panier · Continuer"
                    : `Retour au panier (${cart.length})`}
                  <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setSideOpen(false)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-pos-border text-pos-ink text-sm font-medium active:scale-[0.98] transition"
                >
                  <ArrowLeft size={16} />
                  Fermer
                </button>
              )}
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
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl bg-pos-accent text-white shadow-xl animate-in fade-in slide-in-from-bottom-4"
        >
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/20 text-lg">
            ✓
          </span>
          <div className="flex-1">
            <div className="font-semibold text-sm">Paiement encaissé</div>
            <div className="text-xs opacity-90 pos-mono">
              {successToast.receiptNumber} · {successToast.total} TND
            </div>
          </div>
          {successToast.whatsappUrl && (
            <a
              href={successToast.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setSuccessToast(null)}
              className="ml-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-pos-accent text-xs font-semibold hover:bg-pos-accent-soft"
            >
              <MessageCircle size={14} /> WhatsApp
            </a>
          )}
        </div>
      )}

      <ShortcutHelpOverlay />
    </div>
  );
}

/**
 * Build a wa.me deep link from the salon's template + sale context.
 * Normalizes the customer phone to E.164 digits (removes spaces, +, leading
 * zeros for the country code). Placeholders {name}, {earned}, {balance} are
 * substituted before URL-encoding the message body.
 */
function formatCartTotal(total: string | number): string {
  const n = typeof total === "number" ? total : Number(total);
  if (!Number.isFinite(n)) return "0.000";
  return n.toFixed(3);
}

function buildWhatsappLink(
  template: string,
  ctx: { phone: string; name: string; earned: number; balance: number },
): string | null {
  // Strip everything but digits. wa.me needs no leading + and no formatting.
  const digits = ctx.phone.replace(/[^\d]/g, "");
  if (!digits) return null;
  const text = template
    .replaceAll("{name}", ctx.name || "")
    .replaceAll("{earned}", String(ctx.earned))
    .replaceAll("{balance}", String(ctx.balance));
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
