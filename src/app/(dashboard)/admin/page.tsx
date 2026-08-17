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
    return <div className="flex items-center justify-center h-64 text-brand-bordeaux/40 text-xs tracking-[0.2em] uppercase">Chargement...</div>;
  }

  if (!stats) return null;

  const mainCards = [
    { label: "Utilisateurs", value: stats.totalUsers, href: "/admin/utilisateurs", sub: `+${stats.recentUsers} ce mois` },
    { label: "Offres actives", value: stats.activeOffers, href: "/admin/offres", sub: `${stats.totalOffers} au total` },
    { label: "Reservations", value: stats.totalBookings, href: "/admin/reservations", sub: `${stats.pendingBookings} en attente` },
    { label: "Revenus plateforme", value: `${stats.platformRevenue.toFixed(0)} TND`, href: "/admin/commissions", sub: `${stats.totalRevenue.toFixed(0)} TND volume total` },
  ];

  const userBreakdown = [
    { label: "Clients", value: stats.totalClients },
    { label: "Prestataires", value: stats.totalProviders },
    { label: "Influenceuses", value: stats.totalInfluencers },
  ];

  const bookingBreakdown = [
    { label: "En attente", value: stats.pendingBookings },
    { label: "Terminees", value: stats.completedBookings },
  ];

  return (
    <div>
      <div className="mb-10">
        <p className="luxury-badge mb-3">Administration</p>
        <h1 className="luxury-heading text-3xl text-brand-bordeaux">Vue d&apos;ensemble</h1>
      </div>

      {/* Main stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {mainCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="bg-white p-6 border border-brand-gold/20 hover:border-brand-gold transition-colors duration-500 group"
          >
            <p className="text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/40 mb-2">{card.label}</p>
            <p className="luxury-heading text-3xl text-brand-bordeaux group-hover:text-brand-gold transition-colors duration-500">{card.value}</p>
            {card.sub && <p className="text-xs text-brand-bordeaux/30 mt-2">{card.sub}</p>}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Users breakdown */}
        <div className="bg-white border border-brand-gold/20 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="luxury-heading text-lg text-brand-bordeaux">Repartition utilisateurs</h2>
            <Link href="/admin/utilisateurs" className="text-[10px] tracking-[0.2em] uppercase text-brand-gold hover:text-brand-bordeaux transition-colors duration-500">
              Voir tout
            </Link>
          </div>
          <div className="space-y-4">
            {userBreakdown.map((item) => (
              <div key={item.label} className="flex items-center justify-between py-3 border-b border-brand-gold/10 last:border-0">
                <span className="text-sm text-brand-bordeaux/60">{item.label}</span>
                <span className="luxury-heading text-xl text-brand-bordeaux">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bookings breakdown */}
        <div className="bg-white border border-brand-gold/20 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="luxury-heading text-lg text-brand-bordeaux">Reservations</h2>
            <Link href="/admin/reservations" className="text-[10px] tracking-[0.2em] uppercase text-brand-gold hover:text-brand-bordeaux transition-colors duration-500">
              Voir tout
            </Link>
          </div>
          <div className="space-y-4">
            {bookingBreakdown.map((item) => (
              <div key={item.label} className="flex items-center justify-between py-3 border-b border-brand-gold/10 last:border-0">
                <span className="text-sm text-brand-bordeaux/60">{item.label}</span>
                <span className="luxury-heading text-xl text-brand-bordeaux">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
