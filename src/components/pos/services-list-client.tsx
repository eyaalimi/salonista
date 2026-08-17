"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ServiceEditDrawer, type ServiceOffer } from "@/components/pos/service-edit-drawer";

type Offer = {
  id: string;
  title: string;
  discountPrice: string;
  durationMinutes: number;
  taxRate: string;
  active: boolean;
  publishedToMarketplace: boolean;
  photos: string[];
};

const ALLOWED_DURATIONS = [15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240];

/**
 * Badge de statut marketplace a trois etats.
 *
 * Un service publie sans photo est cree mais masque du feed public (le filtre
 * photos.isEmpty s'en charge cote serveur) : le badge ambre signale au
 * prestataire ce qu'il lui reste a faire. Le clic ouvre le drawer d'edition
 * via ?edit=<id>.
 */
function StatusBadge({ offer, compact }: { offer: Offer; compact?: boolean }) {
  const published = offer.publishedToMarketplace;
  const hasPhoto = offer.photos.length > 0;

  if (published && hasPhoto) {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-green-50 px-2 py-0.5 text-xs text-green-800">
        En ligne
      </span>
    );
  }

  if (published && !hasPhoto) {
    return (
      <Link
        href={`/pos/services?edit=${offer.id}`}
        scroll={false}
        className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-800 hover:bg-amber-100"
      >
        {compact ? "Photo manquante" : "Ajouter une photo"}
      </Link>
    );
  }

  return (
    <Link
      href={`/pos/services?edit=${offer.id}`}
      scroll={false}
      className="inline-flex items-center gap-1 rounded bg-pos-border px-2 py-0.5 text-xs text-pos-ink-2 hover:bg-pos-border/70"
    >
      Hors ligne
    </Link>
  );
}

