"use client";

import { useState } from "react";
import { ImageUpload } from "@/components/image-upload";
import { PHOTOS_MAX_SALON } from "@/lib/upload-image";
import { delegationsDe, nomsGouvernorats } from "@/lib/tunisie-geo";
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
  /** La DELEGATION. Le nom `city` est celui de la colonne, conserve. */
  city: string | null;
  governorate: string | null;
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
    governorate: initial.governorate ?? "",
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
    // Le telephone est obligatoire : il porte les confirmations WhatsApp.
    if (busy || uploading || !form.salonName.trim() || !form.phone.trim() || !form.governorate || !form.city.trim() || form.address.trim().length < 3) return;
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
          governorate: form.governorate || null,
          phone: form.phone.trim(),
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
            Téléphone <span className="text-pos-danger">*</span>
          </span>
          <input
            type="tel"
            inputMode="tel"
            required
            placeholder="20 123 456"
            className="w-full rounded border border-pos-border bg-white px-3 py-2 text-sm text-pos-ink placeholder:text-pos-ink-3"
            value={form.phone}
            onChange={(e) => patch("phone", e.target.value)}
          />
          <span className="mt-1 block text-xs text-pos-ink-3">
            Obligatoire : sert à envoyer les confirmations de réservation par
            WhatsApp.
          </span>
        </label>
      </div>

      {/* Adresse structuree : gouvernorat -> delegation -> rue.
          L'adresse libre donnait « Hometna, Ba7dha sousse » : impossible de
          filtrer par zone, et le geocodage echouait. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wider text-pos-ink-3">
            Gouvernorat <span className="text-pos-danger">*</span>
          </span>
          <select
            required
            className="w-full rounded border border-pos-border bg-white px-3 py-2 text-sm text-pos-ink"
            value={form.governorate}
            onChange={(e) => {
              // Changer de gouvernorat vide la delegation : la garder
              // laisserait un couple incoherent que le serveur refuserait.
              setForm((f) => ({ ...f, governorate: e.target.value, city: "" }));
              setOk(false);
            }}
          >
            <option value="">Sélectionner un gouvernorat…</option>
            {nomsGouvernorats().map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wider text-pos-ink-3">
            Délégation <span className="text-pos-danger">*</span>
          </span>
          <select
            required
            disabled={!form.governorate}
            className="w-full rounded border border-pos-border bg-white px-3 py-2 text-sm text-pos-ink disabled:opacity-50"
            value={form.city}
            onChange={(e) => patch("city", e.target.value)}
          >
            <option value="">
              {form.governorate
                ? "Sélectionner une délégation…"
                : "Choisis d'abord un gouvernorat"}
            </option>
            {delegationsDe(form.governorate).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs uppercase tracking-wider text-pos-ink-3">
          Numéro et nom de rue <span className="text-pos-danger">*</span>
        </span>
        <input
          required
          placeholder="12 rue des Oliviers"
          className="w-full rounded border border-pos-border bg-white px-3 py-2 text-sm text-pos-ink placeholder:text-pos-ink-3"
          value={form.address}
          onChange={(e) => patch("address", e.target.value)}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs uppercase tracking-wider text-pos-ink-3">
          Matricule fiscal
        </span>
        <input
          className="w-full rounded border border-pos-border bg-white px-3 py-2 text-sm text-pos-ink"
          value={form.matriculeFiscal}
          onChange={(e) => patch("matriculeFiscal", e.target.value)}
        />
      </label>

      <div>
        <span className="mb-1 block text-xs uppercase tracking-wider text-pos-ink-3">
          Emplacement sur la carte
        </span>
        <LocationPicker
          lat={form.lat}
          lng={form.lng}
          address={form.address}
          city={form.city}
          governorate={form.governorate}
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
        <p className="mb-2 text-xs text-pos-ink-3">
          Jusqu&apos;à {PHOTOS_MAX_SALON} photos. La première s&apos;affiche en
          bandeau sur votre fiche, les autres en galerie.
        </p>
        <ImageUpload
          images={form.photos}
          onChange={(photos) => patch("photos", photos)}
          onUploadingChange={setUploading}
          max={PHOTOS_MAX_SALON}
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
          disabled={busy || uploading || footerTrop || !form.salonName.trim() || !form.phone.trim() || !form.governorate || !form.city.trim() || form.address.trim().length < 3}
          className="rounded bg-pos-ink px-4 py-2 text-sm font-medium text-pos-bg disabled:opacity-50"
        >
          {uploading ? "Upload en cours…" : busy ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}
