"use client";

import { useEffect, useState } from "react";

interface Influencer {
  id: string;
  instagramHandle: string;
  followersCount: number;
  category: string | null;
  bio: string | null;
  verified: boolean;
  user: { name: string | null; email: string; avatar: string | null };
}

interface Offer {
  id: string;
  title: string;
  discountPrice: string;
}

interface CollabOffer {
  id: string;
  offer: { id: string; title: string; discountPrice: string };
  trackingLink: { token: string; clicksCount: number; conversionsCount: number } | null;
}

interface Collab {
  id: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  commissionPct: string;
  durationDays: number;
  message: string | null;
  createdAt: string;
  influencer: { instagramHandle: string; user: { name: string | null } };
  offers: CollabOffer[];
}

export default function CollaborationsPage() {
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [collabs, setCollabs] = useState<Collab[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Influencer | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    offerIds: [] as string[],
    commissionPct: "10",
    durationDays: "30",
    message: "",
  });

  async function loadAll() {
    const [infRes, offRes, collabRes] = await Promise.all([
      fetch("/api/influencers"),
      fetch("/api/offers?mine=1"),
      fetch("/api/collaborations"),
    ]);
    if (infRes.ok) setInfluencers(await infRes.json());
    if (offRes.ok) setOffers(await offRes.json());
    if (collabRes.ok) setCollabs(await collabRes.json());
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  function toggleOfferInForm(id: string) {
    setForm((f) =>
      f.offerIds.includes(id)
        ? { ...f, offerIds: f.offerIds.filter((x) => x !== id) }
        : { ...f, offerIds: [...f.offerIds, id] }
    );
  }

  async function propose(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError("");
    if (form.offerIds.length === 0) {
      setError("Sélectionnez au moins une offre");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/collaborations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        influencerId: selected.id,
        offerIds: form.offerIds,
        commissionPct: parseFloat(form.commissionPct),
        durationDays: parseInt(form.durationDays),
        message: form.message || null,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || `Erreur ${res.status}`);
    } else {
      setSelected(null);
      setForm({ offerIds: [], commissionPct: "10", durationDays: "30", message: "" });
      await loadAll();
    }
    setSaving(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-brand-bordeaux/40 text-xs tracking-[0.2em] uppercase">Chargement...</div>;
  }

  return (
    <div>
      <div className="mb-10">
        <p className="luxury-badge mb-3">Partenariats</p>
        <h1 className="luxury-heading text-3xl text-brand-bordeaux">Collaborations</h1>
        <p className="text-sm text-brand-bordeaux/40 mt-2">Choisissez une influenceuse et proposez-lui une ou plusieurs offres</p>
      </div>

      {/* Outgoing requests */}
      <div className="bg-white border border-brand-gold/20 mb-10">
        <div className="p-6 border-b border-brand-gold/15">
          <h2 className="luxury-heading text-lg text-brand-bordeaux">Mes demandes</h2>
        </div>
        {collabs.length === 0 ? (
          <p className="p-6 text-sm text-brand-bordeaux/40">Aucune demande envoyée</p>
        ) : (
          <div className="divide-y divide-brand-gold/10">
            {collabs.map((c) => (
              <div key={c.id} className="p-5 flex items-start justify-between flex-wrap gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-brand-bordeaux font-medium">
                    {c.influencer.user.name || c.influencer.instagramHandle}
                  </p>
                  <p className="text-xs text-brand-bordeaux/40 mt-1">
                    {Number(c.commissionPct).toFixed(0)}% commission · {c.durationDays} jour{c.durationDays > 1 ? "s" : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {c.offers.map((co) => (
                      <span key={co.id} className="px-2 py-0.5 text-[10px] tracking-wider uppercase border border-brand-gold/30 text-brand-bordeaux/70">
                        {co.offer.title}
                      </span>
                    ))}
                  </div>
                  {c.status === "ACCEPTED" && c.offers.some((o) => o.trackingLink) && (
                    <div className="mt-3 space-y-1">
                      {c.offers.map((co) =>
                        co.trackingLink ? (
                          <p key={co.id} className="text-[10px] text-brand-gold font-mono">
                            {co.offer.title}: {co.trackingLink.clicksCount} clics · {co.trackingLink.conversionsCount} convertis
                          </p>
                        ) : null
                      )}
                    </div>
                  )}
                </div>
                <CollabBadge status={c.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Influencers list */}
      <h2 className="luxury-heading text-xl text-brand-bordeaux mb-5">Influenceuses disponibles</h2>
      {influencers.length === 0 ? (
        <div className="bg-white border border-brand-gold/20 p-12 text-center">
          <p className="text-sm text-brand-bordeaux/40">Aucune influenceuse inscrite pour le moment</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {influencers.map((inf) => (
            <div key={inf.id} className="bg-white border border-brand-gold/20 p-6 hover:border-brand-gold transition-colors duration-500">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="luxury-heading text-lg text-brand-bordeaux">{inf.user.name || inf.instagramHandle}</h3>
                  <p className="text-xs text-brand-bordeaux/40 mt-0.5">@{inf.instagramHandle}</p>
                </div>
                {inf.verified && (
                  <span className="px-2 py-0.5 border border-brand-gold text-brand-gold text-[9px] tracking-wider uppercase">Vérifiée</span>
                )}
              </div>
              <p className="text-xs text-brand-bordeaux/60 mb-3">{inf.followersCount.toLocaleString()} abonnés</p>
              {inf.category && <p className="text-xs text-brand-bordeaux/50 mb-3">{inf.category}</p>}
              {inf.bio && <p className="text-xs text-brand-bordeaux/50 mb-4 line-clamp-2">{inf.bio}</p>}
              <button
                onClick={() => {
                  setSelected(inf);
                  setError("");
                }}
                className="w-full px-4 py-2.5 text-[10px] tracking-[0.2em] uppercase bg-brand-bordeaux text-white hover:bg-brand-gold transition-colors duration-500"
              >
                Demander à collaborer
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Proposal modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 overflow-y-auto" onClick={() => setSelected(null)}>
          <form
            onSubmit={propose}
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-brand-gold/30 p-8 max-w-lg w-full space-y-5 my-8"
          >
            <div>
              <p className="luxury-badge mb-2">Proposition</p>
              <h2 className="luxury-heading text-2xl text-brand-bordeaux">
                {selected.user.name || selected.instagramHandle}
              </h2>
              <p className="text-xs text-brand-bordeaux/50 mt-1">
                @{selected.instagramHandle} · {selected.followersCount.toLocaleString()} abonnés
              </p>
            </div>

            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100">{error}</div>
            )}

            <div>
              <label className="block text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/60 mb-2">
                Offres incluses *
              </label>
              <p className="text-xs text-brand-bordeaux/50 mb-3">
                Sélectionnez les services que l&apos;influenceuse pourra promouvoir
              </p>
              {offers.length === 0 ? (
                <p className="text-xs text-amber-700 italic">
                  Vous n&apos;avez pas encore d&apos;offres. Créez-en au moins une avant.
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto border border-brand-gold/15 p-2">
                  {offers.map((o) => {
                    const checked = form.offerIds.includes(o.id);
                    return (
                      <label
                        key={o.id}
                        className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
                          checked ? "bg-brand-gold/10 border border-brand-gold/40" : "hover:bg-brand-cream/50 border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleOfferInForm(o.id)}
                            className="w-4 h-4 accent-brand-gold"
                          />
                          <span className="text-sm text-brand-bordeaux truncate">{o.title}</span>
                        </div>
                        <span className="text-xs text-brand-gold shrink-0">
                          {Number(o.discountPrice).toFixed(0)} DT
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/60 mb-2">
                  Commission (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  required
                  value={form.commissionPct}
                  onChange={(e) => setForm({ ...form, commissionPct: e.target.value })}
                  className="w-full px-4 py-3 border border-brand-gold/20 bg-transparent text-brand-bordeaux text-sm focus:outline-none focus:border-brand-gold"
                />
                <p className="text-[10px] text-brand-bordeaux/40 mt-1">
                  % du prix de chaque offre vendue via son lien
                </p>
              </div>
              <div>
                <label className="block text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/60 mb-2">Durée (jours)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={form.durationDays}
                  onChange={(e) => setForm({ ...form, durationDays: e.target.value })}
                  className="w-full px-4 py-3 border border-brand-gold/20 bg-transparent text-brand-bordeaux text-sm focus:outline-none focus:border-brand-gold"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/60 mb-2">Message</label>
              <textarea
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 border border-brand-gold/20 bg-transparent text-brand-bordeaux text-sm focus:outline-none focus:border-brand-gold"
                placeholder="Présentez votre proposition..."
              />
            </div>

            {form.offerIds.length > 0 && (
              <div className="p-4 bg-brand-cream/50 border border-brand-gold/15 text-xs space-y-1">
                <p className="text-brand-bordeaux/50 tracking-[0.15em] uppercase text-[10px] mb-2">Récapitulatif</p>
                {form.offerIds.map((id) => {
                  const o = offers.find((x) => x.id === id);
                  if (!o) return null;
                  const commission = (Number(o.discountPrice) * Number(form.commissionPct)) / 100;
                  return (
                    <div key={id} className="flex justify-between">
                      <span className="text-brand-bordeaux">{o.title}</span>
                      <span className="text-brand-bordeaux/60">
                        {Number(o.discountPrice).toFixed(0)} DT → {commission.toFixed(1)} DT/vente
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t border-brand-gold/15">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-6 py-3 text-xs tracking-[0.2em] uppercase bg-brand-bordeaux text-white hover:bg-brand-gold transition-colors duration-500 disabled:opacity-50"
              >
                {saving ? "Envoi..." : "Envoyer la proposition"}
              </button>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="px-6 py-3 text-xs tracking-[0.2em] uppercase border border-brand-gold/20 text-brand-bordeaux hover:border-brand-gold transition-colors duration-500"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function CollabBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: "border-amber-300 text-amber-700",
    ACCEPTED: "border-emerald-300 text-emerald-700",
    REJECTED: "border-red-300 text-red-700",
  };
  const labels: Record<string, string> = {
    PENDING: "En attente",
    ACCEPTED: "Acceptée",
    REJECTED: "Refusée",
  };
  return (
    <span className={`px-3 py-1 border text-[10px] tracking-[0.1em] uppercase font-medium ${styles[status]}`}>
      {labels[status] || status}
    </span>
  );
}
