"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Stats {
  totalOffers: number;
  activeOffers: number;
  totalBookings: number;
  pendingBookings: number;
  totalRevenue: number;
}

interface Booking {
  id: string;
  status: string;
  totalPrice: string;
  client: { name: string | null; email: string };
  items: { offer: { title: string }; slot: { startTime: string } }[];
}

export default function ProviderDashboard() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [statsRes, bookingsRes] = await Promise.all([
        fetch("/api/provider/stats"),
        fetch("/api/provider/bookings?limit=5"),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (bookingsRes.ok) setRecentBookings(await bookingsRes.json());
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-brand-bordeaux/40 text-xs tracking-[0.2em] uppercase">Chargement...</div>;
  }

  return (
    <div>
      <div className="mb-10">
        <p className="luxury-badge mb-3">Tableau de bord</p>
        <h1 className="luxury-heading text-3xl text-brand-bordeaux">
          Bonjour, {session?.user?.name?.split(" ")[0]}
        </h1>
        <p className="text-sm text-brand-bordeaux/40 mt-2">Voici un apercu de votre activite</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {[
          { label: "Offres actives", value: stats?.activeOffers ?? 0, sub: stats?.totalOffers ? `sur ${stats.totalOffers} au total` : undefined },
          { label: "Reservations", value: stats?.totalBookings ?? 0 },
          { label: "En attente", value: stats?.pendingBookings ?? 0 },
          { label: "Revenus", value: `${(stats?.totalRevenue ?? 0).toFixed(0)} DT` },
        ].map((s) => (
          <div key={s.label} className="bg-white p-6 border border-brand-gold/20 hover:border-brand-gold transition-colors duration-500">
            <p className="text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/40 mb-2">{s.label}</p>
            <p className="luxury-heading text-3xl text-brand-bordeaux">{s.value}</p>
            {s.sub && (
              <p className="text-xs text-brand-bordeaux/30 mt-1">{s.sub}</p>
            )}
          </div>
        ))}
      </div>

      {/* Recent bookings */}
      <div className="bg-white border border-brand-gold/20">
        <div className="flex items-center justify-between p-6 border-b border-brand-gold/15">
          <h2 className="luxury-heading text-lg text-brand-bordeaux">Reservations recentes</h2>
          <Link href="/prestataire/reservations" className="text-[10px] tracking-[0.2em] uppercase text-brand-gold hover:text-brand-bordeaux transition-colors duration-500">
            Voir tout
          </Link>
        </div>
        {recentBookings.length === 0 ? (
          <p className="p-6 text-brand-bordeaux/40 text-sm">Aucune reservation pour le moment</p>
        ) : (
          <div className="divide-y divide-brand-gold/10">
            {recentBookings.map((b) => (
              <div key={b.id} className="flex items-center justify-between p-5">
                <div>
                  <p className="text-sm font-medium text-brand-bordeaux">{b.items.map((i) => i.offer.title).join(", ")}</p>
                  <p className="text-xs text-brand-bordeaux/40 mt-1">
                    {b.client.name || b.client.email}
                    {b.items[0]?.slot && ` · ${new Date(b.items[0].slot.startTime).toLocaleDateString("fr-TN")}`}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-brand-bordeaux">{Number(b.totalPrice).toFixed(0)} DT</span>
                  <StatusBadge status={b.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: "border-amber-300 text-amber-700",
    CONFIRMED: "border-blue-300 text-blue-700",
    COMPLETED: "border-emerald-300 text-emerald-700",
    CANCELLED: "border-red-300 text-red-700",
  };
  const labels: Record<string, string> = {
    PENDING: "En attente",
    CONFIRMED: "Confirme",
    COMPLETED: "Termine",
    CANCELLED: "Annule",
  };
  return (
    <span className={`px-3 py-1 border text-[10px] tracking-[0.1em] uppercase font-medium ${styles[status] || "border-gray-300 text-gray-600"}`}>
      {labels[status] || status}
    </span>
  );
}
