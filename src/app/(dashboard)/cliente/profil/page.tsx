"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export default function ClienteProfil() {
  const { data: session } = useSession();
  const [form, setForm] = useState({ name: "", phone: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/client/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) {
          setForm({ name: data.name || "", phone: data.phone || "" });
        }
        setLoading(false);
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    await fetch("/api/client/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-brand-bordeaux/40 text-xs tracking-[0.2em] uppercase">Chargement...</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <p className="luxury-badge mb-3">Parametres</p>
        <h1 className="luxury-heading text-3xl text-brand-bordeaux">Mon profil</h1>
      </div>

      <div className="max-w-lg">
        {/* Avatar */}
        <div className="flex items-center gap-4 mb-8 p-6 bg-white border border-brand-gold/20">
          <div className="w-16 h-16 bg-brand-bordeaux flex items-center justify-center text-white text-xl font-medium tracking-wider">
            {session?.user?.name?.[0]?.toUpperCase() || "?"}
          </div>
          <div>
            <p className="text-sm font-medium text-brand-bordeaux">{session?.user?.name}</p>
            <p className="text-xs text-brand-bordeaux/40 mt-1">{session?.user?.email}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-brand-gold/20 p-8 space-y-5">
          <div>
            <label className="block text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/60 mb-2">Nom</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-3 border border-brand-gold/20 bg-transparent text-brand-bordeaux text-sm focus:outline-none focus:border-brand-gold transition-colors"
            />
          </div>

          <div>
            <label className="block text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/60 mb-2">Telephone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+216 XX XXX XXX"
              className="w-full px-4 py-3 border border-brand-gold/20 bg-transparent text-brand-bordeaux text-sm placeholder:text-brand-bordeaux/30 focus:outline-none focus:border-brand-gold transition-colors"
            />
          </div>

          <div className="p-4 border border-brand-gold/10 bg-brand-cream text-sm text-brand-bordeaux/60">
            <p><strong>Email :</strong> {session?.user?.email}</p>
            <p className="text-xs text-brand-bordeaux/30 mt-1">L&apos;email ne peut pas etre modifie.</p>
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
    </div>
  );
}
