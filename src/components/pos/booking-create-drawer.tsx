"use client";

import { useEffect, useMemo, useState } from "react";
import { tryNormalizePhone } from "@/lib/phone";
import { searchCachedCustomers, getCachedCatalog } from "@/lib/pos-offline-db";

type Offer = {
  id: string;
  title: string;
  durationMinutes: number;
};

type Customer = {
  id: string;
  phone: string;
  firstName: string | null;
  lastName: string | null;
};

type Employee = { id: string; displayName: string };

type Props = {
  initialStart: Date;
  online: boolean;
  defaultEmployeeId: string;
  onClose: () => void;
  onCreated: () => void;
};

function isoLocal(d: Date): string {
  // datetime-local-friendly format (used only for walk-ins, which don't need
  // to align on the slot grid).
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

type Slot = { startTime: string; endTime: string };

export function BookingCreateDrawer({
  initialStart,
  online,
  defaultEmployeeId,
  onClose,
  onCreated,
}: Props) {
  const [startStr, setStartStr] = useState(isoLocal(initialStart));
  const [walkIn, setWalkIn] = useState(false);
  const [duration, setDuration] = useState(30);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedOffers, setSelectedOffers] = useState<string[]>([]);
  const [employeeId, setEmployeeId] = useState<string>(defaultEmployeeId);
  const [phone, setPhone] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [results, setResults] = useState<Customer[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Slot picker state (service mode). The date is a YYYY-MM-DD; the chosen
  // slot is an ISO string (as returned by the API — always aligned on the grid).
  const [dateStr, setDateStr] = useState<string>(isoDate(initialStart));
  const [availableSlots, setAvailableSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const cat = await getCachedCatalog();
      if (cat) {
        setOffers(
          cat.offers.map((o) => ({ id: o.id, title: o.title, durationMinutes: o.durationMinutes })),
        );
        setEmployees(cat.employees);
      }
    })();
  }, []);

  useEffect(() => {
    let active = true;
    const t = setTimeout(async () => {
      if (!phone.trim()) {
        setResults([]);
        return;
      }
      const found = await searchCachedCustomers(phone);
      if (active) setResults(found.slice(0, 5));
    }, 200);
    return () => {
      clearTimeout(t);
      active = false;
    };
  }, [phone]);

  const totalDuration = useMemo(() => {
    if (walkIn) return duration;
    let sum = 0;
    for (const id of selectedOffers) {
      const o = offers.find((x) => x.id === id);
      if (o) sum += o.durationMinutes;
    }
    return sum;
  }, [walkIn, selectedOffers, offers, duration]);

  // Fetch available slot start-times whenever the offer list or the day
  // changes. Skip when the form is in walk-in mode.
  useEffect(() => {
    if (walkIn || selectedOffers.length === 0 || !dateStr) {
      setAvailableSlots([]);
      setSelectedSlot(null);
      setSlotError(null);
      return;
    }
    let cancelled = false;
    setLoadingSlots(true);
    setSlotError(null);
    (async () => {
      try {
        const params = new URLSearchParams({
          offerIds: selectedOffers.join(","),
          date: dateStr,
        });
        const res = await fetch(`/api/pos/slots?${params.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          if (!cancelled) {
            setAvailableSlots([]);
            setSelectedSlot(null);
            setSlotError(d?.error ?? "Impossible de charger les créneaux");
          }
          return;
        }
        const data = (await res.json()) as { slots: Slot[] };
        if (cancelled) return;
        setAvailableSlots(data.slots);
        // Preserve current selection if still valid, otherwise pick nothing.
        setSelectedSlot((prev) =>
          prev && data.slots.some((s) => s.startTime === prev) ? prev : null,
        );
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [walkIn, selectedOffers, dateStr]);

  function toggleOffer(id: string) {
    setSelectedOffers((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!walkIn && selectedOffers.length === 0) {
      setError("Sélectionnez au moins un service");
      return;
    }
    if (!walkIn && !selectedSlot) {
      setError("Choisissez un créneau disponible");
      return;
    }
    if (phone && !customer) {
      const normalized = tryNormalizePhone(phone);
      if (!normalized) {
        setError("Numéro de téléphone invalide");
        return;
      }
    }
    setSubmitting(true);
    try {
      const startIso = walkIn
        ? new Date(startStr).toISOString()
        : selectedSlot!;
      const body = {
        customerId: customer?.id ?? null,
        walkIn,
        startTime: startIso,
        offerIds: walkIn ? [] : selectedOffers,
        durationMinutes: walkIn ? duration : undefined,
        assignedEmployeeId: employeeId,
        notes: notes || null,
      };
      const res = await fetch("/api/pos/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Erreur ${res.status}`);
        return;
      }
      onCreated();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex">
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="flex-1 bg-black/30"
      />
      <aside className="w-full max-w-md bg-brand-cream p-6 shadow-xl overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <p className="luxury-badge">Nouvelle réservation</p>
          <button
            type="button"
            onClick={onClose}
            className="text-brand-ink-soft hover:text-brand-ink"
          >
            ✕
          </button>
        </div>
        {!online && (
          <p className="mb-3 rounded bg-pos-highlight border border-pos-warn px-3 py-2 text-xs text-pos-warn">
            Création de réservation indisponible hors ligne.
          </p>
        )}

        <form onSubmit={submit} className="space-y-4 text-sm">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={walkIn}
              onChange={(e) => setWalkIn(e.target.checked)}
            />
            Walk-in (sans service prédéfini)
          </label>

          {walkIn ? (
            <>
              <div>
                <label className="block text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft mb-1">
                  Date et heure
                </label>
                <input
                  type="datetime-local"
                  value={startStr}
                  onChange={(e) => setStartStr(e.target.value)}
                  className="w-full rounded border border-brand-line bg-white px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft mb-1">
                  Durée (min)
                </label>
                <input
                  type="number"
                  min="5"
                  step="5"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value) || 30)}
                  className="w-full rounded border border-brand-line bg-white px-3 py-2"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft mb-1">
                  Services
                </label>
                <ul className="space-y-1 max-h-40 overflow-y-auto border border-brand-line rounded bg-white p-2">
                  {offers.map((o) => (
                    <li key={o.id}>
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={selectedOffers.includes(o.id)}
                          onChange={() => toggleOffer(o.id)}
                        />
                        <span className="flex-1">{o.title}</span>
                        <span className="text-brand-ink-soft">{o.durationMinutes} min</span>
                      </label>
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-[10px] text-brand-ink-soft">
                  Durée totale: {Math.floor(totalDuration / 60)}h {totalDuration % 60}min
                </p>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft mb-1">
                  Jour
                </label>
                <input
                  type="date"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  min={isoDate(new Date())}
                  className="w-full rounded border border-brand-line bg-white px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft mb-1">
                  Créneau disponible
                </label>
                {selectedOffers.length === 0 ? (
                  <p className="text-xs text-brand-ink-soft italic px-1">
                    Sélectionnez d&apos;abord un service pour voir les créneaux libres.
                  </p>
                ) : loadingSlots ? (
                  <p className="text-xs text-brand-ink-soft px-1">Chargement…</p>
                ) : slotError ? (
                  <p className="text-xs text-pos-danger px-1">{slotError}</p>
                ) : availableSlots.length === 0 ? (
                  <p className="text-xs text-pos-warn bg-pos-highlight border border-pos-warn rounded px-2 py-2">
                    Aucun créneau disponible ce jour pour cette combinaison de
                    services. Choisissez un autre jour ou modifiez les services.
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-1.5">
                    {availableSlots.map((s) => {
                      const d = new Date(s.startTime);
                      const label = d.toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      const active = selectedSlot === s.startTime;
                      return (
                        <button
                          key={s.startTime}
                          type="button"
                          onClick={() => setSelectedSlot(s.startTime)}
                          className={`px-2 py-2 rounded border text-xs font-medium transition ${
                            active
                              ? "bg-brand-ink text-brand-cream border-brand-ink"
                              : "bg-white border-brand-line text-brand-ink hover:border-brand-gold"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          <div>
            <label className="block text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft mb-1">
              Employé·e
            </label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full rounded border border-brand-line bg-white px-3 py-2"
            >
              <option value="">—</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.displayName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft mb-1">
              Client
            </label>
            {customer ? (
              <div className="rounded border border-brand-line bg-white px-3 py-2 flex justify-between">
                <span className="text-sm">
                  {[customer.firstName, customer.lastName].filter(Boolean).join(" ")}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCustomer(null);
                    setPhone("");
                  }}
                  className="text-xs text-brand-ink-soft"
                >
                  Changer
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Téléphone (laisser vide pour walk-in)"
                  className="w-full rounded border border-brand-line bg-white px-3 py-2"
                />
                {results.length > 0 && (
                  <ul className="mt-1 rounded border border-brand-line bg-white">
                    {results.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => setCustomer(c)}
                          className="w-full px-3 py-2 text-left text-xs hover:bg-brand-sand"
                        >
                          {[c.firstName, c.lastName].filter(Boolean).join(" ")} · {c.phone}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded border border-brand-line bg-white px-3 py-2"
            />
          </div>

          {error && <p className="text-xs text-pos-danger">{error}</p>}

          <button
            type="submit"
            disabled={submitting || !online}
            className="w-full rounded-lg bg-brand-ink py-3 text-xs uppercase tracking-[0.18em] text-brand-cream disabled:opacity-50"
          >
            {submitting ? "…" : "Créer la réservation"}
          </button>
        </form>
      </aside>
    </div>
  );
}
