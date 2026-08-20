"use client";

import { useState } from "react";

/**
 * Bouton de demande du module caisse.
 *
 * Sans `useEffect` : la demande part sur un clic, jamais au montage, et
 * l'etat initial vient du serveur (`dejaDemande`) plutot que d'un appel au
 * montage. Un salon qui a deja demande la caisse retrouve donc sa
 * confirmation apres rechargement, sans que le bouton reparaisse.
 */
export function CaisseOffreClient({ dejaDemande }: { dejaDemande: boolean }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">(
    dejaDemande ? "sent" : "idle",
  );
  const [error, setError] = useState(false);

  async function demander() {
    if (state !== "idle") return;
    setState("sending");
    setError(false);
    try {
      // Route partagee avec les autres fonctionnalites non activees
      // (Collab, Store) : un seul endroit ecrit dans FeatureInterest.
      const res = await fetch("/api/pos/interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature: "POS" }),
      });
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
