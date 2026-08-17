"use client";

import { useEffect, useState } from "react";

interface Stats {
  totalLinks: number;
  totalClicks: number;
  totalConversions: number;
  conversionRate: string;
  totalEarnings: number;
  paidEarnings: number;
  pendingBalance: number;
}

export default function InfluencerDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/influencer/stats")
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then(setStats)
      .catch(() => setStats({
        totalLinks: 0, totalClicks: 0, totalConversions: 0,
        conversionRate: "0", totalEarnings: 0, paidEarnings: 0, pendingBalance: 0,
      }));
  }, []);

  if (!stats) {
    return <div className="flex items-center justify-center h-64 text-brand-bordeaux/40 text-xs tracking-[0.2em] uppercase">Chargement...</div>;
  }

  const cards = [
    { label: "Liens actifs", value: stats.totalLinks },
    { label: "Clics totaux", value: stats.totalClicks },
    { label: "Conversions", value: stats.totalConversions },
    { label: "Taux conversion", value: `${stats.conversionRate}%` },
    { label: "Gains totaux", value: `${stats.totalEarnings.toFixed(0)} TND` },
    { label: "Solde en attente", value: `${stats.pendingBalance.toFixed(0)} TND` },
  ];

  return (
    <div>
      <div className="mb-10">
        <p className="luxury-badge mb-3">Tableau de bord</p>
        <h1 className="luxury-heading text-3xl text-brand-bordeaux">Mon Dashboard</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
        {cards.map((card) => (
          <div
            key={card.label}
            className="bg-white p-6 border border-brand-gold/20 hover:border-brand-gold transition-colors duration-500"
          >
            <p className="luxury-heading text-3xl text-brand-bordeaux mb-1">{card.value}</p>
            <p className="text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/40">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-brand-gold/20 p-8">
        <h2 className="luxury-heading text-lg text-brand-bordeaux mb-4">Comment ca marche</h2>
        <ol className="space-y-3 text-sm text-brand-bordeaux/60 list-decimal list-inside">
          <li>Les prestataires vous envoient des propositions de collaboration</li>
          <li>Consultez-les dans l&apos;onglet <strong className="text-brand-bordeaux">Collaborations</strong></li>
          <li>Acceptez celles qui vous intéressent — un lien de tracking est généré automatiquement</li>
          <li>Partagez le lien sur vos réseaux et gagnez votre commission sur chaque réservation</li>
        </ol>
      </div>
    </div>
  );
}
