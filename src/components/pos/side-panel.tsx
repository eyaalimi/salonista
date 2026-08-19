"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { usePosStore, type CustomerLite } from "@/lib/pos-store";
import { formatDT } from "@/lib/money";
import { tryNormalizePhone, formatPhoneDisplay } from "@/lib/phone";
import {
  searchCachedCustomers,
  findCachedCustomerByPhone,
} from "@/lib/pos-offline-db";
import { usePOSShortcut } from "@/lib/use-pos-shortcuts";
import { getShortcutLabel } from "@/lib/pos-shortcuts";

type Permission = string;

type Booking = {
  id: string;
  startTime: string;
  endTime: string | null;
  status: string;
  saleId: string | null;
  customer: { id: string; phone: string; firstName: string | null; lastName: string | null } | null;
  items: Array<{ offerId: string; name: string; duration: number; price: string; taxRate: string }>;
};

type RecentSale = {
  id: string;
  receiptNumber: string;
  total: string;
  createdAt: string;
};

export function SidePanel({
  defaultEmployeeId,
  permissions,
}: {
  defaultEmployeeId: string;
  permissions: Record<Permission, boolean>;
}) {
  return (
    <div className="bg-pos-surface flex flex-col h-full">
      {permissions["customers.view"] && <CustomerBlock />}
      {permissions["bookings.view"] && (
        <BookingsTodayBlock defaultEmployeeId={defaultEmployeeId} />
      )}
      {permissions["pos.sell"] && <RecentSalesBlock />}
    </div>
  );
}