export function ServicesListClient({ initialOffers }: { initialOffers: Offer[] }) {
  const [offers, setOffers] = useState<Offer[]>(initialOffers);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const newNameRef = useRef<HTMLInputElement>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const openEdit = useCallback(
    (id: string) => router.push(`/pos/services?edit=${id}`, { scroll: false }),
    [router],
  );
  const closeEdit = useCallback(
    () => router.push("/pos/services", { scroll: false }),
    [router],
  );

  // Patch local plutot que rechargement : la caisse peut tenir une centaine
  // de services sur une tablette lente.
  const applySaved = useCallback(
    (u: ServiceOffer) => {
      setOffers((arr) =>
        arr.map((x) =>
          x.id === u.id
            ? {
                ...x,
                title: u.title,
                discountPrice: String(u.discountPrice),
                durationMinutes: u.durationMinutes,
                taxRate: String(u.taxRate),
                active: u.active,
                publishedToMarketplace: u.publishedToMarketplace,
                photos: u.photos ?? [],
              }
            : x,
        ),
      );
      closeEdit();
    },
    [closeEdit],
  );

  // Quick-add form state.
  const [qaTitle, setQaTitle] = useState("");
  const [qaPrice, setQaPrice] = useState("");
  const [qaDuration, setQaDuration] = useState(30);
  const [qaTaxOn, setQaTaxOn] = useState(true);
  const [qaTaxRate, setQaTaxRate] = useState(19);

  // N global shortcut focuses the quick-add Name field.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        e.key === "n" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        newNameRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const saveNew = useCallback(async () => {
    if (!qaTitle.trim() || !qaPrice || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: qaTitle.trim(),
          discountPrice: qaPrice,
          durationMinutes: qaDuration,
          taxRate: qaTaxOn ? qaTaxRate : 0,
          // publishedToMarketplace est volontairement omis : le serveur le
          // met a true par defaut. Le service part donc sur le feed, mais
          // reste masque tant qu'il n'a pas de photo — d'ou le badge ambre
          // "Ajouter une photo" dans la liste.
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erreur");
        return;
      }
      setOffers((o) =>
        [...o, { ...json, photos: json.photos ?? [] }].sort((a, b) =>
          a.title.localeCompare(b.title, "fr"),
        ),
      );
      setQaTitle("");
      setQaPrice("");
      newNameRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }, [qaTitle, qaPrice, qaDuration, qaTaxOn, qaTaxRate, busy]);

  async function toggleTax(o: Offer) {
    const isOn = Number(o.taxRate) > 0;
    const newRate = isOn ? 0 : 19;
    setToggling(o.id);
    setError(null);
    try {
      const res = await fetch(`/api/offers/${o.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taxRate: newRate }),
      });
      if (res.ok) {
        setOffers((arr) =>
          arr.map((x) => (x.id === o.id ? { ...x, taxRate: String(newRate) } : x))
        );
      } else {
        const j = await res.json().catch(() => null);
        setError(j?.error ?? "Impossible de modifier la TVA");
      }
    } finally {
      setToggling(null);
    }
  }

  async function toggleActive(o: Offer) {
    setToggling(o.id);
    setError(null);
    try {
      const res = await fetch(`/api/offers/${o.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !o.active }),
      });
      if (res.ok) {
        setOffers((arr) =>
          arr.map((x) => (x.id === o.id ? { ...x, active: !o.active } : x))
        );
      } else {
        const j = await res.json().catch(() => null);
        setError(j?.error ?? "Impossible de modifier le statut");
      }
    } finally {
      setToggling(null);
    }
  }

  return (
    <div className="h-full bg-pos-bg md:p-6 p-4 overflow-auto" data-pos-theme>
      <header className="flex items-center justify-between mb-4 md:mb-6 gap-3 flex-wrap">
        <h1 className="text-lg md:text-xl font-semibold text-pos-ink">Services</h1>
        <span className="hidden md:inline text-xs text-pos-ink-3">
          Raccourci : <kbd>N</kbd> pour un nouveau service
        </span>
      </header>

      {error && (
        <div className="mb-4 px-3 py-2 rounded bg-red-50 text-red-800 text-sm">
          {error}
        </div>
      )}

      {/* Quick-add form: stacked on mobile, 12-col grid on md+ */}
      <div className="mb-4 md:mb-2 p-3 rounded border-2 border-pos-border-strong bg-pos-surface md:grid md:grid-cols-12 md:gap-2 flex flex-col gap-2">
        <input
          ref={newNameRef}
          className="md:col-span-4 px-2 py-2 md:py-1 rounded border border-pos-border bg-white text-sm w-full"
          placeholder="Nom du service"
          value={qaTitle}
          onChange={(e) => setQaTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveNew();
            if (e.key === "Escape") {
              setQaTitle("");
              setQaPrice("");
            }
          }}
        />
        <div className="md:col-span-8 md:contents grid grid-cols-2 gap-2">
          <input
            className="md:col-span-2 px-2 py-2 md:py-1 rounded border border-pos-border bg-white text-sm w-full"
            type="number"
            step="0.001"
            placeholder="Prix DT"
            value={qaPrice}
            onChange={(e) => setQaPrice(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveNew();
              if (e.key === "Escape") {
                setQaTitle("");
                setQaPrice("");
              }
            }}
          />
          <select
            className="md:col-span-2 px-2 py-2 md:py-1 rounded border border-pos-border bg-white text-sm w-full"
            value={qaDuration}
            onChange={(e) => setQaDuration(Number(e.target.value))}
          >
            {ALLOWED_DURATIONS.map((d) => (
              <option key={d} value={d}>
                {d} min
              </option>
            ))}
          </select>
          <label className="md:col-span-2 flex items-center gap-2 px-2 py-2 md:py-1 rounded border border-pos-border bg-white col-span-2">
            <input
              type="checkbox"
              checked={qaTaxOn}
              onChange={(e) => setQaTaxOn(e.target.checked)}
            />
            <span className="text-xs whitespace-nowrap">
              TVA{" "}
              {qaTaxOn ? (
                <input
                  type="number"
                  step="0.01"
                  className="w-12 px-1 border-b border-pos-border outline-none"
                  value={qaTaxRate}
                  onChange={(e) => setQaTaxRate(Number(e.target.value))}
                />
              ) : (
                "désactivée"
              )}
              {qaTaxOn ? " %" : ""}
            </span>
          </label>
          <button
            className="md:col-span-2 col-span-2 px-3 py-2 md:py-1 rounded bg-pos-ink text-pos-bg disabled:opacity-50 text-sm font-medium"
            disabled={busy || !qaTitle.trim() || !qaPrice}
            onClick={saveNew}
          >
            Ajouter
          </button>
        </div>
      </div>

      {/* Desktop: table. Mobile: card list. */}
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <thead className="text-pos-ink-3 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-3 py-2">Nom</th>
              <th className="text-right px-3 py-2">Prix</th>
              <th className="text-right px-3 py-2">Durée</th>
              <th className="text-right px-3 py-2">TVA</th>
              <th className="text-center px-3 py-2">Actif</th>
              <th className="text-left px-3 py-2">Statut</th>
            </tr>
          </thead>
          <tbody>
            {offers.map((o) => (
              <tr
                key={o.id}
                onClick={() => openEdit(o.id)}
                className="border-t border-pos-border hover:bg-pos-surface/60 cursor-pointer"
              >
                <td className="px-3 py-2">{o.title}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {Number(o.discountPrice).toFixed(3)} TND
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{o.durationMinutes} min</td>
                <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => toggleTax(o)}
                    disabled={toggling === o.id}
                    title="Cliquer pour activer/désactiver la TVA"
                    className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      Number(o.taxRate) > 0
                        ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : "bg-pos-bg text-pos-ink-3 hover:bg-pos-border/40"
                    }`}
                  >
                    {Number(o.taxRate) > 0
                      ? `${Number(o.taxRate).toFixed(2)}%`
                      : "Sans TVA"}
                  </button>
                </td>
                <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={o.active}
                    onChange={() => toggleActive(o)}
                    disabled={toggling === o.id}
                    aria-label={`Actif — ${o.title}`}
                  />
                </td>
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <StatusBadge offer={o} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden flex flex-col gap-2">
        {offers.map((o) => (
          <div
            key={o.id}
            onClick={() => openEdit(o.id)}
            className="rounded-lg border border-pos-border bg-pos-surface p-3 cursor-pointer"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-pos-ink truncate">{o.title}</p>
                <p className="text-xs text-pos-ink-3 mt-0.5">
                  {Number(o.discountPrice).toFixed(3)} TND · {o.durationMinutes} min
                </p>
              </div>
              <label
                className="shrink-0 flex items-center gap-1 text-xs text-pos-ink-2"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={o.active}
                  onChange={() => toggleActive(o)}
                  disabled={toggling === o.id}
                  aria-label={`Actif — ${o.title}`}
                />
                Actif
              </label>
            </div>
            <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => toggleTax(o)}
                disabled={toggling === o.id}
                className={`px-2 py-1 rounded text-xs font-semibold ${
                  Number(o.taxRate) > 0
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-pos-bg text-pos-ink-3 border border-pos-border"
                }`}
              >
                {Number(o.taxRate) > 0
                  ? `TVA ${Number(o.taxRate).toFixed(2)}%`
                  : "Sans TVA"}
              </button>
              <StatusBadge offer={o} compact />
            </div>
          </div>
        ))}
        {offers.length === 0 && (
          <p className="text-sm text-pos-ink-3 text-center py-8">
            Aucun service. Ajoutez-en un ci-dessus.
          </p>
        )}
      </div>

      {editId && (
        <ServiceEditDrawer
          offerId={editId}
          onClose={closeEdit}
          onSaved={applySaved}
        />
      )}
    </div>
  );
}
