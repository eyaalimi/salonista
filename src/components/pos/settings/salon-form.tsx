"use client";

import { useState } from "react";
import { ImageUpload } from "@/components/image-upload";
import dynamic from "next/dynamic";

// Leaflet manipule le DOM et n'existe pas cote serveur : sans ssr:false, le
// build echoue sur « window is not defined ».
const LocationPicker = dynamic(() => import("@/components/map/location-picker"), {
  ssr: false,
  loading: () => (
    <div className="h-64 w-full rounded border border-pos-border bg-pos-bg" />
  ),
});

export type SalonProfile = {
  salonName: string;
  category: string;
  description: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  photos: string[];
  logo: string | null;
  matriculeFiscal: string | null;
  receiptFooter: string | null;
};

const CATEGORIES = [
  { value: "COIFFURE", label: "Coiffure" },
  { value: "ESTHETIQUE", label: "Esthétique" },
  { value: "ONGLERIE", label: "Onglerie" },
  { value: "MASSAGE", label: "Massage" },
  { value: "PARFUMERIE", label: "Parfumerie" },
  { value: "AUTRE", label: "Autre" },
];

const FOOTER_MAX = 200;

export function SalonForm({ initial }: { initial: SalonProfile }) {
  const [form, setForm] = useState({
    salonName: initial.salonName,
    category: initial.category,
    description: initial.description ?? "",
    address: initial.address ?? "",
    city: initial.city ?? "",
    phone: initial.phone ?? "",
    lat: initial.lat,
    lng: initial.lng,
    photos: initial.photos ?? [],
    logo: initial.logo ?? null,
    matriculeFiscal: initial.matriculeFiscal ?? "",
    receiptFooter: initial.receiptFooter ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function patch<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setOk(false);
  }

  async function save() {
    if (busy || uploading || !form.salonName.trim()) return;
    setBusy(true);
    setError(null);
    setOk(false);
    try {
      const res = await fetch("/api/provider/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salonName: form.salonName.trim(),
          category: form.category,
          description: form.description.trim() || null,
          address: form.address.trim() || null,
          city: form.city.trim() || null,
          phone: form.phone.trim() || null,
          lat: form.lat,
          lng: form.lng,
          photos: form.photos,
          logo: form.logo,
          matriculeFiscal: form.matriculeFiscal.trim() || null,
          receiptFooter: form.receiptFooter.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Enregistrement impossible.");
        return;
      }
      setOk(true);
    } catch {
      setError("Erreur réseau.");
    } finally {
      setBusy(false);
    }
  }

  const footerTrop = form.receiptFooter.length > FOOTER_MAX;

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded bg-pos-danger-soft px-3 py-2 text-sm text-pos-danger">{error}</div>
      )}
      {ok && (
        <div className="rounded bg-pos-accent-soft px-3 py-2 text-sm text-pos-accent">
          Profil enregistré.
        </div>
      )}

      <label className="block">
        <span className="mb-1 block text-xs uppercase tracking-wider text-pos-ink-3">
          Nom du salon
        </span>
        <input
          className="w-full rounded border border-pos-border bg-white px-3 py-2 text-sm"
          value={form.salonName}
          onChange={(e) => patch("salonName", e.target.value)}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wider text-pos-ink-3">
            Catégorie
          </span>
          <select
            className="w-full rounded border border-pos-border bg-white px-3 py-2 text-sm"
            value={form.category}
            onChange={(e) => patch("category", e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wider text-pos-ink-3">
            Téléphone
          </span>
          <input
            className="w-full rounded border border-pos-border bg-white px-3 py-2 text-sm"
            value={form.phone}
            onChange={(e) => patch("phone", e.target.value)}
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs uppercase tracking-wider text-pos-ink-3">
          Adresse
        </span>
        <input
          className="w-full rounded border border-pos-border bg-white px-3 py-2 text-sm"
          value={form.address}
          onChange={(e) => patch("address", e.target.value)}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wider text-pos-ink-3">
            Ville
          </span>
          <input
            className="w-full rounded border border-pos-border bg-white px-3 py-2 text-sm"
            value={form.city}
            onChange={(e) => patch("city", e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wider text-pos-ink-3">
            Matricule fiscal
          </span>
          <input
            className="w-full rounded border border-pos-border bg-white px-3 py-2 text-sm"
            value={form.matriculeFiscal}
            onChange={(e) => patch("matriculeFiscal", e.target.value)}
          />
        </label>
      </div>

      <div>
        <span className="mb-1 block text-xs uppercase tracking-wider text-pos-ink-3">
          Emplacement sur la carte
        </span>
        <LocationPicker
          lat={form.lat}
          lng={form.lng}
          address={form.address}
          city={form.city}
          onChange={(lat, lng) => {
            setForm((f) => ({ ...f, lat, lng }));
            setOk(false);
          }}
        />
      </div>

      <label className="block">
        <span className="mb-1 block text-xs uppercase tracking-wider text-pos-ink-3">
          Description
        </span>
        <textarea
          rows={3}
          className="w-full rounded border border-pos-border bg-white px-3 py-2 text-sm"
          value={form.description}
          onChange={(e) => patch("description", e.target.value)}
        />
      </label>

      <div>
        <span className="mb-1 block text-xs uppercase tracking-wider text-pos-ink-3">
          Logo du salon
        </span>
        <p className="mb-2 text-xs text-pos-ink-3">
          Votre enseigne. Elle apparaît sur vos tickets et votre fiche.
        </p>
        {/* `max={1}` : un logo est unique. Le tableau n'est qu'un adaptateur
            vers <ImageUpload>, qui travaille sur des listes. */}
        <ImageUpload
          images={form.logo ? [form.logo] : []}
          onChange={(images) => patch("logo", images[0] ?? null)}
          onUploadingChange={setUploading}
          max={1}
        />
      </div>

      <div>
        <span className="mb-1 block text-xs uppercase tracking-wider text-pos-ink-3">
          Photos du salon
        </span>
        <ImageUpload
          images={form.photos}
          onChange={(photos) => patch("photos", photos)}
          onUploadingChange={setUploading}
          max={5}
        />
      </div>

      <label className="block">
        <span className="mb-1 flex items-center justify-between text-xs uppercase tracking-wider text-pos-ink-3">
          <span>Pied de ticket</span>
          <span className={footerTrop ? "text-pos-danger" : ""}>
            {form.receiptFooter.length}/{FOOTER_MAX}
          </span>
        </span>
        <input
          className="w-full rounded border border-pos-border bg-white px-3 py-2 text-sm"
          placeholder="Merci de votre visite !"
          value={form.receiptFooter}
          onChange={(e) => patch("receiptFooter", e.target.value)}
        />
      </label>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={busy || uploading || footerTrop || !form.salonName.trim()}
          className="rounded bg-pos-ink px-4 py-2 text-sm font-medium text-pos-bg disabled:opacity-50"
        >
          {uploading ? "Upload en cours…" : busy ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}
