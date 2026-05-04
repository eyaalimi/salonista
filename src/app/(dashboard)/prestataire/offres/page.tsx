"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ImageUpload } from "@/components/image-upload";

const categories = [
  { value: "COIFFURE", label: "Coiffure" },
  { value: "ESTHETIQUE", label: "Esthetique" },
  { value: "ONGLERIE", label: "Onglerie" },
  { value: "MASSAGE", label: "Massage" },
  { value: "PARFUMERIE", label: "Parfumerie" },
  { value: "AUTRE", label: "Autre" },
];

const DURATION_OPTIONS = [15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240];

interface Offer {
  id: string;
  title: string;
  originalPrice: string;
  discountPrice: string;
  category: string;
  durationMinutes: number;
  photos: string[];
  active: boolean;
  createdAt: string;
  _count: { bookingItems: number; trackingLinks: number; slots: number };
}

export default function ProviderOffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    originalPrice: "",
    discountPrice: "",
    category: "COIFFURE",
    durationMinutes: 60,
    photos: [] as string[],
  });
  const [createError, setCreateError] = useState("");

  async function loadOffers() {
    const res = await fetch("/api/offers");
    if (res.ok) setOffers(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    loadOffers();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setCreateError("");
    try {
      const res = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          originalPrice: parseFloat(form.originalPrice),
          discountPrice: parseFloat(form.discountPrice),
          durationMinutes: form.durationMinutes,
          photos: form.photos,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCreateError(data.error || `Erreur ${res.status}`);
        return;
      }
      setShowForm(false);
      setForm({ title: "", description: "", originalPrice: "", discountPrice: "", category: "COIFFURE", durationMinutes: 60, photos: [] });
      await loadOffers();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(id: string, active: boolean) {
    await fetch(`/api/offers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    await loadOffers();
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-brand-bordeaux/40 text-xs tracking-[0.2em] uppercase">Chargement...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="luxury-badge mb-3">Gestion</p>
          <h1 className="luxury-heading text-3xl text-brand-bordeaux">Mes offres</h1>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-6 py-3 text-xs tracking-[0.2em] uppercase bg-brand-bordeaux text-white hover:bg-brand-gold transition-colors duration-500"
        >
          {showForm ? "Annuler" : "Nouvelle offre"}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-brand-gold/20 p-8 mb-8 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/60 mb-2">Titre *</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                className="w-full px-4 py-3 border border-brand-gold/20 bg-transparent text-brand-bordeaux text-sm placeholder:text-brand-bordeaux/30 focus:outline-none focus:border-brand-gold transition-colors"
                placeholder="Ex: Lissage bresilien -30%"
              />
            </div>
            <div>
              <label className="block text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/60 mb-2">Categorie *</label>
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
              <label className="block text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/60 mb-2">Prix original (DT) *</label>
              <input
                type="number"
                step="0.001"
                value={form.originalPrice}
                onChange={(e) => setForm({ ...form, originalPrice: e.target.value })}
                required
                className="w-full px-4 py-3 border border-brand-gold/20 bg-transparent text-brand-bordeaux text-sm focus:outline-none focus:border-brand-gold transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/60 mb-2">Prix promo (DT) *</label>
              <input
                type="number"
                step="0.001"
                value={form.discountPrice}
                onChange={(e) => setForm({ ...form, discountPrice: e.target.value })}
                required
                className="w-full px-4 py-3 border border-brand-gold/20 bg-transparent text-brand-bordeaux text-sm focus:outline-none focus:border-brand-gold transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/60 mb-2">
                Durée du service *
              </label>
              <select
                value={form.durationMinutes}
                onChange={(e) => setForm({ ...form, durationMinutes: parseInt(e.target.value) })}
                required
                className="w-full px-4 py-3 border border-brand-gold/20 bg-transparent text-brand-bordeaux text-sm focus:outline-none focus:border-brand-gold transition-colors"
              >
                {DURATION_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d < 60 ? `${d} min` : d % 60 === 0 ? `${d / 60} h` : `${Math.floor(d / 60)}h${d % 60}`}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/60 mb-2">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 border border-brand-gold/20 bg-transparent text-brand-bordeaux text-sm placeholder:text-brand-bordeaux/30 focus:outline-none focus:border-brand-gold transition-colors"
                placeholder="Decrivez votre offre..."
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/60 mb-2">Photos</label>
              <ImageUpload
                images={form.photos}
                onChange={(photos) => setForm({ ...form, photos })}
                onUploadingChange={setPhotoUploading}
              />
            </div>
            <div className="md:col-span-2 pt-4 border-t border-brand-gold/15 bg-brand-cream/30 -mx-8 px-8 py-5">
              <p className="text-xs text-brand-bordeaux/60 leading-relaxed">
                <strong className="text-brand-bordeaux">Créneaux automatiques :</strong> dès la création de l&apos;offre, les créneaux sont générés sur 30 jours selon les horaires d&apos;ouverture de votre salon et la durée du service.
              </p>
              <p className="text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/40 mt-2">
                Pensez à définir vos horaires dans <Link href="/prestataire/profil" className="text-brand-gold hover:underline">Mon profil</Link>.
              </p>
            </div>
          </div>
          {createError && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100">
              {createError}
            </div>
          )}
          <button
            type="submit"
            disabled={saving || photoUploading}
            className="px-8 py-3 text-xs tracking-[0.2em] uppercase bg-brand-bordeaux text-white hover:bg-brand-gold transition-colors duration-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Création..." : photoUploading ? "Upload des photos..." : "Créer l'offre"}
          </button>
        </form>
      )}

      {/* Offers list */}
      {offers.length === 0 ? (
        <div className="bg-white border border-brand-gold/20 p-16 text-center">
          <p className="text-brand-bordeaux/40 text-sm mb-6">Vous n&apos;avez pas encore d&apos;offres</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-8 py-3 text-xs tracking-[0.2em] uppercase bg-brand-bordeaux text-white hover:bg-brand-gold transition-colors duration-500"
          >
            Creer ma premiere offre
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {offers.map((offer) => (
            <div key={offer.id} className="bg-white border border-brand-gold/20 overflow-hidden hover:border-brand-gold transition-colors duration-500">
              {offer.photos.length > 0 && (
                <div className="relative aspect-[16/9] overflow-hidden">
                  <Image src={offer.photos[0]} alt={offer.title} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
                </div>
              )}
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <span className="luxury-badge text-[10px]">
                    {categories.find((c) => c.value === offer.category)?.label}
                  </span>
                  <button
                    onClick={() => toggleActive(offer.id, offer.active)}
                    className={`px-3 py-1 border text-[10px] tracking-[0.1em] uppercase font-medium ${
                      offer.active ? "border-emerald-300 text-emerald-700" : "border-red-300 text-red-700"
                    }`}
                  >
                    {offer.active ? "Active" : "Inactive"}
                  </button>
                </div>
                <h3 className="luxury-heading text-lg text-brand-bordeaux mb-3">{offer.title}</h3>
                <div className="flex items-baseline gap-3 mb-4">
                  <span className="text-brand-bordeaux/30 line-through text-sm">
                    {Number(offer.originalPrice).toFixed(0)} DT
                  </span>
                  <span className="luxury-heading text-xl text-brand-gold">
                    {Number(offer.discountPrice).toFixed(0)} DT
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-brand-bordeaux/40 tracking-wider flex-wrap">
                  <span>{offer.durationMinutes} min</span>
                  <span>{offer._count.bookingItems} reservation(s)</span>
                  <span>{offer._count.trackingLinks} lien(s)</span>
                </div>
                {offer._count.slots === 0 && (
                  <p className="text-xs text-amber-700 mt-2">
                    Aucun créneau généré. Définissez vos horaires d&apos;ouverture dans <Link href="/prestataire/profil" className="text-brand-gold hover:underline">votre profil</Link>.
                  </p>
                )}
              </div>
              <div className="border-t border-brand-gold/15 p-4">
                <Link
                  href={`/prestataire/offres/${offer.id}`}
                  className="block text-center text-[10px] tracking-[0.2em] uppercase text-brand-gold hover:text-brand-bordeaux transition-colors duration-500"
                >
                  Modifier
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
