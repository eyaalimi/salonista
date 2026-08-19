"use client";

import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { SALON_TYPES } from "@/lib/onboarding-presets";

type Provider = {
  id: string;
  salonName: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  category?: string;
  matriculeFiscal: string | null;
};

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
  const [city, setCity] = useState(provider.city ?? "");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  // Multi-selection: first entry is the primary Category enum.
  const [types, setTypes] = useState<string[]>(
    provider.category ? [provider.category] : [],
  );
  const [matriculeFiscal, setMatriculeFiscal] = useState(
    provider.matriculeFiscal ?? "",
  );
  const [showMF, setShowMF] = useState(!!provider.matriculeFiscal);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canContinue =
    salonName.trim().length >= 2 && phone.trim().length >= 6 && types.length > 0;

  function toggleType(value: string) {
    setTypes((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value],
    );
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
        localStorage.setItem(
          `onboarding.salonTypes.${provider.id}`,
          JSON.stringify(types),
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
            city: city.trim(),
            category: types[0], // primary
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
        city: city.trim() || null,
        category: types[0],
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
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
        <div>
          <Label>Ville</Label>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Tunis"
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <Label>Adresse</Label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Rue de la Liberté"
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
