"use client";

import { useEffect, useState } from "react";

interface Commission {
  id: string;
  influencerAmount: number;
  status: string;
  createdAt: string;
  booking: {
    status: string;
    items: {
      offer: { title: string; provider: { salonName: string } };
      slot: { startTime: string };
    }[];
  };
}

export default function InfluencerGains() {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/influencer/gains")
      .then((r) => r.json())
      .then((data) => {
        setCommissions(data);
        setLoading(false);
      });
  }, []);

  const totalPending = commissions
    .filter((c) => c.status === "PENDING")
    .reduce((sum, c) => sum + Number(c.influencerAmount), 0);

  const totalPaid = commissions
    .filter((c) => c.status === "PAID")
    .reduce((sum, c) => sum + Number(c.influencerAmount), 0);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-brand-bordeaux/40 text-xs tracking-[0.2em] uppercase">Chargement...</div>;
  }

  return (
    <div>
      <div className="mb-10">
        <p className="luxury-badge mb-3">Finances</p>
        <h1 className="luxury-heading text-3xl text-brand-bordeaux">Mes gains</h1>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 mb-10">
        <div className="bg-white p-6 border border-brand-gold/20">
          <p className="text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/40 mb-2">En attente</p>
          <p className="luxury-heading text-3xl text-brand-bordeaux">{totalPending.toFixed(0)} TND</p>
        </div>
        <div className="bg-white p-6 border border-brand-gold/20">
          <p className="text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/40 mb-2">Total paye</p>
          <p className="luxury-heading text-3xl text-emerald-700">{totalPaid.toFixed(0)} TND</p>
        </div>
      </div>

      {/* Commissions list */}
      <div className="space-y-3">
        {commissions.map((c) => {
          const statusStyles: Record<string, string> = {
            PENDING: "border-amber-300 text-amber-700",
            PAID: "border-emerald-300 text-emerald-700",
            CANCELLED: "border-red-300 text-red-700",
          };
          const statusLabels: Record<string, string> = {
            PENDING: "En attente",
            PAID: "Paye",
            CANCELLED: "Annule",
          };
          return (
            <div
              key={c.id}
              className="bg-white border border-brand-gold/20 p-5 flex flex-col md:flex-row md:items-center gap-3 hover:border-brand-gold transition-colors duration-500"
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-brand-bordeaux">{c.booking.items.map((i) => i.offer.title).join(", ")}</p>
                <p className="text-xs text-brand-bordeaux/40 mt-1">
                  {c.booking.items[0]?.offer.provider.salonName}
                  {c.booking.items[0]?.slot && ` · ${new Date(c.booking.items[0].slot.startTime).toLocaleDateString("fr-TN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}`}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className={`px-3 py-1 border text-[10px] tracking-[0.1em] uppercase font-medium ${statusStyles[c.status] || "border-gray-300 text-gray-600"}`}>
                  {statusLabels[c.status] || c.status}
                </span>
                <span className="luxury-heading text-lg text-brand-gold">
                  +{Number(c.influencerAmount).toFixed(0)} TND
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {commissions.length === 0 && (
        <p className="text-center text-brand-bordeaux/40 py-16 text-sm tracking-wider">
          Aucun gain pour le moment. Commencez par partager des liens.
        </p>
      )}
    </div>
  );
}
