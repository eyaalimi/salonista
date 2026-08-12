"use client";

import { useCallback, useEffect, useState } from "react";
import { X, ChevronDown, ChevronRight } from "lucide-react";
import { ImageUpload } from "@/components/image-upload";

/** Forme minimale renvoyee par GET /api/offers/[id] et attendue par la liste. */
export type ServiceOffer = {
  id: string;
  title: string;
  description: string | null;
  discountPrice: string;
  originalPrice: string | null;
  category: string | null;
  durationMinutes: number;
  taxRate: string;
  active: boolean;
  publishedToMarketplace: boolean;
  photos: string[];
};

const ALLOWED_DURATIONS = [15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240];

const CATEGORIES = [
  { value: "COIFFURE", label: "Coiffure" },
  { value: "ESTHETIQUE", label: "Esthétique" },
  { value: "ONGLERIE", label: "Onglerie" },
  { value: "MASSAGE", label: "Massage" },
  { value: "PARFUMERIE", label: "Parfumerie" },
  { value: "AUTRE", label: "Autre" },
];

const TAX_PRESETS = [0, 7, 13, 19];

type FormState = {
  title: string;
  description: string;
  discountPrice: string;
  originalPrice: string;
  category: string;
  durationMinutes: number;
  taxRate: number;
  active: boolean;
  publishedToMarketplace: boolean;
  photos: string[];
};

