"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type Offer = {
  id: string;
  title: string;
  discountPrice: string;
  durationMinutes: number;
  taxRate: string;
  active: boolean;
  publishedToMarketplace: boolean;
};

const ALLOWED_DURATIONS = [15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240];

export function ServicesListClient({ initialOffers }: { initialOffers: Offer[] }) {
  const [offers, setOffers] = useState<Offer[]>(initialOffers);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const newNameRef = useRef<HTMLInputElement>(null);

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
          publishedToMarketplace: false,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erreur");
        return;
      }
      setOffers((o) =>
        [...o, json].sort((a, b) => a.title.localeCompare(b.title, "fr"))
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
      <div className="mb-4 md:mb-2 p-3 rounded border-2 border-pos-border-strong bg-pos-card md:grid md:grid-cols-12 md:gap-2 flex flex-col gap-2">
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
                className="border-t border-pos-border hover:bg-pos-card/60"
              >
                <td className="px-3 py-2">{o.title}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {Number(o.discountPrice).toFixed(3)} DT
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{o.durationMinutes} min</td>
                <td className="px-3 py-2 text-right">
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
                <td className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={o.active}
                    onChange={() => toggleActive(o)}
                    disabled={toggling === o.id}
                    aria-label={`Actif — ${o.title}`}
                  />
                </td>
                <td className="px-3 py-2">
                  {o.publishedToMarketplace ? (
                    <Link
                      href={`/prestataire/offres/${o.id}`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-50 text-green-800 text-xs"
                    >
                      Publié·e en ligne
                    </Link>
                  ) : (
                    <Link
                      href={`/prestataire/offres/${o.id}`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-pos-border text-pos-ink-2 text-xs"
                    >
                      POS uniquement · Publier en ligne →
                    </Link>
                  )}
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
            className="rounded-lg border border-pos-border bg-pos-card p-3"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-pos-ink truncate">{o.title}</p>
                <p className="text-xs text-pos-ink-3 mt-0.5">
                  {Number(o.discountPrice).toFixed(3)} DT · {o.durationMinutes} min
                </p>
              </div>
              <label className="shrink-0 flex items-center gap-1 text-xs text-pos-ink-2">
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
            <div className="flex items-center gap-2 flex-wrap">
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
              {o.publishedToMarketplace ? (
                <Link
                  href={`/prestataire/offres/${o.id}`}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-50 text-green-800 text-xs"
                >
                  En ligne
                </Link>
              ) : (
                <Link
                  href={`/prestataire/offres/${o.id}`}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-pos-border text-pos-ink-2 text-xs"
                >
                  POS uniquement →
                </Link>
              )}
            </div>
          </div>
        ))}
        {offers.length === 0 && (
          <p className="text-sm text-pos-ink-3 text-center py-8">
            Aucun service. Ajoutez-en un ci-dessus.
          </p>
        )}
      </div>
    </div>
  );
}
