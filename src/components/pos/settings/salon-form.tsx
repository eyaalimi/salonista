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
  vatRegistered: boolean;
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
    vatRegistered: initial.vatRegistered,
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

  const footerTrop = form.receiptFooter.length > FOOTER_MAX;

  /**
   * Les champs obligatoires encore vides, nommes pour l'ecran.
   *
   * La meme condition vivait en double — dans `save()` et sur le `disabled`
   * du bouton — et se contentait de griser sans dire quoi remplir. Les
   * obligatoires sont eparpilles sur toute la page : le salon ne pouvait pas
   * deviner lequel manquait.
   */
  const champsManquants = [
    !form.salonName.trim() && "le nom du salon",
    // Le telephone porte les confirmations WhatsApp.
    !form.phone.trim() && "le téléphone",
    !form.governorate && "le gouvernorat",
    !form.city.trim() && "la délégation",
    form.address.trim().length < 3 && "la rue",
    form.vatRegistered && !form.matriculeFiscal.trim() && "le matricule fiscal",
  ].filter((x): x is string => typeof x === "string");

  async function save() {
    if (busy || uploading || footerTrop || champsManquants.length > 0) return;
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
          vatRegistered: form.vatRegistered,
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

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-[var(--radius-card)] bg-pos-danger-soft px-4 py-3 text-sm text-pos-danger">{error}</div>
      )}
      {ok && (
        <div className="rounded-[var(--radius-card)] bg-pos-accent-soft px-4 py-3 text-sm text-pos-accent">
          Profil enregistré.
        </div>
      )}

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-pos-ink">
          Nom du salon
        </span>
        <input
          className="ds-focus min-h-[48px] w-full rounded-[var(--radius-pill)] border border-pos-border bg-white px-4 text-base text-pos-ink"
          value={form.salonName}
          onChange={(e) => patch("salonName", e.target.value)}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-pos-ink">
            Catégorie
          </span>
          <select
            className="ds-focus min-h-[48px] w-full rounded-[var(--radius-pill)] border border-pos-border bg-white px-4 text-base text-pos-ink"
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
          <span className="mb-1 block text-sm font-medium text-pos-ink">
            Téléphone <span className="text-pos-danger">*</span>
          </span>
          <input
            type="tel"
            inputMode="tel"
            required
            placeholder="20 123 456"
            className="ds-focus min-h-[48px] w-full rounded-[var(--radius-pill)] border border-pos-border bg-white px-4 text-base text-pos-ink placeholder:text-pos-ink-3"
            value={form.phone}
            onChange={(e) => patch("phone", e.target.value)}
          />
          <span className="mt-1 block text-sm text-pos-ink-3">
            Obligatoire : sert à envoyer les confirmations de réservation par
            WhatsApp.
          </span>
        </label>
      </div>

      {/* Adresse structuree : gouvernorat -> delegation -> rue.
          L'adresse libre donnait « Hometna, Ba7dha sousse » : impossible de
          filtrer par zone, et le geocodage echouait. */}
      <h3 className="border-t border-pos-border pt-5 text-base font-semibold text-pos-ink">
        Où se trouve ton salon
      </h3>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-pos-ink">
            Gouvernorat <span className="text-pos-danger">*</span>
          </span>
          <select
            required
            className="ds-focus min-h-[48px] w-full rounded-[var(--radius-pill)] border border-pos-border bg-white px-4 text-base text-pos-ink"
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
          <span className="mb-1 block text-sm font-medium text-pos-ink">
            Délégation <span className="text-pos-danger">*</span>
          </span>
          <select
            required
            disabled={!form.governorate}
            className="ds-focus min-h-[48px] w-full rounded-[var(--radius-pill)] border border-pos-border bg-white px-4 text-base text-pos-ink disabled:opacity-50"
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
        <span className="mb-1 block text-sm font-medium text-pos-ink">
          Numéro et nom de rue <span className="text-pos-danger">*</span>
        </span>
        <input
          required
          placeholder="12 rue des Oliviers"
          className="ds-focus min-h-[48px] w-full rounded-[var(--radius-pill)] border border-pos-border bg-white px-4 text-base text-pos-ink placeholder:text-pos-ink-3"
          value={form.address}
          onChange={(e) => patch("address", e.target.value)}
        />
      </label>

      {/* Regime de TVA. « Non » par defaut : la majorite des salons
          tunisiens ne sont pas assujettis, et ils devaient jusqu'ici passer
          chaque service a 0 % a la main. */}
      <div className="rounded-[var(--radius-card)] border border-pos-border p-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={form.vatRegistered}
            onChange={(e) => patch("vatRegistered", e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-pos-accent"
          />
          <span>
            <span className="block text-sm font-medium text-pos-ink">
              Mon salon est assujetti à la TVA
            </span>
            <span className="mt-0.5 block text-sm text-pos-ink-3">
              {form.vatRegistered
                ? "Tes services et produits porteront un taux de TVA."
                : "Aucune TVA ne sera appliquée ni affichée. C'est le cas de la plupart des salons."}
            </span>
          </span>
        </label>

        {/* Le matricule ne s'affiche que s'il sert : c'est la mention qui
            rend une facture valable, sans objet pour un non-assujetti. */}
        {form.vatRegistered && (
          <label className="mt-3 block">
            <span className="mb-1 block text-sm font-medium text-pos-ink">
              Matricule fiscal <span className="text-pos-danger">*</span>
            </span>
            <input
              required
              placeholder="1234567/A/M/000"
              className="ds-focus min-h-[48px] w-full rounded-[var(--radius-pill)] border border-pos-border bg-white px-4 text-base text-pos-ink placeholder:text-pos-ink-3"
              value={form.matriculeFiscal}
              onChange={(e) => patch("matriculeFiscal", e.target.value)}
            />
          </label>
        )}
      </div>

      <div>
        <span className="mb-1 block text-sm font-medium text-pos-ink">
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

      <h3 className="border-t border-pos-border pt-5 text-base font-semibold text-pos-ink">
        Ta vitrine
      </h3>
      <p className="-mt-3 text-sm text-pos-ink-3">
        Ce que voient tes clientes sur ta page publique.
      </p>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-pos-ink">
          Description
        </span>
        <textarea
          rows={3}
          className="ds-focus min-h-[48px] w-full rounded-[var(--radius-pill)] border border-pos-border bg-white px-4 text-base text-pos-ink"
          value={form.description}
          onChange={(e) => patch("description", e.target.value)}
        />
      </label>

      <div>
        <span className="mb-1 block text-sm font-medium text-pos-ink">
          Logo du salon
        </span>
        <p className="mb-2 text-sm text-pos-ink-3">
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
        <span className="mb-1 block text-sm font-medium text-pos-ink">
          Photos du salon
        </span>
        <p className="mb-2 text-sm text-pos-ink-3">
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

      <h3 className="border-t border-pos-border pt-5 text-base font-semibold text-pos-ink">
        Ticket de caisse
      </h3>

      <label className="block">
        <span className="mb-1 flex items-center justify-between text-sm font-medium text-pos-ink">
          <span>Pied de ticket</span>
          <span
            className={footerTrop ? "text-pos-danger" : "font-normal text-pos-ink-3"}
          >
            {form.receiptFooter.length}/{FOOTER_MAX}
          </span>
        </span>
        <input
          className="ds-focus min-h-[48px] w-full rounded-[var(--radius-pill)] border border-pos-border bg-white px-4 text-base text-pos-ink"
          placeholder="Merci de votre visite !"
          value={form.receiptFooter}
          onChange={(e) => patch("receiptFooter", e.target.value)}
        />
      </label>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-pos-border pt-4">
        {/* Le bouton restait gris sans qu'on sache quel champ manquait : la
            liste des obligatoires est longue et ils sont eparpilles. */}
        {champsManquants.length > 0 && (
          <p className="text-sm text-pos-ink-3">
            À compléter : {champsManquants.join(", ")}.
          </p>
        )}
        <button
          type="button"
          onClick={save}
          disabled={busy || uploading || footerTrop || champsManquants.length > 0}
          className="ds-press ds-focus min-h-[48px] rounded-[var(--radius-pill)] bg-pos-accent px-6 text-base font-medium text-white disabled:opacity-50"
        >
          {uploading ? "Envoi de l'image…" : busy ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}
