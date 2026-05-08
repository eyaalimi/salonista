"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { computeTotals, type CartInput } from "@/lib/sale-totals";
import { formatDT } from "@/lib/money";
import { tryNormalizePhone, formatPhoneDisplay } from "@/lib/phone";
import {
  refreshCatalog,
  getCachedCatalog,
  findCachedProductByBarcode,
  searchCachedCustomers,
  queueSale,
  type CachedCatalog,
} from "@/lib/pos-offline-db";
import { useOnlineStatus } from "@/components/pos/online-status";
import { ChargeModal } from "@/components/pos/charge-modal";
import { ReceiptPrintFrame, type ReceiptData } from "@/components/pos/receipt";
import { PosCalendar } from "@/components/pos/pos-calendar";
import { BookingCreateDrawer } from "@/components/pos/booking-create-drawer";
import { BookingDetailDrawer } from "@/components/pos/booking-detail-drawer";

type Permission = string;
type EmployeeProp = {
  id: string;
  displayName: string;
  role: string;
  permissions: Record<Permission, boolean>;
};

type Catalog = NonNullable<CachedCatalog>;
type CatalogOffer = Catalog["offers"][number];
type CatalogProduct = Catalog["products"][number];
type CatalogCustomer = Catalog["customers"][number];

export type CartLine = {
  uid: string;
  kind: "SERVICE" | "PRODUCT";
  offerId?: string;
  productId?: string;
  nameSnapshot: string;
  priceSnapshot: string;
  taxRateSnapshot: string;
  quantity: number;
  discount?: { value: string; isPercent: boolean };
  assignedEmployeeId?: string;
};

function uuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function PosClient({ employee }: { employee: EmployeeProp }) {
  const { online, triggerSync } = useOnlineStatus();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [tab, setTab] = useState<"services" | "products">("services");
  const [search, setSearch] = useState("");
  const [barcode, setBarcode] = useState("");
  const [barcodeError, setBarcodeError] = useState(false);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [saleDiscount, setSaleDiscount] = useState<
    { value: string; isPercent: boolean } | null
  >(null);
  const [tipTotal, setTipTotal] = useState("0.000");
  const [notes, setNotes] = useState("");

  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<CatalogCustomer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CatalogCustomer | null>(null);
  const [customerCreating, setCustomerCreating] = useState(false);

  const [chargeOpen, setChargeOpen] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<ReceiptData | null>(null);
  const [printNow, setPrintNow] = useState(false);

  // Phase 3: center-panel mode toggle.
  const [centerMode, setCenterMode] = useState<"cart" | "calendar">("cart");
  const [bookingDraft, setBookingDraft] = useState<Date | null>(null);
  const [openBookingId, setOpenBookingId] = useState<string | null>(null);
  const [convertingFromBooking, setConvertingFromBooking] = useState<{
    id: string;
    customerLabel: string;
    when: string;
  } | null>(null);

  const barcodeRef = useRef<HTMLInputElement | null>(null);

  // Load catalog from server (or cache).
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

  // Auto-focus barcode input when products tab is active.
  useEffect(() => {
    if (tab === "products") {
      barcodeRef.current?.focus();
    }
  }, [tab]);

  // Customer search (debounced via simple effect).
  useEffect(() => {
    let active = true;
    const t = setTimeout(async () => {
      if (!customerSearch.trim()) {
        setCustomerResults([]);
        return;
      }
      const cached = await searchCachedCustomers(customerSearch);
      if (active) setCustomerResults(cached.slice(0, 8));
    }, 200);
    return () => {
      clearTimeout(t);
      active = false;
    };
  }, [customerSearch]);

  // Print receipt when requested.
  useEffect(() => {
    if (lastReceipt && printNow) {
      const id = setTimeout(() => {
        window.print();
        setPrintNow(false);
      }, 200);
      return () => clearTimeout(id);
    }
  }, [lastReceipt, printNow]);

  const totals = useMemo(() => {
    const cartInput: CartInput = {
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
    };
    return computeTotals(cartInput);
  }, [cart, saleDiscount, tipTotal]);

  function addOffer(offer: CatalogOffer) {
    setCart((c) => [
      ...c,
      {
        uid: uuid(),
        kind: "SERVICE",
        offerId: offer.id,
        nameSnapshot: offer.title,
        priceSnapshot: String(offer.discountPrice),
        taxRateSnapshot: String(offer.taxRate),
        quantity: 1,
        assignedEmployeeId: employee.id,
      },
    ]);
  }

  function addProduct(product: CatalogProduct) {
    setCart((c) => {
      // Coalesce same-product lines (qty++) for ergonomics.
      const existing = c.find((l) => l.productId === product.id);
      if (existing) {
        return c.map((l) =>
          l.uid === existing.uid ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [
        ...c,
        {
          uid: uuid(),
          kind: "PRODUCT",
          productId: product.id,
          nameSnapshot: product.name,
          priceSnapshot: String(product.salePrice),
          taxRateSnapshot: String(product.taxRate),
          quantity: 1,
        },
      ];
    });
  }

  async function handleBarcodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = barcode.trim();
    if (!code) return;
    const cached = await findCachedProductByBarcode(code);
    if (cached) {
      addProduct(cached);
      setBarcode("");
      setBarcodeError(false);
      return;
    }
    if (online) {
      try {
        const res = await fetch(
          `/api/pos/products/lookup?barcode=${encodeURIComponent(code)}`,
        );
        const data = await res.json();
        if (data.found) {
          addProduct({
            id: data.product.id,
            name: data.product.name,
            description: data.product.description ?? null,
            category: data.product.category ?? null,
            sku: data.product.sku,
            barcode: data.product.barcode ?? null,
            salePrice: String(data.product.salePrice),
            taxRate: String(data.product.taxRate),
            stockQuantity: data.product.stockQuantity ?? 0,
            lowStockThreshold: data.product.lowStockThreshold ?? 0,
            photo: data.product.photo ?? null,
          });
          setBarcode("");
          setBarcodeError(false);
          return;
        }
      } catch {
        // fall through
      }
    }
    setBarcodeError(true);
    setTimeout(() => setBarcodeError(false), 1200);
  }

  function updateLine(uid: string, patch: Partial<CartLine>) {
    setCart((c) => c.map((l) => (l.uid === uid ? { ...l, ...patch } : l)));
  }

  function removeLine(uid: string) {
    setCart((c) => c.filter((l) => l.uid !== uid));
  }

  function clearCart() {
    if (cart.length === 0) return;
    if (!confirm("Vider le panier ?")) return;
    setCart([]);
    setSaleDiscount(null);
    setTipTotal("0.000");
    setNotes("");
    setSelectedCustomer(null);
  }

  async function handleSold(receipt: ReceiptData, shouldPrint: boolean) {
    setLastReceipt(receipt);
    setPrintNow(shouldPrint);
    setCart([]);
    setSaleDiscount(null);
    setTipTotal("0.000");
    setNotes("");
    setSelectedCustomer(null);
    setChargeOpen(false);
    if (online) {
      // Best-effort catalog refresh (stock changed).
      refreshCatalog().catch(() => {});
    } else {
      triggerSync().catch(() => {});
    }
  }

  const offers = catalog?.offers ?? [];
  const products = catalog?.products ?? [];
  const employees = catalog?.employees ?? [];

  const filteredOffers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return offers;
    return offers.filter((o) => o.title.toLowerCase().includes(q));
  }, [offers, search]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode ?? "").includes(q),
    );
  }, [products, search]);

  const canDiscount = !!employee.permissions["pos.discount"];

  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr_360px] h-full">
      {/* Customer panel */}
      <aside className="border-r border-brand-line bg-white p-5 overflow-y-auto">
        <p className="luxury-badge mb-2">Client</p>
        {!selectedCustomer ? (
          <>
            <input
              type="text"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              placeholder="Téléphone ou nom"
              className="w-full rounded-lg border border-brand-line bg-brand-cream px-3 py-2 text-sm focus:border-brand-gold focus:outline-none"
            />
            <ul className="mt-3 space-y-1">
              {customerResults.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedCustomer(c)}
                    className="w-full rounded-lg border border-brand-line bg-brand-sand p-3 text-left hover:border-brand-gold"
                  >
                    <div className="text-sm font-medium text-brand-ink">
                      {[c.firstName, c.lastName].filter(Boolean).join(" ") || "Sans nom"}
                    </div>
                    <div className="text-xs text-brand-ink-soft">
                      {formatPhoneDisplay(c.phone)}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setCustomerCreating(true)}
                disabled={!online}
                className="rounded-lg border border-brand-line bg-white px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-brand-ink hover:border-brand-gold disabled:opacity-50"
              >
                {online ? "+ Ajouter un client" : "Création hors ligne indisponible"}
              </button>
              <button
                type="button"
                onClick={() => setSelectedCustomer({ id: "__walkin__", phone: "", firstName: "Vente sans client", lastName: null, email: null })}
                className="rounded-lg bg-brand-ink px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-brand-cream hover:bg-brand-ink-soft"
              >
                Vente sans client
              </button>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-brand-line bg-brand-sand p-4">
            <p className="luxury-heading text-base text-brand-ink">
              {[selectedCustomer.firstName, selectedCustomer.lastName].filter(Boolean).join(" ") || "Vente sans client"}
            </p>
            {selectedCustomer.phone && (
              <p className="text-xs text-brand-ink-soft mt-1">
                {formatPhoneDisplay(selectedCustomer.phone)}
              </p>
            )}
            <button
              type="button"
              onClick={() => setSelectedCustomer(null)}
              className="mt-4 text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft hover:text-brand-ink"
            >
              Changer
            </button>
          </div>
        )}

        {customerCreating && online && (
          <CustomerCreator
            onCreated={(c) => {
              setSelectedCustomer(c);
              setCustomerCreating(false);
              refreshCatalog().catch(() => {});
            }}
            onCancel={() => setCustomerCreating(false)}
          />
        )}
      </aside>

      {/* Cart / Calendar panel */}
      <section className="bg-brand-cream/50 flex flex-col overflow-hidden">
        {/* Mode toggle */}
        <div className="border-b border-brand-line bg-white px-3 py-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCenterMode("cart")}
            className={`flex-1 rounded-lg py-1.5 text-[10px] uppercase tracking-[0.18em] ${
              centerMode === "cart"
                ? "bg-brand-ink text-brand-cream"
                : "border border-brand-line bg-white text-brand-ink-soft"
            }`}
          >
            Panier {cart.length > 0 ? `(${cart.length})` : ""}
          </button>
          <button
            type="button"
            onClick={() => setCenterMode("calendar")}
            className={`flex-1 rounded-lg py-1.5 text-[10px] uppercase tracking-[0.18em] ${
              centerMode === "calendar"
                ? "bg-brand-ink text-brand-cream"
                : "border border-brand-line bg-white text-brand-ink-soft"
            }`}
          >
            Calendrier
          </button>
        </div>

        {centerMode === "calendar" ? (
          <div className="flex-1 overflow-hidden">
            <PosCalendar
              onCreateAt={(start) => {
                if (!online) return;
                setBookingDraft(start);
              }}
              onOpenBooking={(id) => setOpenBookingId(id)}
            />
          </div>
        ) : (
        <>
        <div className="flex-1 overflow-y-auto p-5">
          {convertingFromBooking && (
            <div className="mb-3 rounded-lg border border-brand-gold bg-brand-gold-soft/40 px-4 py-3">
              <p className="text-xs text-brand-ink">
                Encaissement de la réservation —{" "}
                <span className="font-medium">{convertingFromBooking.customerLabel}</span> ·{" "}
                {convertingFromBooking.when}
              </p>
              <button
                type="button"
                onClick={() => {
                  setConvertingFromBooking(null);
                  setCart([]);
                }}
                className="mt-1 text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft hover:text-brand-ink"
              >
                Annuler la conversion
              </button>
            </div>
          )}
          {cart.length === 0 ? (
            <p className="mt-12 text-center text-sm text-brand-ink-soft">
              Panier vide. Sélectionnez un service ou un produit, ou scannez un code-barres.
            </p>
          ) : (
            <ul className="space-y-3">
              {cart.map((line, i) => {
                const computedLine = totals.lines[i];
                return (
                  <li
                    key={line.uid}
                    className="rounded-2xl border border-brand-line bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="font-medium text-brand-ink">{line.nameSnapshot}</p>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft">
                          {line.kind === "SERVICE" ? "Service" : "Produit"} —{" "}
                          {formatDT(line.priceSnapshot)} TTC
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLine(line.uid)}
                        className="text-brand-ink-soft hover:text-red-600 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 items-center">
                      {line.kind === "PRODUCT" && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateLine(line.uid, { quantity: Math.max(1, line.quantity - 1) })}
                            className="h-8 w-8 rounded border border-brand-line bg-white text-brand-ink"
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-sm">{line.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateLine(line.uid, { quantity: line.quantity + 1 })}
                            className="h-8 w-8 rounded border border-brand-line bg-white text-brand-ink"
                          >
                            +
                          </button>
                        </div>
                      )}
                      <select
                        value={line.assignedEmployeeId ?? ""}
                        onChange={(e) =>
                          updateLine(line.uid, {
                            assignedEmployeeId: e.target.value || undefined,
                          })
                        }
                        className="rounded-lg border border-brand-line bg-white px-2 py-1 text-xs"
                      >
                        <option value="">Coiffeur·euse…</option>
                        {employees.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.displayName}
                          </option>
                        ))}
                      </select>
                      <LineDiscountControl
                        line={line}
                        canEdit={canDiscount}
                        onChange={(d) => updateLine(line.uid, { discount: d ?? undefined })}
                      />
                      <div className="text-right">
                        <p className="font-semibold text-brand-ink">
                          {formatDT(computedLine.lineTotal)}
                        </p>
                        <p className="text-[10px] text-brand-ink-soft">
                          TVA {line.taxRateSnapshot}%
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Sale-level controls */}
        <div className="border-t border-brand-line bg-white p-4 space-y-3">
          {canDiscount && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft">
                Remise vente
              </span>
              <SaleDiscountControl value={saleDiscount} onChange={setSaleDiscount} />
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft">
              Pourboire
            </span>
            <input
              type="number"
              step="0.001"
              min="0"
              value={tipTotal}
              onChange={(e) => setTipTotal(e.target.value || "0.000")}
              className="w-24 rounded border border-brand-line bg-white px-2 py-1 text-sm"
            />
            <span className="text-xs text-brand-ink-soft">DT</span>
          </div>
          <details className="text-xs">
            <summary className="cursor-pointer text-brand-ink-soft">Ajouter une note</summary>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-2 w-full rounded border border-brand-line bg-white px-2 py-1 text-sm"
            />
          </details>
        </div>

        {/* Bottom action bar */}
        <div className="bg-brand-ink text-brand-cream px-4 py-3 flex flex-wrap items-center gap-4">
          <span className="text-xs">Sous-total: {formatDT(totals.subtotal)}</span>
          {Number(totals.saleDiscountAmount) > 0 && (
            <span className="text-xs">Remise: -{formatDT(totals.saleDiscountAmount)}</span>
          )}
          {Number(totals.tipTotal) > 0 && (
            <span className="text-xs">Pourboire: {formatDT(totals.tipTotal)}</span>
          )}
          <span className="text-xs">TVA: {formatDT(totals.taxTotal)}</span>
          <span className="ml-auto luxury-heading text-xl">
            Total: {formatDT(totals.total)}
          </span>
          <button
            type="button"
            onClick={clearCart}
            disabled={cart.length === 0}
            className="text-xs uppercase tracking-[0.18em] text-brand-cream/60 hover:text-brand-cream disabled:opacity-30"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => setChargeOpen(true)}
            disabled={cart.length === 0}
            className="rounded-lg bg-brand-gold px-6 py-3 text-xs uppercase tracking-[0.18em] text-brand-ink hover:bg-brand-gold-soft disabled:opacity-40"
          >
            Encaisser
          </button>
        </div>
        </>
        )}
      </section>

      {/* Catalog panel */}
      <aside className="border-l border-brand-line bg-white flex flex-col overflow-hidden">
        <div className="border-b border-brand-line p-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTab("services")}
              className={`flex-1 rounded-lg py-2 text-[10px] uppercase tracking-[0.18em] ${
                tab === "services"
                  ? "bg-brand-ink text-brand-cream"
                  : "border border-brand-line bg-white text-brand-ink-soft"
              }`}
            >
              Services
            </button>
            <button
              type="button"
              onClick={() => setTab("products")}
              className={`flex-1 rounded-lg py-2 text-[10px] uppercase tracking-[0.18em] ${
                tab === "products"
                  ? "bg-brand-ink text-brand-cream"
                  : "border border-brand-line bg-white text-brand-ink-soft"
              }`}
            >
              Produits
            </button>
          </div>
          {tab === "products" && (
            <form onSubmit={handleBarcodeSubmit} className="mt-3">
              <input
                ref={barcodeRef}
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Code-barres (scanner ou manuel)"
                className={`w-full rounded-lg border bg-brand-cream px-3 py-2 text-sm focus:outline-none ${
                  barcodeError
                    ? "border-red-400 bg-red-50"
                    : "border-brand-line focus:border-brand-gold"
                }`}
              />
            </form>
          )}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="mt-2 w-full rounded-lg border border-brand-line bg-brand-cream px-3 py-2 text-sm focus:border-brand-gold focus:outline-none"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {tab === "services" ? (
            <ul>
              {filteredOffers.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => addOffer(o)}
                    className="w-full border-b border-brand-line p-3 text-left hover:bg-brand-sand"
                  >
                    <p className="font-medium text-brand-ink">{o.title}</p>
                    <p className="text-xs text-brand-ink-soft">
                      {o.durationMinutes} min · {formatDT(String(o.discountPrice))} TTC ·
                      TVA {o.taxRate}%
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <ul>
              {filteredProducts.map((p) => {
                const stockColor =
                  p.stockQuantity <= 0
                    ? "text-red-600"
                    : p.stockQuantity <= p.lowStockThreshold
                      ? "text-amber-700"
                      : "text-emerald-700";
                const stockLabel =
                  p.stockQuantity <= 0
                    ? "Rupture"
                    : p.stockQuantity <= p.lowStockThreshold
                      ? "Stock faible"
                      : "En stock";
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (p.stockQuantity <= 0 && !confirm("Rupture de stock — vendre quand même ?"))
                          return;
                        addProduct(p);
                      }}
                      className="w-full border-b border-brand-line p-3 text-left hover:bg-brand-sand"
                    >
                      <div className="flex justify-between">
                        <p className="font-medium text-brand-ink">{p.name}</p>
                        <span className={`text-[10px] uppercase tracking-[0.15em] ${stockColor}`}>
                          {stockLabel}
                        </span>
                      </div>
                      <p className="text-xs text-brand-ink-soft">
                        SKU {p.sku} · {formatDT(String(p.salePrice))} TTC · TVA {p.taxRate}%
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* Charge modal */}
      {chargeOpen && (
        <ChargeModal
          cart={cart}
          totals={totals}
          customerId={
            selectedCustomer && selectedCustomer.id !== "__walkin__" && selectedCustomer.id !== "__from-booking__"
              ? selectedCustomer.id
              : null
          }
          customerEmail={selectedCustomer?.email ?? null}
          notes={notes}
          employees={employees}
          tipTotal={tipTotal}
          saleDiscount={saleDiscount}
          provider={catalog?.provider ?? null}
          employee={employee}
          online={online}
          bookingId={convertingFromBooking?.id ?? null}
          wallet={
            selectedCustomer && "wallet" in selectedCustomer && selectedCustomer.wallet
              ? selectedCustomer.wallet
              : null
          }
          onClose={() => setChargeOpen(false)}
          onCompleted={(receipt, shouldPrint) => {
            handleSold(receipt, shouldPrint);
            setConvertingFromBooking(null);
          }}
          queueOffline={queueSale}
        />
      )}

      {/* Booking create drawer (calendar slot click) */}
      {bookingDraft && (
        <BookingCreateDrawer
          initialStart={bookingDraft}
          online={online}
          defaultEmployeeId={employee.id}
          onClose={() => setBookingDraft(null)}
          onCreated={() => {
            setBookingDraft(null);
          }}
        />
      )}

      {/* Booking detail drawer */}
      {openBookingId && (
        <BookingDetailDrawer
          bookingId={openBookingId}
          canSell={!!employee.permissions["pos.sell"]}
          canCancel={!!employee.permissions["bookings.cancel"]}
          canEdit={!!employee.permissions["bookings.edit"]}
          onClose={() => setOpenBookingId(null)}
          onChanged={async () => {
            // Trigger calendar reload by toggling mode
            setCenterMode("calendar");
          }}
          onEncaisser={(booking) => {
            // Prefill cart from the booking's items. Match by offerId
            // (not title) so renamed offers still resolve correctly and
            // collisions on duplicate titles can't substitute the wrong
            // offer.
            const newLines: CartLine[] = booking.items.map((it) => ({
              uid: uuid(),
              kind: "SERVICE",
              offerId: it.offer.id,
              nameSnapshot: it.offer.title,
              priceSnapshot: String(it.offer.discountPrice),
              taxRateSnapshot: String(it.offer.taxRate),
              quantity: 1,
              assignedEmployeeId: employee.id,
            }));
            setCart(newLines);
            // Snap customer.
            const c = catalog?.customers.find(
              (c) => c.phone === booking.customer?.phone,
            );
            setSelectedCustomer(c ?? (booking.customer ? {
              id: "__from-booking__",
              phone: booking.customer.phone,
              firstName: booking.customer.firstName,
              lastName: booking.customer.lastName,
              email: null,
            } : null));
            const customerLabel = booking.customer
              ? [booking.customer.firstName, booking.customer.lastName].filter(Boolean).join(" ") ||
                booking.customer.phone
              : "Walk-in";
            const when = booking.items[0]?.slot
              ? new Date(booking.items[0].slot.startTime).toLocaleString("fr-FR")
              : new Date(booking.createdAt).toLocaleString("fr-FR");
            setConvertingFromBooking({ id: booking.id, customerLabel, when });
            setCenterMode("cart");
            setOpenBookingId(null);
          }}
        />
      )}

      {/* Hidden receipt printer */}
      {lastReceipt && <ReceiptPrintFrame data={lastReceipt} />}
    </div>
  );
}

