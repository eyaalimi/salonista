"use client";

import { useEffect, useState } from "react";

interface Offer {
  id: string;
  title: string;
  originalPrice: string;
  discountPrice: string;
  category: string;
  active: boolean;
  createdAt: string;
  provider: { salonName: string; city: string | null };
  _count: { bookingItems: number; trackingLinks: number };
}

const categoryLabels: Record<string, string> = {
  COIFFURE: "Coiffure",
  ESTHETIQUE: "Esthetique",
  ONGLERIE: "Onglerie",
  MASSAGE: "Massage",
  PARFUMERIE: "Parfumerie",
  AUTRE: "Autre",
};

export default function AdminOffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    fetch("/api/admin/offers")
      .then((r) => r.json())
      .then((data) => {
        setOffers(data);
        setLoading(false);
      });
  }, []);

  const filtered = filter === "ALL"
    ? offers
    : filter === "ACTIVE"
    ? offers.filter((o) => o.active)
    : offers.filter((o) => !o.active);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-brand-bordeaux/40 text-xs tracking-[0.2em] uppercase">Chargement...</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <p className="luxury-badge mb-3">Administration</p>
        <h1 className="luxury-heading text-3xl text-brand-bordeaux">Toutes les offres</h1>
        <p className="text-sm text-brand-bordeaux/40 mt-2">{offers.length} offres au total</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {[
          { key: "ALL", label: "Toutes" },
          { key: "ACTIVE", label: "Actives" },
          { key: "INACTIVE", label: "Inactives" },
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
          <p className="text-brand-bordeaux/40 text-sm">Aucune offre</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((offer) => {
            const discount = Math.round(
              ((Number(offer.originalPrice) - Number(offer.discountPrice)) / Number(offer.originalPrice)) * 100
            );
            return (
              <div key={offer.id} className="bg-white border border-brand-gold/20 p-5 hover:border-brand-gold transition-colors duration-500">
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="luxury-badge text-[10px]">
                        {categoryLabels[offer.category] || offer.category}
                      </span>
                      <span className={`px-2 py-0.5 border text-[9px] tracking-[0.1em] uppercase font-medium ${
                        offer.active ? "border-emerald-300 text-emerald-700" : "border-red-300 text-red-700"
                      }`}>
                        {offer.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <h3 className="luxury-heading text-lg text-brand-bordeaux">{offer.title}</h3>
                    <p className="text-xs text-brand-bordeaux/40 mt-1">
                      {offer.provider.salonName}
                      {offer.provider.city && ` · ${offer.provider.city}`}
                      {" · "}Creee le {new Date(offer.createdAt).toLocaleDateString("fr-TN")}
                    </p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="flex items-baseline gap-2">
                        <span className="text-brand-bordeaux/30 line-through text-sm">{Number(offer.originalPrice).toFixed(0)} DT</span>
                        <span className="luxury-heading text-xl text-brand-gold">{Number(offer.discountPrice).toFixed(0)} DT</span>
                        <span className="text-[10px] tracking-[0.1em] uppercase text-brand-gold">-{discount}%</span>
                      </div>
                    </div>
                    <div className="text-xs text-brand-bordeaux/40 tracking-wider text-right">
                      <p>{offer._count.bookingItems} reserv.</p>
                      <p>{offer._count.trackingLinks} liens</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
