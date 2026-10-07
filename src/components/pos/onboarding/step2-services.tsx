"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, ImagePlus } from "lucide-react";
import { SERVICE_PRESETS, type ServicePreset } from "@/lib/onboarding-presets";
import type { Provider } from "./types";

type Line = {
  title: string;
  durationMinutes: number;
  price: string;
  photoUrl: string | null;
  selected: boolean;
  custom: boolean;
};

function readSalonTypes(providerId: string, fallback: string): string[] {
  try {
    const raw = localStorage.getItem(`onboarding.salonTypes.${providerId}`);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length > 0) return arr;
    }
  } catch {}
  return [fallback];
}

export function Step2Services({
  provider,
  onAdded,
  onNext,
  onBack,
}: {
  provider: Provider;
  onAdded: (p: Partial<Provider>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingFor, setUploadingFor] = useState<number | null>(null);

  // Build the preset list by merging all chosen salon types.
  const mergedPresets = useMemo<ServicePreset[]>(() => {
    const fallback = provider.category ?? "AUTRE";
    const types = readSalonTypes(provider.id, fallback);
    const seen = new Set<string>();
    const out: ServicePreset[] = [];
    for (const t of types) {
      const list = SERVICE_PRESETS[t] ?? [];
      for (const p of list) {
        const key = p.title.toLowerCase().trim();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(p);
      }
    }
    return out;
  }, [provider.id, provider.category]);

  useEffect(() => {
    setLines(
      mergedPresets.map((p) => ({
        title: p.title,
        durationMinutes: p.durationMinutes,
        price: p.price,
        photoUrl: null,
        selected: true,
        custom: false,
      })),
    );
  }, [mergedPresets]);

  function update(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addCustom() {
    setLines((prev) => [
      ...prev,
      {
        title: "",
        durationMinutes: 30,
        price: "20.000",
        photoUrl: null,
        selected: true,
        custom: true,
      },
    ]);
  }
  function remove(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function uploadPhoto(i: number, file: File) {
    setUploadingFor(i);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) update(i, { photoUrl: data.url ?? data.path ?? null });
    } finally {
      setUploadingFor(null);
    }
  }

  const selectedCount = lines.filter((l) => l.selected && l.title.trim()).length;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const services = lines
        .filter((l) => l.selected && l.title.trim())
        .map((l) => ({
          title: l.title.trim(),
          durationMinutes: l.durationMinutes,
          price: l.price,
          photoUrl: l.photoUrl,
        }));
      const res = await fetch("/api/pos/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step2: { services } }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Erreur lors de la sauvegarde");
        return;
      }
      onAdded({ _count: { ...provider._count, offers: services.length } });
      onNext();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/*
        La consigne et le decompte, cote a cote. Voir « 6 services
        selectionnes » evoluer en cochant rassure plus qu'un bouton qui
        s'active en silence tout en bas de l'ecran.
      */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm text-brand-ink">
          Coche ce que tu proposes.{" "}
          <span className="text-brand-ink-soft">La photo est facultative.</span>
        </p>
        <p className="pos-mono text-sm font-semibold text-pos-accent">
          {selectedCount} sélectionné{selectedCount > 1 ? "s" : ""}
        </p>
      </div>

      {/*
        DEUX LIGNES, et non une seule.
        -------------------------------------------------------------------
        Tout tenait auparavant sur une rangee horizontale : case, photo, nom,
        duree, prix, unites. Les champs de duree et de prix ont une largeur
        FIXE ; le nom, lui, etait `flex-1 min-w-0`. Sur un telephone, il se
        laissait donc ecraser jusqu'a zero et le salon ne voyait plus QUE des
        chiffres — impossible de savoir ce qu'il cochait.

        Le nom occupe desormais sa propre ligne, en pleine largeur. Duree et
        prix passent dessous, ou ils ont la place de respirer.
      */}
      <div className="space-y-2">
        {lines.map((l, i) => (
          <div
            key={i}
            className={`rounded-xl border p-3 transition ${
              l.selected
                ? "border-pos-accent/40 bg-pos-accent/5"
                : "border-brand-line bg-white opacity-60"
            }`}
          >
            {/* Ligne 1 : ce qu'on coche, et ce que ca s'appelle. */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={l.selected}
                onChange={(e) => update(i, { selected: e.target.checked })}
                // 20px et non 16 : une case se vise au pouce sur un
                // telephone, c'est le geste principal de cet ecran.
                className="h-5 w-5 shrink-0 accent-pos-accent"
                aria-label={l.title || "Service"}
              />

              <PhotoCell
                photoUrl={l.photoUrl}
                uploading={uploadingFor === i}
                disabled={!l.selected}
                onUpload={(file) => uploadPhoto(i, file)}
                onClear={() => update(i, { photoUrl: null })}
              />

              <input
                type="text"
                value={l.title}
                onChange={(e) => update(i, { title: e.target.value })}
                placeholder={l.custom ? "Nom du service…" : ""}
                disabled={!l.selected}
                // `text-base` : en dessous de 16px, Safari iOS ZOOME sur le
                // champ au premier appui et deforme toute la page.
                className="min-w-0 flex-1 bg-transparent text-base font-semibold text-brand-ink focus:outline-none disabled:opacity-60"
              />

              {l.custom && (
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="shrink-0 p-1 text-brand-ink-soft hover:text-pos-danger"
                  aria-label={`Supprimer ${l.title || "ce service"}`}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            {/* Ligne 2 : les chiffres, alignes sous le nom. */}
            <div className="mt-2.5 flex items-center gap-2 pl-8">
              <label className="flex items-center gap-1.5">
                <span className="sr-only">Durée en minutes</span>
                <input
                  type="number"
                  value={l.durationMinutes}
                  onChange={(e) =>
                    update(i, { durationMinutes: Number(e.target.value) || 0 })
                  }
                  disabled={!l.selected}
                  min={5}
                  max={300}
                  step={5}
                  className="pos-mono w-16 rounded-lg border border-brand-line bg-white px-2 py-1.5 text-center text-base disabled:opacity-60"
                />
                <span className="text-xs text-brand-ink-soft">min</span>
              </label>

              <label className="flex flex-1 items-center justify-end gap-1.5">
                <span className="sr-only">Prix en dinars</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={l.price}
                  onChange={(e) => update(i, { price: e.target.value })}
                  disabled={!l.selected}
                  className="pos-mono w-24 rounded-lg border border-brand-line bg-white px-2 py-1.5 text-right text-base disabled:opacity-60"
                />
                <span className="text-xs text-brand-ink-soft">TND</span>
              </label>
            </div>
          </div>
        ))}
      </div>

      {/* Cible de 44px, et borde : un lien textuel de 14px se rate au pouce. */}
      <button
        type="button"
        onClick={addCustom}
        className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-dashed border-pos-accent/50 px-4 text-sm font-semibold text-pos-accent hover:bg-pos-accent/5 sm:w-auto"
      >
        <Plus size={16} /> Ajouter un service
      </button>

      {error && (
        <div className="text-sm text-pos-danger bg-pos-danger-soft border border-pos-danger rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/*
        Sur telephone, le bouton principal passe en PLEINE LARGEUR et au-dessus
        du retour : c'est l'action qu'on cherche, elle doit tomber sous le
        pouce. Sur grand ecran, la disposition d'origine reprend sa place.
      */}
      <div className="flex flex-col-reverse gap-3 border-t border-brand-line pt-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="py-2 text-sm text-brand-ink-soft hover:text-brand-ink"
        >
          ← Retour
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy || selectedCount === 0}
          className="w-full rounded-xl bg-pos-accent px-8 py-3.5 text-base font-semibold text-white hover:bg-pos-accent/90 disabled:opacity-50 sm:w-auto"
        >
          {busy
            ? "Enregistrement…"
            : selectedCount === 0
              ? "Coche au moins un service"
              : `Continuer avec ${selectedCount} service${selectedCount > 1 ? "s" : ""} →`}
        </button>
      </div>
    </div>
  );
}

function PhotoCell({
  photoUrl,
  uploading,
  disabled,
  onUpload,
  onClear,
}: {
  photoUrl: string | null;
  uploading: boolean;
  disabled: boolean;
  onUpload: (file: File) => void;
  onClear: () => void;
}) {
  return (
    <label
      className={`relative w-10 h-10 rounded-lg overflow-hidden border border-brand-line bg-brand-cream/50 flex items-center justify-center shrink-0 ${
        disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:border-pos-accent"
      }`}
      aria-label="Image du service"
    >
      {photoUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt="" className="w-full h-full object-cover" />
          {!disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onClear();
              }}
              className="absolute top-0 right-0 w-4 h-4 bg-black/60 text-white text-[10px] leading-none flex items-center justify-center"
              aria-label="Retirer"
            >
              ×
            </button>
          )}
        </>
      ) : uploading ? (
        <span className="text-[9px] text-brand-ink-soft">…</span>
      ) : (
        <ImagePlus size={14} className="text-brand-ink-soft" />
      )}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          e.target.value = "";
        }}
        className="hidden"
      />
    </label>
  );
}
