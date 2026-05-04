"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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

interface Slot {
  id: string;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount: number;
}

export default function EditOfferPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    originalPrice: "",
    discountPrice: "",
    category: "COIFFURE",
    durationMinutes: 60,
    active: true,
    photos: [] as string[],
  });
  const [slots, setSlots] = useState<Slot[]>([]);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/offers/${id}`);
      if (res.ok) {
        const offer = await res.json();
        setForm({
          title: offer.title,
          description: offer.description || "",
          originalPrice: String(offer.originalPrice),
          discountPrice: String(offer.discountPrice),
          category: offer.category,
          durationMinutes: offer.durationMinutes || 60,
          active: offer.active,
          photos: offer.photos || [],
        });
        setSlots(offer.slots || []);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/offers/${id}`, {
        method: "PUT",
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
        setError(data.error || `Erreur ${res.status}`);
        return;
      }
      router.push("/prestataire/offres");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Supprimer cette offre ? Cette action est irreversible.")) return;
    setDeleting(true);
    await fetch(`/api/offers/${id}`, { method: "DELETE" });
    router.push("/prestataire/offres");
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-brand-bordeaux/40 text-xs tracking-[0.2em] uppercase">Chargement...</div>;
  }

  // Group slots by date for the preview
  const futureSlots = slots.filter((s) => new Date(s.startTime).getTime() > Date.now());
  const slotsByDay = new Map<string, Slot[]>();
  for (const s of futureSlots) {
    const d = new Date(s.startTime);
    const key = d.toLocaleDateString("fr-TN", { weekday: "long", day: "numeric", month: "long" });
    if (!slotsByDay.has(key)) slotsByDay.set(key, []);
    slotsByDay.get(key)!.push(s);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="luxury-badge mb-3">Edition</p>
          <h1 className="luxury-heading text-3xl text-brand-bordeaux">Modifier l&apos;offre</h1>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="px-6 py-3 border border-red-300 text-red-600 text-xs tracking-[0.15em] uppercase hover:bg-red-50 transition-colors duration-500 disabled:opacity-50"
        >
          {deleting ? "Suppression..." : "Supprimer"}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-3 text-sm text-red-600 bg-red-50 border border-red-100">{error}</div>
      )}

      <form onSubmit={handleSave} className="bg-white border border-brand-gold/20 p-8 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/60 mb-2">Titre *</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
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
            <label className="block text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/60 mb-2">Prix original (DT)</label>
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
            <label className="block text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/60 mb-2">Prix promo (DT)</label>
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
            <label className="block text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/60 mb-2">Durée du service *</label>
            <select
              value={form.durationMinutes}
              onChange={(e) => setForm({ ...form, durationMinutes: parseInt(e.target.value) })}
              className="w-full px-4 py-3 border border-brand-gold/20 bg-transparent text-brand-bordeaux text-sm focus:outline-none focus:border-brand-gold transition-colors"
            >
              {DURATION_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d < 60 ? `${d} min` : d % 60 === 0 ? `${d / 60} h` : `${Math.floor(d / 60)}h${d % 60}`}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-brand-bordeaux/40 mt-1">
              Modifier la durée régénère les créneaux non réservés.
            </p>
          </div>
          <div className="md:col-span-2">
            <label className="block text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/60 mb-2">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 border border-brand-gold/20 bg-transparent text-brand-bordeaux text-sm focus:outline-none focus:border-brand-gold transition-colors"
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
          <div className="flex items-center gap-3 pt-6">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-checked:bg-brand-gold rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
              <span className="ms-3 text-xs tracking-[0.1em] uppercase text-brand-bordeaux/60">Offre active</span>
            </label>
          </div>
        </div>

        <div className="flex gap-3 pt-6 border-t border-brand-gold/15">
          <button
            type="submit"
            disabled={saving || photoUploading}
            className="px-8 py-3 text-xs tracking-[0.2em] uppercase bg-brand-bordeaux text-white hover:bg-brand-gold transition-colors duration-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Enregistrement..." : photoUploading ? "Upload des photos..." : "Enregistrer"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/prestataire/offres")}
            className="px-8 py-3 text-xs tracking-[0.2em] uppercase border border-brand-gold/20 text-brand-bordeaux hover:border-brand-gold transition-colors duration-500"
          >
            Annuler
          </button>
        </div>
      </form>

      {/* Generated slots preview (read-only) */}
      <div className="bg-white border border-brand-gold/20 p-8 mt-8">
        <p className="luxury-badge mb-3">Aperçu</p>
        <h2 className="luxury-heading text-2xl text-brand-bordeaux mb-2">Créneaux générés</h2>
        <p className="text-xs text-brand-bordeaux/50 mb-6">
          Les créneaux ci-dessous sont générés automatiquement à partir des horaires d&apos;ouverture de votre salon.
          Pour les modifier, ajustez vos horaires dans <Link href="/prestataire/profil" className="text-brand-gold hover:underline">Mon profil</Link>.
        </p>

        {futureSlots.length === 0 ? (
          <div className="p-6 border border-amber-200 bg-amber-50 text-sm text-amber-800">
            Aucun créneau généré. Vérifiez que vous avez défini des horaires d&apos;ouverture dans votre profil.
          </div>
        ) : (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {Array.from(slotsByDay.entries()).slice(0, 14).map(([day, daySlots]) => (
              <div key={day}>
                <p className="text-xs tracking-[0.15em] uppercase text-brand-bordeaux/60 mb-2">{day}</p>
                <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-2">
                  {daySlots.map((s) => {
                    const start = new Date(s.startTime);
                    const isBooked = s.bookedCount > 0;
                    return (
                      <div
                        key={s.id}
                        className={`px-2 py-2 text-center text-[11px] border ${
                          isBooked
                            ? "border-brand-bordeaux bg-brand-bordeaux text-white"
                            : "border-brand-gold/20 text-brand-bordeaux/70"
                        }`}
                        title={isBooked ? "Réservé" : "Disponible"}
                      >
                        {start.toLocaleTimeString("fr-TN", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {slotsByDay.size > 14 && (
              <p className="text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/40 text-center pt-2">
                {slotsByDay.size - 14} jour(s) supplémentaire(s)…
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
