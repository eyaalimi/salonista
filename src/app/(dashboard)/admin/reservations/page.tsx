"use client";

import { useEffect, useState } from "react";

interface Booking {
  id: string;
  status: string;
  totalPrice: string;
  createdAt: string;
  notes: string | null;
  client: { name: string | null; email: string };
  items: {
    offer: { title: string; provider: { salonName: string } };
    slot: { startTime: string };
  }[];
  commission: {
    providerAmount: string;
    influencerAmount: string | null;
    platformAmount: string;
    status: string;
  } | null;
}

const statusStyles: Record<string, string> = {
  // Menthe = confirmation (usage documente), rose = alerte. « En attente » et
  // « Confirmee » restent neutres et se distinguent par le remplissage :
  // colorier les quatre etats banaliserait les deux qui demandent un regard.
  PENDING: "border-hairline text-prune/60",
  CONFIRMED: "border-prune/30 text-prune",
  COMPLETED: "border-menthe-deep/40 text-menthe-deep",
  CANCELLED: "border-rose/40 text-rose-fonce",
};

const statusLabels: Record<string, string> = {
  PENDING: "En attente",
  CONFIRMED: "Confirmee",
  COMPLETED: "Terminee",
  CANCELLED: "Annulee",
};

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    fetch("/api/admin/bookings")
      .then((r) => r.json())
      .then((data) => {
        setBookings(data);
        setLoading(false);
      });
  }, []);

  const filtered = filter === "ALL" ? bookings : bookings.filter((b) => b.status === filter);

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-sm text-prune/50">Chargement…</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="ds-display text-3xl text-prune">Toutes les réservations</h1>
        <p className="mt-2 text-base text-prune/60">
          {bookings.length} réservation{bookings.length > 1 ? "s" : ""} au total
        </p>
      </div>

      {/* Filtres */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { value: "ALL", label: "Toutes" },
          { value: "PENDING", label: "En attente" },
          { value: "CONFIRMED", label: "Confirmées" },
          { value: "COMPLETED", label: "Terminées" },
          { value: "CANCELLED", label: "Annulées" },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            aria-pressed={filter === f.value}
            className={`ds-press ds-focus min-h-[44px] rounded-[var(--radius-pill)] px-4 text-sm transition-colors ${
              filter === f.value
                ? "bg-prune text-white"
                : "border border-hairline text-prune/70 hover:border-rose"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-hairline bg-white p-12 text-center">
          <p className="text-base text-prune/50">Aucune réservation</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => (
            <div
              key={b.id}
              className="rounded-[var(--radius-card)] border border-hairline bg-white p-4 transition-colors hover:border-rose"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      className={`rounded-[var(--radius-pill)] border px-3 py-1 text-xs ${statusStyles[b.status] || "border-hairline text-prune/60"}`}
                    >
                      {statusLabels[b.status] || b.status}
                    </span>
                  </div>
                  <h3 className="ds-display text-lg text-prune">
                    {b.items.map((i) => i.offer.title).join(", ")}
                  </h3>
                  <p className="mt-1 text-sm text-prune/60">
                    {b.items[0]?.offer.provider.salonName} · Cliente :{" "}
                    {b.client.name || b.client.email}
                  </p>
                  {b.items[0]?.slot && (
                    <p className="mt-1 text-sm text-prune/50">
                      {new Date(b.items[0].slot.startTime).toLocaleDateString("fr-TN", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="ds-display text-xl text-prune">
                    {Number(b.totalPrice).toFixed(0)} TND
                  </p>
                  {b.commission && (
                    <div className="mt-1 text-sm text-prune/50">
                      <p>Salon {Number(b.commission.providerAmount).toFixed(0)} TND</p>
                      {b.commission.influencerAmount && (
                        <p>
                          Influenceuse{" "}
                          {Number(b.commission.influencerAmount).toFixed(0)} TND
                        </p>
                      )}
                      <p>Plateforme {Number(b.commission.platformAmount).toFixed(0)} TND</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
