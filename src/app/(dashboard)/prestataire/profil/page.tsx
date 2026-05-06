"use client";

import { useEffect, useState } from "react";
import { OpeningHoursEditor } from "@/components/opening-hours-editor";
import { emptyOpeningHours, type OpeningHours, isValidOpeningHours } from "@/lib/opening-hours";

const categories = [
  { value: "COIFFURE", label: "Coiffure" },
  { value: "ESTHETIQUE", label: "Esthetique" },
  { value: "ONGLERIE", label: "Onglerie" },
  { value: "MASSAGE", label: "Massage" },
  { value: "PARFUMERIE", label: "Parfumerie" },
  { value: "AUTRE", label: "Autre" },
];

export default function ProviderProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    salonName: "",
    category: "COIFFURE",
    description: "",
    address: "",
    city: "",
    phone: "",
    matriculeFiscal: "",
    receiptFooter: "",
  });
  const [openingHours, setOpeningHours] = useState<OpeningHours>(emptyOpeningHours());
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/provider/profile");
      if (res.ok) {
        const profile = await res.json();
        setForm({
          salonName: profile.salonName || "",
          category: profile.category || "COIFFURE",
          description: profile.description || "",
          address: profile.address || "",
          city: profile.city || "",
          phone: profile.phone || "",
          matriculeFiscal: profile.matriculeFiscal || "",
          receiptFooter: profile.receiptFooter || "",
        });
        if (isValidOpeningHours(profile.openingHours)) {
          setOpeningHours(profile.openingHours);
        } else {
          setOpeningHours(emptyOpeningHours());
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    setError("");
    try {
      const res = await fetch("/api/provider/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, openingHours }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Erreur ${res.status}`);
        return;
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
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
        <h1 className="luxury-heading text-3xl text-brand-bordeaux">Mon profil salon</h1>
      </div>

      {success && (
        <div className="mb-6 p-4 border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm">
          Profil mis a jour avec succes
        </div>
      )}
      {error && (
        <div className="mb-6 p-4 border border-red-200 bg-red-50 text-red-600 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white border border-brand-gold/20 p-8 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/60 mb-2">Nom du salon *</label>
            <input
              value={form.salonName}
              onChange={(e) => setForm({ ...form, salonName: e.target.value })}
              required
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
              {categories.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/60 mb-2">Ville</label>
            <input
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="w-full px-4 py-3 border border-brand-gold/20 bg-transparent text-brand-bordeaux text-sm placeholder:text-brand-bordeaux/30 focus:outline-none focus:border-brand-gold transition-colors"
              placeholder="Tunis, Sousse, ..."
            />
          </div>
          <div>
            <label className="block text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/60 mb-2">Telephone</label>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-4 py-3 border border-brand-gold/20 bg-transparent text-brand-bordeaux text-sm placeholder:text-brand-bordeaux/30 focus:outline-none focus:border-brand-gold transition-colors"
              placeholder="+216 XX XXX XXX"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/60 mb-2">Adresse</label>
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-4 py-3 border border-brand-gold/20 bg-transparent text-brand-bordeaux text-sm focus:outline-none focus:border-brand-gold transition-colors"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/60 mb-2">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={4}
              className="w-full px-4 py-3 border border-brand-gold/20 bg-transparent text-brand-bordeaux text-sm placeholder:text-brand-bordeaux/30 focus:outline-none focus:border-brand-gold transition-colors"
              placeholder="Presentez votre salon..."
            />
          </div>
        </div>

        <div className="pt-6 border-t border-brand-gold/15">
          <p className="luxury-badge mb-3">Informations fiscales</p>
          <h2 className="luxury-heading text-xl text-brand-bordeaux mb-2">Reçus & TVA</h2>
          <p className="text-xs text-brand-bordeaux/50 mb-5 max-w-2xl">
            Imprimés sur les reçus de caisse. Le matricule fiscal est requis pour la conformité TVA.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
            <div>
              <label className="block text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/60 mb-2">
                Matricule fiscal
              </label>
              <input
                value={form.matriculeFiscal}
                onChange={(e) => setForm({ ...form, matriculeFiscal: e.target.value })}
                className="w-full px-4 py-3 border border-brand-gold/20 bg-transparent text-brand-bordeaux text-sm focus:outline-none focus:border-brand-gold"
                placeholder="1234567/A/M/000"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/60 mb-2">
                Pied de reçu
              </label>
              <textarea
                value={form.receiptFooter}
                onChange={(e) => setForm({ ...form, receiptFooter: e.target.value })}
                rows={2}
                maxLength={200}
                className="w-full px-4 py-3 border border-brand-gold/20 bg-transparent text-brand-bordeaux text-sm focus:outline-none focus:border-brand-gold"
                placeholder="Note imprimée en bas du reçu (politique de retour, remerciement, etc.)"
              />
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-brand-gold/15">
          <p className="luxury-badge mb-3">Disponibilités</p>
          <h2 className="luxury-heading text-xl text-brand-bordeaux mb-2">Horaires d&apos;ouverture</h2>
          <p className="text-xs text-brand-bordeaux/50 mb-5 max-w-2xl">
            Définissez les plages horaires pendant lesquelles votre salon accepte des clients.
            Les créneaux de réservation seront générés automatiquement selon la durée de chaque service.
            Vous pouvez ajouter plusieurs plages par jour (ex : pause déjeuner).
          </p>
          <OpeningHoursEditor value={openingHours} onChange={setOpeningHours} />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-8 py-3 text-xs tracking-[0.2em] uppercase bg-brand-bordeaux text-white hover:bg-brand-gold transition-colors duration-500 disabled:opacity-50"
        >
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
      </form>
    </div>
  );
}
