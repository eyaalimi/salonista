"use client";

import { useState } from "react";

/**
 * Bouton de demande du module caisse.
 *
 * Etat local uniquement (idle -> sending -> sent), sans `useEffect` : la
 * demande part sur un clic, jamais au montage. L'upsert cote serveur etant
 * idempotent, un rechargement de page qui remet le bouton a « idle » ne cree
 * pas de doublon.
 */
export function CaisseOffreClient() {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState(false);

  async function demander() {
    if (state !== "idle") return;
    setState("sending");
    setError(false);
    try {
      const res = await fetch("/api/pos/caisse-interet", { method: "POST" });
      if (res.ok) {
        setState("sent");
      } else {
        setError(true);
        setState("idle");
      }
    } catch {
      setError(true);
      setState("idle");
    }
  }

  // Volontairement pas « module active » : la demande est enregistree, mais
  // l'activation reste une decision commerciale prise hors de cette page.
  if (state === "sent") {
    return (
      <div className="rounded-[var(--radius-card)] border-2 border-hairline bg-white p-5">
        <p className="text-base font-semibold text-prune">
          Merci, nous vous recontactons
        </p>
        <p className="mt-1 text-sm text-prune-soft">
          Votre demande est enregistrée. Nous revenons vers vous pour vous
          présenter la caisse et son tarif.
        </p>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={demander}
        disabled={state === "sending"}
        className="ds-press ds-focus inline-flex min-h-[52px] items-center rounded-[var(--radius-pill)] bg-rose px-8 text-base font-semibold text-prune"
      >
        {state === "sending" ? "Envoi…" : "Je veux la caisse"}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-sm text-prune">
          L&apos;envoi n&apos;a pas abouti. Merci de réessayer.
        </p>
      )}
    </div>
  );
}
