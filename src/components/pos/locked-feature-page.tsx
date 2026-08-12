"use client";

import { useEffect, useState } from "react";
import { Lock, Check } from "lucide-react";

/**
 * Gabarit des pages de fonctionnalites pas encore livrees.
 *
 * Le bouton "Etre prevenu" enregistre une ligne FeatureInterest : cela donne
 * une liste d'attente qualifiee avant meme d'avoir code la fonctionnalite,
 * ce qui sert de signal de priorisation.
 */
export function LockedFeaturePage({
  feature,
  title,
  tagline,
  bullets,
}: {
  feature: "COLLAB" | "STORE";
  title: string;
  tagline: string;
  bullets: string[];
}) {
  const [registered, setRegistered] = useState(false);
  const [busy, setBusy] = useState(false);

  // Recharge l'etat pour que le bouton reste sur "deja inscrit" apres un
  // rafraichissement de page.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/pos/interest", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { features: string[] };
        if (!cancelled) setRegistered(data.features.includes(feature));
      } catch {
        // Silencieux : l'echec du prechargement laisse simplement le bouton
        // dans son etat par defaut, l'upsert cote serveur reste idempotent.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [feature]);

  async function register() {
    if (busy || registered) return;
    setBusy(true);
    try {
      const res = await fetch("/api/pos/interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature }),
      });
      if (res.ok) setRegistered(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-pos-bg md:p-8 p-4">
      <div className="mx-auto max-w-2xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-pos-border bg-pos-surface px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-pos-ink-3">
          <Lock size={12} />
          Bientôt disponible
        </span>

        <h1 className="luxury-heading mt-4 text-3xl text-pos-ink">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-pos-ink-2">{tagline}</p>

        <div className="relative mt-8 overflow-hidden rounded-2xl border border-pos-border">
          <div
            aria-hidden="true"
            className="flex h-48 items-center justify-center bg-gradient-to-br from-pos-surface via-pos-bg to-pos-border blur-[2px]"
          >
            <span className="text-6xl opacity-30">{feature === "COLLAB" ? "🤝" : "🛍️"}</span>
          </div>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-pos-bg to-transparent" />
        </div>

        <ul className="mt-8 space-y-3">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-3 text-sm text-pos-ink-2">
              <Check size={16} className="mt-0.5 shrink-0 text-pos-accent" />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={register}
          disabled={busy || registered}
          className={`mt-8 w-full rounded-xl py-4 text-sm font-semibold transition ${
            registered
              ? "cursor-default border border-pos-border bg-pos-surface text-pos-ink-2"
              : "bg-pos-ink text-pos-bg active:scale-[0.99] disabled:opacity-60"
          }`}
        >
          {registered ? "✓ Vous serez prévenu·e" : busy ? "…" : "Être prévenu·e au lancement"}
        </button>

        <p className="mt-3 text-center text-xs text-pos-ink-3">
          Nous vous contacterons dès que cette fonctionnalité sera disponible.
        </p>
      </div>
    </div>
  );
}
