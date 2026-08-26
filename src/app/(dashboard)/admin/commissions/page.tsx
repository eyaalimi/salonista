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
    return <div className="flex h-64 items-center justify-center text-sm text-prune/50">Chargement…</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="ds-display text-3xl text-prune">Commissions</h1>
        <p className="mt-2 text-base text-prune/60">
          Ce que la plateforme, les salons et les influenceuses ont gagné.
        </p>
      </div>

      {/* Totaux */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-[var(--radius-card)] border border-hairline bg-white p-5">
          <p className="text-sm text-prune/60">Revenus plateforme</p>
          <p className="ds-display mt-1 text-3xl text-prune">
            {totalPlatform.toFixed(0)} TND
          </p>
        </div>
        <div className="rounded-[var(--radius-card)] border border-hairline bg-white p-5">
          <p className="text-sm text-prune/60">En attente</p>
          <p className="ds-display mt-1 text-3xl text-prune">
            {totalPending.toFixed(0)} TND
          </p>
        </div>
        <div className="rounded-[var(--radius-card)] border border-hairline bg-white p-5">
          <p className="text-sm text-prune/60">Payé</p>
          <p className="ds-display mt-1 text-3xl text-menthe-deep">
            {totalPaid.toFixed(0)} TND
          </p>
        </div>
      </div>

      {/* Filtres */}
      <div className="mb-5 flex flex-wrap gap-2">
        {[
          { key: "ALL", label: "Toutes" },
          { key: "PENDING", label: "En attente" },
          { key: "PAID", label: "Payées" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={`ds-press ds-focus min-h-[44px] rounded-[var(--radius-pill)] px-4 text-sm transition-colors ${
              filter === f.key
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
          <p className="text-base text-prune/50">Aucune commission</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="rounded-[var(--radius-card)] border border-hairline bg-white p-4 transition-colors hover:border-rose"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="flex-1">
                  <h3 className="text-base font-medium text-prune">
                    {c.booking.items.map((i) => i.offer.title).join(", ")}
                  </h3>
                  <p className="mt-1 text-sm text-prune/60">
                    {c.booking.items[0]?.offer.provider.salonName} · Cliente :{" "}
                    {c.booking.client.name || c.booking.client.email}
                  </p>
                  <p className="mt-1 text-sm text-prune/50">
                    Total réservation : {Number(c.booking.totalPrice).toFixed(0)} TND ·{" "}
                    {new Date(c.createdAt).toLocaleDateString("fr-TN")}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-right text-sm text-prune/60">
                    <p>Salon {Number(c.providerAmount).toFixed(0)} TND</p>
                    {c.influencerAmount && (
                      <p>Influenceuse {Number(c.influencerAmount).toFixed(0)} TND</p>
                    )}
                    <p className="font-medium text-prune">
                      Plateforme {Number(c.platformAmount).toFixed(0)} TND
                    </p>
                  </div>

                  <span
                    className={`rounded-[var(--radius-pill)] border px-3 py-1 text-xs ${
                      c.status === "PAID"
                        ? "border-menthe-deep/40 text-menthe-deep"
                        : "border-hairline text-prune/60"
                    }`}
                  >
                    {c.status === "PAID" ? "Payé" : "En attente"}
                  </span>

                  {c.status === "PENDING" && (
                    <button
                      onClick={() => markPaid(c.id)}
                      className="ds-press ds-focus min-h-[44px] rounded-[var(--radius-pill)] bg-rose px-4 text-sm text-prune transition-colors hover:bg-rose/90"
                    >
                      Marquer payé
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
