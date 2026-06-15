"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, ImagePlus } from "lucide-react";
import { SERVICE_PRESETS, type ServicePreset } from "@/lib/onboarding-presets";

type Provider = {
  id: string;
  category?: string;
  _count: { offers: number };
};

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
      <p className="text-xs text-brand-ink-soft">
        Cochez ce que vous proposez · 📸 image facultative
      </p>

      <div className="space-y-2">
        {lines.map((l, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 p-2 rounded-lg border transition ${
              l.selected
                ? "border-pos-accent/30 bg-pos-accent/5"
                : "border-brand-line bg-white opacity-60"
            }`}
          >
            <input
              type="checkbox"
              checked={l.selected}
              onChange={(e) => update(i, { selected: e.target.checked })}
              className="w-4 h-4 accent-pos-accent shrink-0"
            />

            {/* Photo thumbnail / upload button */}
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
              placeholder={l.custom ? "Nom…" : ""}
              disabled={!l.selected}
              className="flex-1 min-w-0 bg-transparent text-sm font-medium text-brand-ink focus:outline-none disabled:opacity-60"
            />
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
              className="w-14 text-xs text-center bg-white border border-brand-line rounded px-1 py-1 pos-mono disabled:opacity-60"
            />
            <span className="text-[10px] text-brand-ink-soft -ml-1">min</span>
            <input
              type="text"
              inputMode="decimal"
              value={l.price}
              onChange={(e) => update(i, { price: e.target.value })}
              disabled={!l.selected}
              className="w-20 text-xs text-right bg-white border border-brand-line rounded px-2 py-1 pos-mono disabled:opacity-60"
            />
            <span className="text-[10px] text-brand-ink-soft -ml-1">DT</span>
            {l.custom && (
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-brand-ink-soft hover:text-red-600 shrink-0"
                aria-label="Supprimer"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addCustom}
        className="inline-flex items-center gap-1.5 text-sm text-pos-accent hover:text-pos-accent/80 font-medium"
      >
        <Plus size={14} /> Ajouter un service
      </button>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-brand-line">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-brand-ink-soft hover:text-brand-ink"
        >
          ← Retour
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy || selectedCount === 0}
          className="px-8 py-3 rounded-xl bg-pos-accent text-white font-semibold hover:bg-pos-accent/90 disabled:opacity-50"
        >
          {busy ? "Sauvegarde…" : `Continuer (${selectedCount}) →`}
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
