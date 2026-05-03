"use client";

import { useEffect, useState } from "react";

interface CollabOffer {
  id: string;
  offer: {
    id: string;
    title: string;
    discountPrice: string;
    photos: string[];
    durationMinutes: number;
  };
  trackingLink: { token: string; clicksCount: number; conversionsCount: number } | null;
}

interface Collab {
  id: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  commissionPct: string;
  durationDays: number;
  message: string | null;
  createdAt: string;
  provider: { salonName: string; city: string | null };
  offers: CollabOffer[];
}

export default function InfluencerCollaborations() {
  const [collabs, setCollabs] = useState<Collab[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/collaborations");
    if (res.ok) setCollabs(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function respond(id: string, status: "ACCEPTED" | "REJECTED") {
    setActing(id);
    await fetch(`/api/collaborations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
    setActing(null);
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/api/tracking/click?ref=${token}`;
    navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-brand-bordeaux/40 text-xs tracking-[0.2em] uppercase">Chargement...</div>;
  }

  const pending = collabs.filter((c) => c.status === "PENDING");
  const accepted = collabs.filter((c) => c.status === "ACCEPTED");
  const rejected = collabs.filter((c) => c.status === "REJECTED");

  return (
    <div>
      <div className="mb-10">
        <p className="luxury-badge mb-3">Partenariats</p>
        <h1 className="luxury-heading text-3xl text-brand-bordeaux">Collaborations</h1>
        <p className="text-sm text-brand-bordeaux/40 mt-2">Propositions reçues des prestataires</p>
      </div>

      {/* Pending */}
      <section className="mb-10">
        <h2 className="luxury-heading text-lg text-brand-bordeaux mb-4">En attente ({pending.length})</h2>
        {pending.length === 0 ? (
          <div className="bg-white border border-brand-gold/20 p-8 text-center">
            <p className="text-sm text-brand-bordeaux/40">Aucune proposition en attente</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pending.map((c) => (
              <div key={c.id} className="bg-white border border-brand-gold/20 p-6 hover:border-brand-gold transition-colors">
                <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
                  <div>
                    <h3 className="luxury-heading text-lg text-brand-bordeaux">{c.provider.salonName}</h3>
                    <p className="text-xs text-brand-bordeaux/40 mt-1">{c.provider.city}</p>
                  </div>
                  <div className="text-right">
                    <p className="luxury-heading text-2xl text-brand-gold">
                      {Number(c.commissionPct).toFixed(0)}%
                    </p>
                    <p className="text-[10px] tracking-wider uppercase text-brand-bordeaux/40">commission</p>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/50 mb-2">
                    {c.offers.length} offre{c.offers.length > 1 ? "s" : ""} incluse{c.offers.length > 1 ? "s" : ""}
                  </p>
                  <div className="space-y-2">
                    {c.offers.map((co) => {
                      const price = Number(co.offer.discountPrice);
                      const earning = (price * Number(c.commissionPct)) / 100;
                      return (
                        <div key={co.id} className="flex items-center justify-between p-3 bg-brand-cream/50 border border-brand-gold/15 gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-brand-bordeaux truncate">{co.offer.title}</p>
                            <p className="text-[10px] text-brand-bordeaux/40">
                              {co.offer.durationMinutes} min · prix {price.toFixed(0)} DT
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm text-brand-gold font-medium">+{earning.toFixed(1)} DT</p>
                            <p className="text-[10px] tracking-wider uppercase text-brand-bordeaux/40">par vente</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-brand-bordeaux/60 mb-4">
                  <span>
                    <strong className="text-brand-bordeaux">Durée :</strong> {c.durationDays} jour{c.durationDays > 1 ? "s" : ""}
                  </span>
                </div>

                {c.message && (
                  <p className="text-xs text-brand-bordeaux/60 italic p-3 bg-brand-cream/50 border-l-2 border-brand-gold mb-4">
                    « {c.message} »
                  </p>
                )}

                <div className="flex gap-3 pt-4 border-t border-brand-gold/15">
                  <button
                    onClick={() => respond(c.id, "ACCEPTED")}
                    disabled={acting === c.id}
                    className="flex-1 px-6 py-2.5 text-xs tracking-[0.15em] uppercase bg-brand-bordeaux text-white hover:bg-brand-gold transition-colors duration-500 disabled:opacity-50"
                  >
                    Accepter
                  </button>
                  <button
                    onClick={() => respond(c.id, "REJECTED")}
                    disabled={acting === c.id}
                    className="flex-1 px-6 py-2.5 text-xs tracking-[0.15em] uppercase border border-red-300 text-red-600 hover:bg-red-50 transition-colors duration-500 disabled:opacity-50"
                  >
                    Refuser
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Accepted */}
      {accepted.length > 0 && (
        <section className="mb-10">
          <h2 className="luxury-heading text-lg text-brand-bordeaux mb-4">Acceptées ({accepted.length})</h2>
          <div className="space-y-4">
            {accepted.map((c) => (
              <div key={c.id} className="bg-white border border-brand-gold/20 p-6">
                <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
                  <div>
                    <p className="text-sm font-medium text-brand-bordeaux">{c.provider.salonName}</p>
                    <p className="text-xs text-brand-bordeaux/40 mt-1">
                      {Number(c.commissionPct).toFixed(0)}% commission · {c.durationDays} jours
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {c.offers.map((co) => (
                    <div key={co.id} className="p-3 border border-brand-gold/15 flex items-center justify-between flex-wrap gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-brand-bordeaux">{co.offer.title}</p>
                        {co.trackingLink && (
                          <p className="text-[10px] text-brand-bordeaux/50 mt-1 font-mono truncate">
                            /api/tracking/click?ref={co.trackingLink.token}
                          </p>
                        )}
                        {co.trackingLink && (
                          <p className="text-[10px] text-brand-gold mt-1">
                            {co.trackingLink.clicksCount} clic{co.trackingLink.clicksCount > 1 ? "s" : ""} ·{" "}
                            {co.trackingLink.conversionsCount} converti{co.trackingLink.conversionsCount > 1 ? "s" : ""}
                          </p>
                        )}
                      </div>
                      {co.trackingLink && (
                        <button
                          onClick={() => copyLink(co.trackingLink!.token)}
                          className="px-4 py-2 text-[10px] tracking-[0.15em] uppercase bg-brand-bordeaux text-white hover:bg-brand-gold transition-colors duration-500 whitespace-nowrap"
                        >
                          {copied === co.trackingLink.token ? "Copié" : "Copier"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Rejected */}
      {rejected.length > 0 && (
        <section>
          <h2 className="luxury-heading text-lg text-brand-bordeaux/60 mb-4">Refusées ({rejected.length})</h2>
          <div className="space-y-2">
            {rejected.map((c) => (
              <div key={c.id} className="bg-white/60 border border-brand-gold/10 p-4">
                <p className="text-sm text-brand-bordeaux/50">
                  {c.provider.salonName} · {c.offers.length} offre{c.offers.length > 1 ? "s" : ""}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