function CustomerBlock() {
  const customer = usePosStore((s) => s.customer);
  const setCustomer = usePosStore((s) => s.setCustomer);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [serverHits, setServerHits] = useState<CustomerLite[]>([]);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [walkInName, setWalkInName] = useState("");
  const [walkInBusy, setWalkInBusy] = useState(false);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newBusy, setNewBusy] = useState(false);
  const [newError, setNewError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function createCustomer() {
    setNewBusy(true);
    setNewError(null);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: newPhone.trim(),
          firstName: newFirstName.trim() || undefined,
          lastName: newLastName.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setNewError(data?.error ?? "Erreur lors de la création");
        return;
      }
      // If 200 (already exists in this salon) or 201 (new), `data` is the customer.
      setCustomer({
        id: data.id,
        phone: data.phone,
        firstName: data.firstName ?? null,
        lastName: data.lastName ?? null,
        email: data.email ?? null,
      });
      setNewCustomerOpen(false);
      setNewPhone("");
      setNewFirstName("");
      setNewLastName("");
    } finally {
      setNewBusy(false);
    }
  }

  async function createWalkIn() {
    setWalkInBusy(true);
    try {
      const res = await fetch("/api/customers/walk-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: walkInName.trim() || undefined }),
      });
      if (res.ok) {
        const c = (await res.json()) as CustomerLite;
        setCustomer(c);
        setWalkInOpen(false);
        setWalkInName("");
      }
    } finally {
      setWalkInBusy(false);
    }
  }

  usePOSShortcut("customer.search", () => {
    inputRef.current?.focus();
  });

  // Debounced live search (phone OR name) — hits the POS-scoped search API
  // and falls back to the offline cache if the network is down.
  useEffect(() => {
    if (query.trim().length < 2) {
      setServerHits([]);
      return;
    }
    const id = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/pos/customers/search?q=${encodeURIComponent(query.trim())}`,
        );
        if (res.ok) {
          const data = (await res.json()) as { customers: CustomerLite[] };
          setServerHits(data.customers ?? []);
        } else {
          setServerHits([]);
        }
      } catch {
        setServerHits([]);
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => clearTimeout(id);
  }, [query]);

  // Enter on the input picks the top suggestion, OR if the query looks like
  // a phone number, falls back to the legacy phone-lookup endpoint (offline-safe).
  async function onSubmit() {
    if (serverHits.length > 0) {
      setCustomer(serverHits[0]);
      setQuery("");
      setServerHits([]);
      return;
    }
    // Phone fallback (offline cache)
    const norm = tryNormalizePhone(query);
    if (norm) {
      const cached = await findCachedCustomerByPhone(norm);
      if (cached) {
        setCustomer(cached);
        setQuery("");
      }
    }
  }

  return (
    <section className="border-b border-pos-border p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] uppercase tracking-[0.18em] text-pos-ink-3">Client</h3>
        <kbd>{getShortcutLabel("customer.search")}</kbd>
      </div>
      <div className="relative mb-3">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-pos-ink-4" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (void onSubmit())}
          placeholder="Nom ou téléphone…"
          className="w-full text-sm bg-pos-bg border border-pos-border rounded pl-8 pr-2 py-1.5"
        />
      </div>

      {!customer && serverHits.length > 0 && (
        <ul className="mb-3 space-y-1 bg-pos-bg border border-pos-border rounded p-1">
          {serverHits.map((c) => {
            const name = `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim();
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    setCustomer(c);
                    setQuery("");
                    setServerHits([]);
                  }}
                  className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-pos-highlight"
                >
                  <div className="font-medium text-pos-ink">{name || "Sans nom"}</div>
                  {c.phone && (
                    <div className="pos-mono text-pos-ink-3 text-[10px]">
                      {formatPhoneDisplay(c.phone)}
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {customer ? (
        <div>
          <div className="font-medium text-sm">
            {customer.firstName} {customer.lastName}
          </div>
          <div className="text-xs text-pos-ink-3 pos-mono">
            {formatPhoneDisplay(customer.phone)}
          </div>
          {customer.wallet && (
            <div className="mt-3 bg-pos-ink text-pos-bg p-2 rounded text-xs">
              <span className="text-pos-yellow">★</span> {customer.wallet.balance} pts
              <span className="text-pos-ink-4 ml-2">
                ≈{" "}
                {formatDT(
                  String(
                    Math.round(customer.wallet.balance * Number(customer.wallet.dinarPerPoint) * 1000) /
                      1000,
                  ),
                )}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setCustomer(null)}
            className="mt-2 text-[10px] uppercase tracking-[0.18em] text-pos-ink-3 hover:text-pos-ink"
          >
            Retirer
          </button>
        </div>
      ) : (
        <p className="text-xs text-pos-ink-3">
          Aucun client sélectionné. {searching ? "Recherche…" : "Cherchez par nom ou téléphone."}
        </p>
      )}
      {!customer && serverHits.length === 0 && query.length >= 2 && !searching && (
        <CustomerCachedSuggestions
          phone={query}
          onPick={(c) => {
            setCustomer(c);
            setQuery("");
          }}
        />
      )}

      {!customer && !walkInOpen && !newCustomerOpen && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setNewCustomerOpen(true)}
            className="text-xs font-medium bg-pos-accent text-white border border-pos-accent rounded py-2 hover:bg-pos-accent/90"
          >
            + Nouvelle cliente
          </button>
          <button
            type="button"
            onClick={() => setWalkInOpen(true)}
            className="text-xs text-pos-ink-2 border border-dashed border-pos-border rounded py-2 hover:border-pos-accent hover:text-pos-ink"
          >
            + Client passager
          </button>
        </div>
      )}

      {!customer && newCustomerOpen && (
        <div className="mt-3 space-y-2 p-3 rounded-md border border-pos-accent/40 bg-pos-accent/5">
          <div className="text-[10px] uppercase tracking-[0.18em] text-pos-accent font-semibold">
            Nouvelle cliente
          </div>
          <input
            type="tel"
            autoFocus
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            placeholder="Téléphone (obligatoire) — ex: 22 345 678"
            className="w-full text-sm bg-white border border-pos-border rounded px-2 py-1.5 pos-mono"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={newFirstName}
              onChange={(e) => setNewFirstName(e.target.value)}
              placeholder="Prénom"
              className="w-full text-sm bg-white border border-pos-border rounded px-2 py-1.5"
            />
            <input
              type="text"
              value={newLastName}
              onChange={(e) => setNewLastName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newPhone.trim()) void createCustomer();
              }}
              placeholder="Nom"
              className="w-full text-sm bg-white border border-pos-border rounded px-2 py-1.5"
            />
          </div>
          {newError && (
            <p className="text-[11px] text-pos-danger bg-pos-danger-soft px-2 py-1 rounded">
              {newError}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={createCustomer}
              disabled={newBusy || !newPhone.trim()}
              className="flex-1 text-xs bg-pos-accent text-white rounded py-1.5 disabled:opacity-50 hover:bg-pos-accent/90 font-medium"
            >
              {newBusy ? "…" : "Créer & sélectionner"}
            </button>
            <button
              type="button"
              onClick={() => {
                setNewCustomerOpen(false);
                setNewError(null);
                setNewPhone("");
                setNewFirstName("");
                setNewLastName("");
              }}
              className="text-xs text-pos-ink-3 px-2 hover:text-pos-ink"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {!customer && walkInOpen && (
        <div className="mt-3 space-y-2">
          <input
            type="text"
            autoFocus
            value={walkInName}
            onChange={(e) => setWalkInName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (void createWalkIn())}
            placeholder="Nom (facultatif)"
            className="w-full text-sm bg-pos-bg border border-pos-border rounded px-2 py-1.5"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={createWalkIn}
              disabled={walkInBusy}
              className="flex-1 text-xs bg-pos-ink text-pos-bg rounded py-1.5 disabled:opacity-50"
            >
              {walkInBusy ? "…" : "Ajouter"}
            </button>
            <button
              type="button"
              onClick={() => {
                setWalkInOpen(false);
                setWalkInName("");
              }}
              className="text-xs text-pos-ink-3 px-2"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function CustomerCachedSuggestions({
  phone,
  onPick,
}: {
  phone: string;
  onPick: (c: CustomerLite) => void;
}) {
  const [cands, setCands] = useState<CustomerLite[]>([]);
  useEffect(() => {
    if (phone.length < 3) {
      setCands([]);
      return;
    }
    void (async () => {
      const list = await searchCachedCustomers(phone);
      setCands(list.slice(0, 5));
    })();
  }, [phone]);

  if (cands.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1">
      {cands.map((c) => (
        <li key={c.id}>
          <button
            type="button"
            onClick={() => onPick(c)}
            className="w-full text-left text-xs px-2 py-1 rounded hover:bg-pos-highlight"
          >
            {c.firstName} {c.lastName}{" "}
            <span className="pos-mono text-pos-ink-3">{formatPhoneDisplay(c.phone)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function BookingsTodayBlock({ defaultEmployeeId }: { defaultEmployeeId: string }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const attachBooking = usePosStore((s) => s.attachBooking);
  const addLine = usePosStore((s) => s.addLine);
  const setCustomer = usePosStore((s) => s.setCustomer);
  const customer = usePosStore((s) => s.customer);

  async function load() {
    const res = await fetch("/api/pos/bookings/today");
    if (res.ok) {
      const data = (await res.json()) as { bookings: Booking[] };
      setBookings(data.bookings);
    }
    setLoading(false);
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  function handlePick(b: Booking) {
    // Guard against double-click attaching the same booking twice — the
    // second attach would orphan the first set of pre-filled lines (their
    // UIDs are no longer in bookingPrefilledLineUids and detachBooking
    // would never be able to remove them).
    const { attachedBookingId } = usePosStore.getState();
    if (attachedBookingId === b.id) return;

    if (b.customer && customer?.id !== b.customer.id) {
      setCustomer({
        id: b.customer.id,
        phone: b.customer.phone,
        firstName: b.customer.firstName,
        lastName: b.customer.lastName,
        email: null,
      });
    }
    const uids: string[] = [];
    for (const it of b.items) {
      const uid = `cl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      uids.push(uid);
      addLine({
        uid,
        kind: "SERVICE",
        offerId: it.offerId,
        nameSnapshot: it.name,
        priceSnapshot: it.price,
        taxRateSnapshot: it.taxRate,
        quantity: 1,
        assignedEmployeeId: defaultEmployeeId,
      });
    }
    attachBooking(b.id, uids);
  }

  return (
    <section className="border-b border-pos-border p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] uppercase tracking-[0.18em] text-pos-ink-3">RDV aujourd&apos;hui</h3>
        <kbd>B</kbd>
      </div>
      {loading ? (
        <p className="text-xs text-pos-ink-3">Chargement…</p>
      ) : bookings.length === 0 ? (
        <p className="text-xs text-pos-ink-3">
          Aucun RDV aujourd&apos;hui. Les nouvelles réservations s&apos;affichent ici.
        </p>
      ) : (
        <ul className="space-y-1">
          {bookings.map((b) => {
            const start = new Date(b.startTime);
            const end = b.endTime ? new Date(b.endTime) : null;
            const now = Date.now();
            const past = end ? end.getTime() < now : start.getTime() < now;
            const inProgress = end ? start.getTime() <= now && now <= end.getTime() : false;
            const charged = !!b.saleId;
            return (
              <li key={b.id}>
                <button
                  type="button"
                  disabled={charged}
                  onClick={() => handlePick(b)}
                  className={`w-full text-left rounded px-2 py-2 text-xs flex items-start gap-2 ${
                    inProgress
                      ? "bg-pos-accent-soft border-l-2 border-pos-accent"
                      : past
                        ? "opacity-60"
                        : "hover:bg-pos-highlight"
                  } ${charged ? "opacity-40 cursor-not-allowed" : ""}`}
                >
                  <span className="pos-mono font-semibold w-12 shrink-0">
                    {String(start.getHours()).padStart(2, "0")}:
                    {String(start.getMinutes()).padStart(2, "0")}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium truncate">
                      {b.customer
                        ? `${b.customer.firstName ?? ""} ${b.customer.lastName ?? ""}`
                        : "—"}
                    </span>
                    <span className="block text-pos-ink-3 truncate">
                      {b.items.map((i) => i.name).join(" + ")}
                    </span>
                    {charged && (
                      <span className="block text-[10px] text-pos-accent">→ encaissé</span>
                    )}
                    {inProgress && (
                      <span className="block text-[10px] text-pos-accent">en cours</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function RecentSalesBlock() {
  const [sales, setSales] = useState<RecentSale[]>([]);
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    fetch(`/api/pos/sales?from=${today.toISOString()}&limit=5`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Array<{ id: string; receiptNumber: string; total: string; createdAt: string }>) => {
        setSales(data.slice(0, 5));
      });
  }, []);

  return (
    <section className="p-4">
      <h3 className="text-[10px] uppercase tracking-[0.18em] text-pos-ink-3 mb-2">Dernières ventes</h3>
      {sales.length === 0 ? (
        <p className="text-xs text-pos-ink-3">Première vente du jour ✦</p>
      ) : (
        <ul className="space-y-1">
          {sales.map((s) => {
            const t = new Date(s.createdAt);
            return (
              <li key={s.id}>
                <a
                  href={`/pos/sales/${s.id}`}
                  className="flex items-center justify-between text-xs px-2 py-1 rounded hover:bg-pos-highlight"
                >
                  <span className="pos-mono text-pos-ink-3">
                    {String(t.getHours()).padStart(2, "0")}:
                    {String(t.getMinutes()).padStart(2, "0")}
                    <span className="ml-2 text-pos-ink-2">
                      {s.receiptNumber.replace(/^S-\d{8}-/, "·…")}
                    </span>
                  </span>
                  <span className="pos-mono">{formatDT(s.total)}</span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

