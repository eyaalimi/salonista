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
  // datetime-local-friendly format
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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
    if (phone && !customer) {
      const normalized = tryNormalizePhone(phone);
      if (!normalized) {
        setError("Numéro de téléphone invalide");
        return;
      }
    }
    setSubmitting(true);
    try {
      const body = {
        customerId: customer?.id ?? null,
        walkIn,
        startTime: new Date(startStr).toISOString(),
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
          <p className="mb-3 rounded bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
            Création de réservation indisponible hors ligne.
          </p>
        )}

        <form onSubmit={submit} className="space-y-4 text-sm">
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

          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={walkIn}
              onChange={(e) => setWalkIn(e.target.checked)}
            />
            Walk-in (sans service prédéfini)
          </label>

          {walkIn ? (
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
          ) : (
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

          {error && <p className="text-xs text-red-600">{error}</p>}

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