function LineDiscountControl({
  line,
  canEdit,
  onChange,
}: {
  line: CartLine;
  canEdit: boolean;
  onChange: (d: { value: string; isPercent: boolean } | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(line.discount?.value ?? "");
  const [isPercent, setIsPercent] = useState(line.discount?.isPercent ?? true);

  if (!canEdit) return <div />;

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft hover:text-brand-ink"
      >
        {line.discount
          ? `${line.discount.value}${line.discount.isPercent ? "%" : " DT"}`
          : "+ Remise"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        step="0.01"
        min="0"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-16 rounded border border-brand-line bg-white px-1 py-0.5 text-xs"
      />
      <select
        value={isPercent ? "%" : "DT"}
        onChange={(e) => setIsPercent(e.target.value === "%")}
        className="rounded border border-brand-line bg-white px-1 py-0.5 text-xs"
      >
        <option value="%">%</option>
        <option value="DT">DT</option>
      </select>
      <button
        type="button"
        onClick={() => {
          if (!value) {
            onChange(null);
          } else {
            onChange({ value, isPercent });
          }
          setEditing(false);
        }}
        className="text-[10px] text-brand-gold"
      >
        ✓
      </button>
    </div>
  );
}

function SaleDiscountControl({
  value,
  onChange,
}: {
  value: { value: string; isPercent: boolean } | null;
  onChange: (d: { value: string; isPercent: boolean } | null) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        step="0.01"
        min="0"
        value={value?.value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) onChange(null);
          else onChange({ value: v, isPercent: value?.isPercent ?? true });
        }}
        placeholder="0"
        className="w-20 rounded border border-brand-line bg-white px-2 py-1 text-sm"
      />
      <select
        value={value?.isPercent === false ? "DT" : "%"}
        onChange={(e) => {
          if (!value) return;
          onChange({ ...value, isPercent: e.target.value === "%" });
        }}
        className="rounded border border-brand-line bg-white px-2 py-1 text-sm"
      >
        <option value="%">%</option>
        <option value="DT">DT</option>
      </select>
    </div>
  );
}

function CustomerCreator({
  onCreated,
  onCancel,
}: {
  onCreated: (c: CatalogCustomer) => void;
  onCancel: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const normalized = tryNormalizePhone(phone);
    if (!normalized) {
      setError("Numéro invalide");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: normalized,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Erreur");
        return;
      }
      const customer = await res.json();
      onCreated({
        id: customer.id,
        phone: customer.phone,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email ?? null,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-4 rounded-2xl border border-brand-line bg-brand-sand p-4 space-y-2"
    >
      <input
        type="text"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Téléphone"
        className="w-full rounded border border-brand-line bg-white px-2 py-1 text-sm"
      />
      <input
        type="text"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        placeholder="Prénom"
        className="w-full rounded border border-brand-line bg-white px-2 py-1 text-sm"
      />
      <input
        type="text"
        value={lastName}
        onChange={(e) => setLastName(e.target.value)}
        placeholder="Nom"
        className="w-full rounded border border-brand-line bg-white px-2 py-1 text-sm"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-brand-ink px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-brand-cream disabled:opacity-50"
        >
          Créer
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-brand-line bg-white px-3 py-1 text-[10px] uppercase tracking-[0.18em]"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
