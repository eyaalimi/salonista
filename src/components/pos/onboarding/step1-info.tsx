"use client";

import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { SALON_TYPES } from "@/lib/onboarding-presets";
import { delegationsDe, nomsGouvernorats } from "@/lib/tunisie-geo";
import {
  basculerType,
  choisirPrincipale,
  choixInitial,
  refusLocalisationInscription,
  typesOrdonnes,
  type ChoixTypes,
} from "@/lib/inscription-salon";
import type { Provider } from "./types";

export function Step1Info({
  provider,
  onSaved,
  onNext,
}: {
  provider: Provider;
  onSaved: (p: Partial<Provider>) => void;
  onNext: () => void;
}) {
  const [salonName, setSalonName] = useState(provider.salonName ?? "");
  const [phone, setPhone] = useState(provider.phone ?? "");
  const [address, setAddress] = useState(provider.address ?? "");
  // `city` porte la DELEGATION, comme dans le profil. On ne reprend la valeur
  // enregistree que si elle forme un couple valide : une ancienne « ville »
  // tapee librement ne doit pas preselectionner une delegation fausse.
  const [governorate, setGovernorate] = useState(provider.governorate ?? "");
  const [city, setCity] = useState(
    refusLocalisationInscription(provider.governorate, provider.city) === null
      ? (provider.city ?? "")
      : "",
  );
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  /*
   * Plusieurs types possibles, UNE principale — celle que le profil affichera
   * comme categorie. Avant, le premier type CLIQUE devenait la categorie sans
   * que rien ne le dise a l'ecran. La categorie enregistree fait foi a la
   * reouverture (voir `choixInitial`).
   */
  // Reprend la categorie ENREGISTREE, qui fait foi : si la gerante l'a
  // changee dans son profil, l'assistant la reflete. Les types secondaires ne
  // sont pas restaures a la reouverture — comme avant ce lot.
  const [choix, setChoix] = useState<ChoixTypes>(() =>
    choixInitial(provider.category, []),
  );
  const types = choix.types;
  const [matriculeFiscal, setMatriculeFiscal] = useState(
    provider.matriculeFiscal ?? "",
  );
  const [showMF, setShowMF] = useState(!!provider.matriculeFiscal);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const lieuValide = refusLocalisationInscription(governorate, city) === null;

  const canContinue =
    salonName.trim().length >= 2 &&
    phone.trim().length >= 6 &&
    types.length > 0 &&
    lieuValide;

  function toggleType(value: string) {
    setChoix((c) => basculerType(c, value));
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Impossible d'uploader l'image");
        return;
      }
      setLogoUrl(data.url ?? data.path ?? null);
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      // Persist the multi-type list locally so step 2 + 3 can merge presets.
      try {
        // La principale EN TETE : l'etape 2 pre-remplit d'abord ses services.
        localStorage.setItem(
          `onboarding.salonTypes.${provider.id}`,
          JSON.stringify(typesOrdonnes(choix)),
        );
      } catch {}
      const res = await fetch("/api/pos/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step1: {
            salonName: salonName.trim(),
            phone: phone.trim(),
            address: address.trim(),
            city,
            governorate,
            category: choix.principale ?? undefined,
            matriculeFiscal: matriculeFiscal.trim() || undefined,
            logoUrl: logoUrl ?? undefined,
          },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Erreur lors de la sauvegarde");
        return;
      }
      onSaved({
        salonName: salonName.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        city: city || null,
        governorate: governorate || null,
        category: choix.principale ?? undefined,
        matriculeFiscal: matriculeFiscal.trim() || null,
      });
      onNext();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Logo upload */}
      <div>
        <Label>Logo</Label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-20 h-20 rounded-xl border-2 border-dashed border-brand-line bg-brand-cream/40 hover:border-pos-accent hover:bg-pos-accent/5 flex items-center justify-center overflow-hidden shrink-0 disabled:opacity-50"
            aria-label="Téléverser un logo"
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <Upload size={20} className="text-brand-ink-soft" />
            )}
          </button>
          <div className="text-xs text-brand-ink-soft">
            {logoUrl ? (
              <button
                type="button"
                onClick={() => setLogoUrl(null)}
                className="inline-flex items-center gap-1 text-brand-ink-soft hover:text-pos-danger"
              >
                <X size={12} /> Retirer
              </button>
            ) : (
              <>Facultatif · JPG/PNG · ≤ 5 Mo</>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={handleLogoChange}
            className="hidden"
          />
        </div>
      </div>

      <div>
        <Label>Nom du salon *</Label>
        <input
          type="text"
          value={salonName}
          onChange={(e) => setSalonName(e.target.value)}
          placeholder="Salon Fatma"
          className={inputCls}
        />
      </div>

      {/* Multi-select type grid with emojis, minimal text */}
      <div>
        <Label>Types de prestations * (plusieurs possibles)</Label>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {SALON_TYPES.map((t) => {
            const selected = types.includes(t.value);
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => toggleType(t.value)}
                className={`flex flex-col items-center justify-center gap-1 aspect-square rounded-xl border-2 transition ${
                  selected
                    ? "border-pos-accent bg-pos-accent/10"
                    : "border-brand-line bg-white hover:border-pos-accent/50"
                }`}
              >
                <span className="text-2xl leading-none">{t.emoji}</span>
                <span
                  className={`text-[11px] font-medium ${selected ? "text-pos-accent" : "text-brand-ink-soft"}`}
                >
                  {t.label}
                </span>
                {choix.principale === t.value && types.length > 1 && (
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-pos-accent">
                    ★ Principale
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/*
          LA CATEGORIE PRINCIPALE, rendue visible.

          Le profil n'a qu'UNE categorie. Avant, c'etait le premier type
          clique, sans que rien ne le dise : une gerante qui cochait Onglerie
          puis Coiffure decouvrait « Onglerie » dans son profil sans
          comprendre pourquoi. N'apparait qu'a partir de deux types — avec un
          seul, il n'y a rien a choisir.
        */}
        {types.length > 1 && (
          <div className="mt-3">
            <p className="text-[11px] text-brand-ink-soft">
              Catégorie principale (affichée sur votre profil) :
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {typesOrdonnes(choix).map((v) => {
                const t = SALON_TYPES.find((x) => x.value === v);
                const actif = choix.principale === v;
                return (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={actif}
                    onClick={() => setChoix((c) => choisirPrincipale(c, v))}
                    className={`min-h-[36px] rounded-full border px-3 text-xs font-medium ${
                      actif
                        ? "border-pos-accent bg-pos-accent text-white"
                        : "border-brand-line bg-white text-brand-ink-soft hover:border-pos-accent/50"
                    }`}
                  >
                    {t?.emoji} {t?.label ?? v}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div>
        <Label>Téléphone *</Label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="22 345 678"
          className={inputCls + " pos-mono"}
        />
      </div>

      {/*
        GOUVERNORAT -> DELEGATION, les memes listes que le profil.

        Remplace le champ « Ville » en texte libre : la gerante tapait
        « Tunis », que le profil lisait comme une delegation (ce n'en est pas
        une), sans gouvernorat. Elle devait tout ressaisir dans son profil.
      */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Gouvernorat *</Label>
          <select
            value={governorate}
            onChange={(e) => {
              // Changer de gouvernorat vide la delegation : la garder
              // produirait un couple qui n'existe pas.
              setGovernorate(e.target.value);
              setCity("");
            }}
            className={inputCls}
          >
            <option value="">Sélectionner…</option>
            {nomsGouvernorats().map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Délégation *</Label>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            disabled={!governorate}
            className={inputCls + " disabled:opacity-50"}
          >
            <option value="">
              {governorate ? "Sélectionner…" : "Choisissez d'abord un gouvernorat"}
            </option>
            {delegationsDe(governorate).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <Label>Numéro et nom de rue (facultatif)</Label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="12 rue de la Liberté"
          className={inputCls}
        />
      </div>

      {!showMF ? (
        <button
          type="button"
          onClick={() => setShowMF(true)}
          className="text-xs text-brand-ink-soft hover:text-brand-ink underline"
        >
          + Matricule fiscal
        </button>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <Label className="mb-0">Matricule fiscal</Label>
            <button
              type="button"
              onClick={() => {
                setShowMF(false);
                setMatriculeFiscal("");
              }}
              className="text-[11px] text-brand-ink-soft hover:text-brand-ink"
            >
              Masquer
            </button>
          </div>
          <input
            type="text"
            value={matriculeFiscal}
            onChange={(e) => setMatriculeFiscal(e.target.value)}
            placeholder="1234567/A/B/000"
            className={inputCls + " pos-mono"}
          />
        </div>
      )}

      {error && (
        <div className="text-sm text-pos-danger bg-pos-danger-soft border border-pos-danger rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={save}
          disabled={busy || !canContinue}
          className="px-8 py-3 rounded-xl bg-pos-accent text-white font-semibold hover:bg-pos-accent/90 disabled:opacity-50"
        >
          {busy ? "Sauvegarde…" : "Continuer →"}
        </button>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-brand-line bg-brand-cream/40 px-3 py-2.5 text-sm text-brand-ink placeholder:text-brand-ink-soft/60 focus:border-pos-accent focus:outline-none";

function Label({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      className={`block text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft mb-1.5 ${className}`}
    >
      {children}
    </label>
  );
}
