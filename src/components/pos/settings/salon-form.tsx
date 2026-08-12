"use client";

import { useState } from "react";
import { ImageUpload } from "@/components/image-upload";

export type SalonProfile = {
  salonName: string;
  category: string;
  description: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  photos: string[];
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
    photos: initial.photos ?? [],
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
          photos: form.photos,
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
        <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}
      {ok && (
        <div className="rounded bg-green-50 px-3 py-2 text-sm text-green-800">
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
          <span className={footerTrop ? "text-red-600" : ""}>
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
