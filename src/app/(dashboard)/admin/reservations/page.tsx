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
  PENDING: "border-amber-300 text-amber-700",
  CONFIRMED: "border-blue-300 text-blue-700",
  COMPLETED: "border-emerald-300 text-emerald-700",
  CANCELLED: "border-red-300 text-red-700",
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
    return <div className="flex items-center justify-center h-64 text-brand-bordeaux/40 text-xs tracking-[0.2em] uppercase">Chargement...</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <p className="luxury-badge mb-3">Administration</p>
        <h1 className="luxury-heading text-3xl text-brand-bordeaux">Toutes les reservations</h1>
        <p className="text-sm text-brand-bordeaux/40 mt-2">{bookings.length} reservations au total</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { value: "ALL", label: "Toutes" },
          { value: "PENDING", label: "En attente" },
          { value: "CONFIRMED", label: "Confirmees" },
          { value: "COMPLETED", label: "Terminees" },
          { value: "CANCELLED", label: "Annulees" },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-2 text-[10px] tracking-[0.15em] uppercase font-medium transition-colors duration-500 ${
              filter === f.value
                ? "bg-brand-bordeaux text-white"
                : "border border-brand-gold/20 text-brand-bordeaux/60 hover:border-brand-gold"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-brand-gold/20 p-16 text-center">
          <p className="text-brand-bordeaux/40 text-sm">Aucune reservation</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => (
            <div key={b.id} className="bg-white border border-brand-gold/20 p-5 hover:border-brand-gold transition-colors duration-500">
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-3 py-1 border text-[10px] tracking-[0.1em] uppercase font-medium ${statusStyles[b.status] || "border-gray-300 text-gray-600"}`}>
                      {statusLabels[b.status] || b.status}
                    </span>
                  </div>
                  <h3 className="luxury-heading text-lg text-brand-bordeaux">
                    {b.items.map((i) => i.offer.title).join(", ")}
                  </h3>
                  <p className="text-xs text-brand-bordeaux/40 mt-1">
                    {b.items[0]?.offer.provider.salonName} · Client: {b.client.name || b.client.email}
                  </p>
                  {b.items[0]?.slot && (
                    <p className="text-xs text-brand-bordeaux/30 mt-1">
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
                  <p className="luxury-heading text-xl text-brand-gold">{Number(b.totalPrice).toFixed(0)} TND</p>
                  {b.commission && (
                    <div className="text-[10px] text-brand-bordeaux/30 mt-1 tracking-wider">
                      <p>Prest. {Number(b.commission.providerAmount).toFixed(0)} TND</p>
                      {b.commission.influencerAmount && (
                        <p>Infl. {Number(b.commission.influencerAmount).toFixed(0)} TND</p>
                      )}
                      <p>Platef. {Number(b.commission.platformAmount).toFixed(0)} TND</p>
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
