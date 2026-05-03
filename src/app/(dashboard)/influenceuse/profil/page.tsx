"use client";

import { useEffect, useState } from "react";

export default function InfluencerProfil() {
  const [form, setForm] = useState({
    instagramHandle: "",
    followersCount: 0,
    bio: "",
    category: "",
  });
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/influencer/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) {
          setForm({
            instagramHandle: data.instagramHandle || "",
            followersCount: data.followersCount || 0,
            bio: data.bio || "",
            category: data.category || "",
          });
          setVerified(Boolean(data.verified));
        }
        setLoading(false);
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");

    try {
      const res = await fetch("/api/influencer/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          instagramHandle: form.instagramHandle.replace(/^@/, "").trim(),
          followersCount: Number(form.followersCount),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Erreur ${res.status}`);
        setSaving(false);
        return;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-brand-bordeaux/40 text-xs tracking-[0.2em] uppercase">Chargement...</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <p className="luxury-badge mb-3">Parametres</p>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="luxury-heading text-3xl text-brand-bordeaux">Mon profil</h1>
          {verified ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 border border-brand-gold bg-brand-gold/5 text-brand-gold text-[10px] tracking-[0.15em] uppercase">
              <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Vérifiée
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 border border-brand-bordeaux/20 text-brand-bordeaux/40 text-[10px] tracking-[0.15em] uppercase">
              Non vérifiée
            </span>
          )}
        </div>
        {!verified && (
          <p className="text-xs text-brand-bordeaux/40 mt-3 max-w-md">
            Votre profil sera vérifié par notre équipe sous 24-48h après validation de votre compte Instagram.
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="max-w-lg bg-white border border-brand-gold/20 p-8 space-y-5">
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100">
            {error}
          </div>
        )}
        {saved && (
          <div className="p-3 text-sm text-green-700 bg-green-50 border border-green-100">
            Profil enregistré
          </div>
        )}
        <div>
          <label className="block text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/60 mb-2">
            Pseudo Instagram *
          </label>
          <div className="flex">
            <span className="inline-flex items-center px-4 border border-r-0 border-brand-gold/20 bg-brand-cream text-brand-bordeaux/40 text-sm">
              @
            </span>
            <input
              type="text"
              value={form.instagramHandle}
              onChange={(e) => setForm({ ...form, instagramHandle: e.target.value })}
              required
              className="flex-1 px-4 py-3 border border-brand-gold/20 bg-transparent text-brand-bordeaux text-sm focus:outline-none focus:border-brand-gold transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/60 mb-2">
            Nombre de followers
          </label>
          <input
            type="number"
            value={form.followersCount}
            onChange={(e) => setForm({ ...form, followersCount: Number(e.target.value) })}
            min={0}
            className="w-full px-4 py-3 border border-brand-gold/20 bg-transparent text-brand-bordeaux text-sm focus:outline-none focus:border-brand-gold transition-colors"
          />
        </div>

        <div>
          <label className="block text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/60 mb-2">Categorie</label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full px-4 py-3 border border-brand-gold/20 bg-transparent text-brand-bordeaux text-sm focus:outline-none focus:border-brand-gold transition-colors"
          >
            <option value="">Selectionner</option>
            <option value="COIFFURE">Coiffure</option>
            <option value="ESTHETIQUE">Esthetique</option>
            <option value="ONGLERIE">Onglerie</option>
            <option value="MASSAGE">Massage</option>
            <option value="PARFUMERIE">Parfumerie</option>
            <option value="AUTRE">Autre</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/60 mb-2">Bio</label>
          <textarea
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            rows={3}
            className="w-full px-4 py-3 border border-brand-gold/20 bg-transparent text-brand-bordeaux text-sm placeholder:text-brand-bordeaux/30 focus:outline-none focus:border-brand-gold transition-colors"
            placeholder="Presentez-vous en quelques mots..."
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-8 py-3 text-xs tracking-[0.2em] uppercase bg-brand-bordeaux text-white hover:bg-brand-gold transition-colors duration-500 disabled:opacity-50"
        >
          {saving ? "Enregistrement..." : saved ? "Enregistre" : "Enregistrer"}
        </button>
      </form>
    </div>
  );
}
