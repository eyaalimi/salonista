"use client";

import { useEffect, useState } from "react";

interface Offer {
  id: string;
  title: string;
  // Nullable en base (`Decimal?`) depuis le lot POS : une offre creee a la
  // caisse n'a pas de prix barre. Le type le disait non-nul, d'ou un « NaN % »
  // affiche a l'admin des qu'une telle offre apparaissait.
  originalPrice: string | null;
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
    return <div className="flex h-64 items-center justify-center text-sm text-prune/50">Chargement&</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="ds-display text-3xl text-prune">Toutes les offres</h1>
        <p className="mt-2 text-base text-prune/60">{offers.length} offres au total</p>
      </div>

      {/* Filtres */}
      <div className="mb-5 flex flex-wrap gap-2">
        {[
          { key: "ALL", label: "Toutes" },
          { key: "ACTIVE", label: "Actives" },
          { key: "INACTIVE", label: "Inactives" },
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
          <p className="text-base text-prune/50">Aucune offre</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((offer) => {
            // Une offre de caisse n'a pas de prix barre : pas de remise a
            // afficher, plutot qu'un « NaN % ».
            const prixOrigine = offer.originalPrice ? Number(offer.originalPrice) : null;
            const remise =
              prixOrigine && prixOrigine > Number(offer.discountPrice)
                ? Math.round(((prixOrigine - Number(offer.discountPrice)) / prixOrigine) * 100)
                : null;
            return (
              <div
                key={offer.id}
                className="rounded-[var(--radius-card)] border border-hairline bg-white p-4 transition-colors hover:border-rose"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                  <div className="flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="rounded-[var(--radius-pill)] bg-prune-soft px-2 py-0.5 text-xs text-prune">
                        {categoryLabels[offer.category] || offer.category}
                      </span>
                      <span
                        className={`rounded-[var(--radius-pill)] border px-2 py-0.5 text-xs ${
                          offer.active
                            ? "border-menthe-deep/40 text-menthe-deep"
                            : "border-rose/40 text-rose-fonce"
                        }`}
                      >
                        {offer.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <h3 className="ds-display text-lg text-prune">{offer.title}</h3>
                    <p className="mt-1 text-sm text-prune/50">
                      {offer.provider.salonName}
                      {offer.provider.city && ` · ${offer.provider.city}`}
                      {" · "}Créée le{" "}
                      {new Date(offer.createdAt).toLocaleDateString("fr-TN")}
                    </p>
                  </div>
                  <div className="flex items-center gap-5">
                    <div className="flex items-baseline gap-2 text-right">
                      {prixOrigine !== null && (
                        <span className="text-sm text-prune/40 line-through">
                          {prixOrigine.toFixed(0)} TND
                        </span>
                      )}
                      <span className="ds-display text-xl text-prune">
                        {Number(offer.discountPrice).toFixed(0)} TND
                      </span>
                      {remise !== null && (
                        <span className="text-sm text-rose-fonce">-{remise} %</span>
                      )}
                    </div>
                    <div className="text-right text-sm text-prune/50">
                      <p>{offer._count.bookingItems} résa.</p>
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
