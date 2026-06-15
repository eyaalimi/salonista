"use client";

import { useState } from "react";
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
  const [category, setCategory] = useState(provider.category ?? "AUTRE");
  const [matriculeFiscal, setMatriculeFiscal] = useState(
    provider.matriculeFiscal ?? "",
  );
  const [showMF, setShowMF] = useState(!!provider.matriculeFiscal);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canContinue = salonName.trim().length >= 2 && phone.trim().length >= 6;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/pos/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step1: {
            salonName: salonName.trim(),
            phone: phone.trim(),
            address: address.trim(),
            city: city.trim(),
            category,
            matriculeFiscal: matriculeFiscal.trim() || undefined,
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
        category,
        matriculeFiscal: matriculeFiscal.trim() || null,
      });
      onNext();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <Label>Nom du salon *</Label>
        <input
          type="text"
          value={salonName}
          onChange={(e) => setSalonName(e.target.value)}
          placeholder="Ex: Salon Fatma"
          className={inputCls}
        />
      </div>

      <div>
        <Label>Type de salon *</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {SALON_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setCategory(t.value)}
              className={`text-left px-3 py-2.5 rounded-lg border transition ${
                category === t.value
                  ? "border-pos-accent bg-pos-accent/10 ring-2 ring-pos-accent/30"
                  : "border-brand-line bg-white hover:border-pos-accent/50"
              }`}
            >
              <div className="text-sm font-medium text-brand-ink">{t.label}</div>
              <div className="text-[10px] text-brand-ink-soft mt-0.5 leading-tight">
                {t.hint}
              </div>
            </button>
          ))}
        </div>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Adresse</Label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Rue, avenue…"
            className={inputCls}
          />
        </div>
        <div>
          <Label>Ville</Label>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Tunis, La Marsa…"
            className={inputCls}
          />
        </div>
      </div>

      {!showMF ? (
        <button
          type="button"
          onClick={() => setShowMF(true)}
          className="text-xs text-brand-ink-soft hover:text-brand-ink underline"
        >
          + Ajouter un matricule fiscal (facultatif)
        </button>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <Label className="mb-0">Matricule fiscal (facultatif)</Label>
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
            placeholder="Ex: 1234567/A/B/000"
            className={inputCls + " pos-mono"}
          />
          <p className="text-[11px] text-brand-ink-soft mt-1">
            Apparaîtra sur vos tickets et factures.
          </p>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
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