export function ServiceEditDrawer({
  offerId,
  onClose,
  onSaved,
}: {
  offerId: string;
  onClose: () => void;
  onSaved: (updated: ServiceOffer) => void;
}) {
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showVitrine, setShowVitrine] = useState(false);

  // Chargement autonome : le drawer doit pouvoir s'ouvrir sur une URL collee,
  // sans que la liste ait ete hydratee au prealable.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/offers/${offerId}`);
        if (cancelled) return;
        if (!res.ok) {
          setError(
            res.status === 404 ? "Service introuvable." : "Impossible de charger le service.",
          );
          return;
        }
        const o = (await res.json()) as ServiceOffer;
        if (cancelled) return;
        setForm({
          title: o.title,
          description: o.description ?? "",
          discountPrice: String(o.discountPrice),
          originalPrice: o.originalPrice == null ? "" : String(o.originalPrice),
          category: o.category ?? "AUTRE",
          durationMinutes: o.durationMinutes,
          taxRate: Number(o.taxRate),
          active: o.active,
          publishedToMarketplace: o.publishedToMarketplace,
          photos: o.photos ?? [],
        });
        // La vitrine s'ouvre d'office quand il reste du travail : sans photo,
        // le service est marque en ligne mais filtre du feed.
        setShowVitrine((o.photos ?? []).length === 0);
      } catch {
        if (!cancelled) setError("Erreur réseau.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [offerId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const patch = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) =>
      setForm((f) => (f ? { ...f, [key]: value } : f)),
    [],
  );

  const hasPhoto = (form?.photos.length ?? 0) > 0;

  /**
   * Corps PUT complet a partir de l'etat du formulaire.
   *
   * `override` permet de forcer un champ (la desactivation force
   * `active: false`) tout en emportant le reste des saisies en cours. Sans ca,
   * un PUT partiel { active: false } ferait relire a l'API les valeurs encore
   * en base : une caissiere qui corrige un prix puis clique "Desactiver"
   * verrait sa correction disparaitre sans le moindre message.
   */
  function buildPayload(f: FormState, override?: Partial<FormState>) {
    const merged = { ...f, ...override };
    return {
      title: merged.title.trim(),
      description: merged.description.trim() || null,
      discountPrice: merged.discountPrice,
      // Prix barre facultatif : chaine vide => null, pas 0.
      originalPrice: merged.originalPrice.trim() === "" ? null : merged.originalPrice,
      category: merged.category,
      durationMinutes: merged.durationMinutes,
      taxRate: merged.taxRate,
      active: merged.active,
      publishedToMarketplace: merged.publishedToMarketplace,
      photos: merged.photos,
    };
  }

  async function submit(override: Partial<FormState> | undefined, echec: string) {
    if (!form || busy || uploading) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/offers/${offerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(form, override)),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? echec);
        return;
      }
      onSaved({ ...json, photos: json.photos ?? [] } as ServiceOffer);
    } catch {
      setError("Erreur réseau.");
    } finally {
      setBusy(false);
    }
  }

  const save = () => submit(undefined, "Enregistrement impossible.");

  const deactivate = () => submit({ active: false }, "Désactivation impossible.");

  const statut = !form
    ? null
    : form.publishedToMarketplace && hasPhoto
      ? { label: "En ligne", cls: "bg-green-50 text-green-800" }
      : form.publishedToMarketplace
        ? { label: "Incomplet", cls: "bg-amber-50 text-amber-800" }
        : { label: "Hors ligne", cls: "bg-pos-border text-pos-ink-2" };

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/30"
        aria-hidden="true"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Modifier le service"
        className="fixed top-0 right-0 z-50 h-full w-full max-w-[480px] bg-pos-surface shadow-2xl overflow-y-auto flex flex-col"
        data-pos-theme
      >
        <div className="sticky top-0 z-10 bg-pos-surface border-b border-pos-border px-5 py-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-pos-ink">Modifier le service</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-full border border-pos-border text-pos-ink-2 hover:bg-pos-highlight"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <p className="p-5 text-sm text-pos-ink-3">Chargement…</p>
        ) : !form ? (
          <p className="p-5 text-sm text-red-600">{error ?? "Erreur"}</p>
        ) : (
          <>
            <div className="flex-1 p-5 space-y-5">
              {error && (
                <div className="px-3 py-2 rounded bg-red-50 text-red-800 text-sm">{error}</div>
              )}

              {/* ---- Section essentiel : ce qu'une caissiere corrige au quotidien ---- */}
              <label className="block">
                <span className="block text-xs uppercase tracking-wider text-pos-ink-3 mb-1">
                  Nom du service
                </span>
                <input
                  className="w-full px-3 py-2 rounded border border-pos-border bg-white text-sm"
                  value={form.title}
                  onChange={(e) => patch("title", e.target.value)}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-xs uppercase tracking-wider text-pos-ink-3 mb-1">
                    Prix (DT)
                  </span>
                  <input
                    type="number"
                    step="0.001"
                    className="w-full px-3 py-2 rounded border border-pos-border bg-white text-sm"
                    value={form.discountPrice}
                    onChange={(e) => patch("discountPrice", e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="block text-xs uppercase tracking-wider text-pos-ink-3 mb-1">
                    Durée
                  </span>
                  <select
                    className="w-full px-3 py-2 rounded border border-pos-border bg-white text-sm"
                    value={form.durationMinutes}
                    onChange={(e) => patch("durationMinutes", Number(e.target.value))}
                  >
                    {ALLOWED_DURATIONS.map((d) => (
                      <option key={d} value={d}>
                        {d} min
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3 items-end">
                <label className="block">
                  <span className="block text-xs uppercase tracking-wider text-pos-ink-3 mb-1">
                    TVA
                  </span>
                  <select
                    className="w-full px-3 py-2 rounded border border-pos-border bg-white text-sm"
                    value={form.taxRate}
                    onChange={(e) => patch("taxRate", Number(e.target.value))}
                  >
                    {TAX_PRESETS.map((t) => (
                      <option key={t} value={t}>
                        {t === 0 ? "Sans TVA" : `${t} %`}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 px-3 py-2 rounded border border-pos-border bg-white text-sm">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => patch("active", e.target.checked)}
                  />
                  <span>Actif en caisse</span>
                </label>
              </div>

              {/* ---- Section vitrine : repliee sauf s'il reste du travail ---- */}
              <div className="border-t border-pos-border pt-4">
                <button
                  type="button"
                  onClick={() => setShowVitrine((v) => !v)}
                  className="w-full flex items-center justify-between gap-2 text-left"
                  aria-expanded={showVitrine}
                >
                  <span className="flex items-center gap-1 text-xs uppercase tracking-wider text-pos-ink-3">
                    {showVitrine ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    Vitrine en ligne
                  </span>
                  {statut && (
                    <span className={`rounded px-2 py-0.5 text-xs ${statut.cls}`}>
                      {statut.label}
                    </span>
                  )}
                </button>

                {showVitrine && (
                  <div className="mt-4 space-y-4">
                    <div>
                      <span className="block text-xs uppercase tracking-wider text-pos-ink-3 mb-1">
                        Photos
                      </span>
                      <ImageUpload
                        images={form.photos}
                        onChange={(photos) => patch("photos", photos)}
                        onUploadingChange={setUploading}
                        max={5}
                      />
                      {!hasPhoto && (
                        <p className="mt-2 text-xs text-amber-700">
                          Une photo est nécessaire pour apparaître sur salonista.tn.
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">
                        <span className="block text-xs uppercase tracking-wider text-pos-ink-3 mb-1">
                          Catégorie
                        </span>
                        <select
                          className="w-full px-3 py-2 rounded border border-pos-border bg-white text-sm"
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
                        <span className="block text-xs uppercase tracking-wider text-pos-ink-3 mb-1">
                          Prix barré
                        </span>
                        <input
                          type="number"
                          step="0.001"
                          placeholder="facultatif"
                          className="w-full px-3 py-2 rounded border border-pos-border bg-white text-sm"
                          value={form.originalPrice}
                          onChange={(e) => patch("originalPrice", e.target.value)}
                        />
                      </label>
                    </div>

                    <label className="block">
                      <span className="block text-xs uppercase tracking-wider text-pos-ink-3 mb-1">
                        Description
                      </span>
                      <textarea
                        rows={3}
                        className="w-full px-3 py-2 rounded border border-pos-border bg-white text-sm"
                        value={form.description}
                        onChange={(e) => patch("description", e.target.value)}
                      />
                    </label>

                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={form.publishedToMarketplace}
                        disabled={!hasPhoto}
                        onChange={(e) => patch("publishedToMarketplace", e.target.checked)}
                      />
                      <span className={hasPhoto ? "text-pos-ink" : "text-pos-ink-3"}>
                        Publier sur salonista.tn
                        {!hasPhoto && (
                          <span className="block text-xs text-pos-ink-3">
                            Ajoutez une photo pour publier.
                          </span>
                        )}
                      </span>
                    </label>
                  </div>
                )}
              </div>
            </div>

            <div className="sticky bottom-0 bg-pos-surface border-t border-pos-border px-5 py-4 flex items-center justify-between gap-3">
              {form.active ? (
                <button
                  type="button"
                  onClick={deactivate}
                  disabled={busy}
                  className="text-sm text-pos-ink-3 underline underline-offset-2 hover:text-pos-ink disabled:opacity-50"
                >
                  Désactiver ce service
                </button>
              ) : (
                <span className="text-xs text-pos-ink-3">Service désactivé</span>
              )}
              <button
                type="button"
                onClick={save}
                disabled={busy || uploading || !form.title.trim()}
                className="px-4 py-2 rounded bg-pos-ink text-pos-bg text-sm font-medium disabled:opacity-50"
              >
                {uploading ? "Upload en cours…" : busy ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
