"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Stats {
  totalUsers: number;
  totalProviders: number;
  totalInfluencers: number;
  totalClients: number;
  totalOffers: number;
  activeOffers: number;
  totalBookings: number;
  pendingBookings: number;
  completedBookings: number;
  platformRevenue: number;
  totalRevenue: number;
  recentUsers: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-prune/50">
        Chargement…
      </div>
    );
  }

  if (!stats) return null;

  const mainCards = [
    { label: "Utilisateurs", value: stats.totalUsers, href: "/admin/utilisateurs", sub: `+${stats.recentUsers} ce mois` },
    { label: "Offres actives", value: stats.activeOffers, href: "/admin/offres", sub: `${stats.totalOffers} au total` },
    { label: "Réservations", value: stats.totalBookings, href: "/admin/reservations", sub: `${stats.pendingBookings} en attente` },
    { label: "Revenus plateforme", value: `${stats.platformRevenue.toFixed(0)} TND`, href: "/admin/commissions", sub: `${stats.totalRevenue.toFixed(0)} TND volume total` },
  ];

  const userBreakdown = [
    { label: "Clients", value: stats.totalClients },
    { label: "Prestataires", value: stats.totalProviders },
    { label: "Influenceuses", value: stats.totalInfluencers },
  ];

  const bookingBreakdown = [
    { label: "En attente", value: stats.pendingBookings },
    { label: "Terminées", value: stats.completedBookings },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="ds-display text-3xl text-prune">Vue d&apos;ensemble</h1>
        <p className="mt-2 text-base text-prune/60">
          L&apos;activité de la plateforme en un coup d&apos;œil.
        </p>
      </div>

      {/* Chiffres principaux */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {mainCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="ds-press ds-focus group rounded-[var(--radius-card)] border border-hairline bg-white p-5 transition-colors hover:border-rose"
          >
            <p className="text-sm text-prune/60">{card.label}</p>
            <p className="ds-display mt-1 text-3xl text-prune transition-colors group-hover:text-rose-fonce">
              {card.value}
            </p>
            {card.sub && <p className="mt-2 text-sm text-prune/50">{card.sub}</p>}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Répartition des utilisateurs */}
        <div className="rounded-[var(--radius-card)] border border-hairline bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="ds-display text-lg text-prune">Répartition utilisateurs</h2>
            <Link
              href="/admin/utilisateurs"
              className="ds-focus text-sm text-rose-fonce underline-offset-4 hover:underline"
            >
              Voir tout
            </Link>
          </div>
          <div>
            {userBreakdown.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between border-b border-hairline py-3 last:border-0"
              >
                <span className="text-base text-prune/70">{item.label}</span>
                <span className="ds-display text-xl text-prune">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Répartition des réservations */}
        <div className="rounded-[var(--radius-card)] border border-hairline bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="ds-display text-lg text-prune">Réservations</h2>
            <Link
              href="/admin/reservations"
              className="ds-focus text-sm text-rose-fonce underline-offset-4 hover:underline"
            >
              Voir tout
            </Link>
          </div>
          <div>
            {bookingBreakdown.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between border-b border-hairline py-3 last:border-0"
              >
                <span className="text-base text-prune/70">{item.label}</span>
                <span className="ds-display text-xl text-prune">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
