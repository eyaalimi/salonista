"use client";

import { useEffect, useState } from "react";

interface Commission {
  id: string;
  providerAmount: string;
  influencerAmount: string | null;
  platformAmount: string;
  status: string;
  createdAt: string;
  booking: {
    totalPrice: string;
    status: string;
    client: { name: string | null; email: string };
    items: {
      offer: { title: string; provider: { salonName: string } };
    }[];
  };
}

export default function AdminCommissionsPage() {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");

  async function loadCommissions() {
    const res = await fetch("/api/admin/commissions");
    if (res.ok) setCommissions(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    loadCommissions();
  }, []);

  async function markPaid(id: string) {
    await fetch("/api/admin/commissions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "PAID" }),
    });
    await loadCommissions();
  }

  const filtered = filter === "ALL" ? commissions : commissions.filter((c) => c.status === filter);

  const totalPlatform = commissions.reduce((sum, c) => sum + Number(c.platformAmount), 0);
  const totalPending = commissions
    .filter((c) => c.status === "PENDING")
    .reduce((sum, c) => sum + Number(c.platformAmount), 0);
  const totalPaid = commissions
    .filter((c) => c.status === "PAID")
    .reduce((sum, c) => sum + Number(c.platformAmount), 0);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-brand-bordeaux/40 text-xs tracking-[0.2em] uppercase">Chargement...</div>;
  }

  return (
    <div>
      <div className="mb-10">
        <p className="luxury-badge mb-3">Finances</p>
        <h1 className="luxury-heading text-3xl text-brand-bordeaux">Commissions</h1>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        <div className="bg-white p-6 border border-brand-gold/20">
          <p className="text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/40 mb-2">Revenus plateforme</p>
          <p className="luxury-heading text-3xl text-brand-gold">{totalPlatform.toFixed(0)} TND</p>
        </div>
        <div className="bg-white p-6 border border-brand-gold/20">
          <p className="text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/40 mb-2">En attente</p>
          <p className="luxury-heading text-3xl text-brand-bordeaux">{totalPending.toFixed(0)} TND</p>
        </div>
        <div className="bg-white p-6 border border-brand-gold/20">
          <p className="text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/40 mb-2">Paye</p>
          <p className="luxury-heading text-3xl text-emerald-700">{totalPaid.toFixed(0)} TND</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {[
          { key: "ALL", label: "Toutes" },
          { key: "PENDING", label: "En attente" },
          { key: "PAID", label: "Payees" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 text-[10px] tracking-[0.15em] uppercase font-medium transition-colors duration-500 ${
              filter === f.key
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
          <p className="text-brand-bordeaux/40 text-sm">Aucune commission</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <div key={c.id} className="bg-white border border-brand-gold/20 p-5 hover:border-brand-gold transition-colors duration-500">
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-brand-bordeaux">
                    {c.booking.items.map((i) => i.offer.title).join(", ")}
                  </h3>
                  <p className="text-xs text-brand-bordeaux/40 mt-1">
                    {c.booking.items[0]?.offer.provider.salonName} · Client: {c.booking.client.name || c.booking.client.email}
                  </p>
                  <p className="text-xs text-brand-bordeaux/30 mt-1">
                    Total reservation: {Number(c.booking.totalPrice).toFixed(0)} TND · {new Date(c.createdAt).toLocaleDateString("fr-TN")}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right text-[10px] text-brand-bordeaux/40 tracking-wider">
                    <p>Prest. {Number(c.providerAmount).toFixed(0)} TND</p>
                    {c.influencerAmount && <p>Infl. {Number(c.influencerAmount).toFixed(0)} TND</p>}
                    <p className="text-brand-gold font-medium">Platef. {Number(c.platformAmount).toFixed(0)} TND</p>
                  </div>

                  <span className={`px-3 py-1 border text-[10px] tracking-[0.1em] uppercase font-medium ${
                    c.status === "PAID" ? "border-emerald-300 text-emerald-700" : "border-amber-300 text-amber-700"
                  }`}>
                    {c.status === "PAID" ? "Paye" : "En attente"}
                  </span>

                  {c.status === "PENDING" && (
                    <button
                      onClick={() => markPaid(c.id)}
                      className="px-4 py-2 text-xs tracking-[0.15em] uppercase bg-emerald-700 text-white hover:bg-emerald-800 transition-colors duration-500"
                    >
                      Marquer paye
                    </button>
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
