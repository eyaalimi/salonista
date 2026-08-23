"use client";

/**
 * Verrouillage de la caisse apres inactivite.
 *
 * Une tablette de comptoir reste allumee toute la journee, session ouverte.
 * Sans verrou, n'importe qui passant derriere le comptoir accede au chiffre
 * d'affaires, aux fiches clientes et aux remboursements.
 *
 * Le verrou ne DECONNECTE pas : il masque l'ecran. La caissiere ressaisit son
 * PIN et retrouve son panier intact — une deconnexion lui ferait perdre une
 * vente en cours, ce qui la pousserait a desactiver la protection.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { POS_INACTIVITE_MS } from "@/lib/pin-lockout";

/** Evenements qui prouvent une presence humaine. */
const SIGNES_DE_VIE = [
  "pointerdown",
  "keydown",
  "touchstart",
  "wheel",
] as const;

export function IdleLock({ displayName }: { displayName: string }) {
  const [verrouille, setVerrouille] = useState(false);
  const [pin, setPin] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const minuterie = useRef<number | null>(null);

  const armer = useCallback(() => {
    if (minuterie.current !== null) window.clearTimeout(minuterie.current);
    minuterie.current = window.setTimeout(
      () => setVerrouille(true),
      POS_INACTIVITE_MS,
    );
  }, []);

  useEffect(() => {
    // Une fois verrouille, l'activite ne doit plus repousser l'echeance :
    // taper son PIN ne doit pas deverrouiller par simple frappe.
    if (verrouille) {
      if (minuterie.current !== null) window.clearTimeout(minuterie.current);
      return;
    }

    armer();
    for (const e of SIGNES_DE_VIE) {
      window.addEventListener(e, armer, { passive: true });
    }
    return () => {
      for (const e of SIGNES_DE_VIE) window.removeEventListener(e, armer);
      if (minuterie.current !== null) window.clearTimeout(minuterie.current);
    };
  }, [verrouille, armer]);

  async function deverrouiller(e: React.FormEvent) {
    e.preventDefault();
    if (envoi || pin.length < 4) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const res = await fetch("/api/salon-pin/relock-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (res.ok) {
        setPin("");
        setVerrouille(false);
        return;
      }
      const data = await res.json().catch(() => ({}));
      setErreur(data.error ?? "PIN incorrect");
      setPin("");
    } catch {
      setErreur("Erreur de connexion");
    } finally {
      setEnvoi(false);
    }
  }

  if (!verrouille) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-pos-ink/95 p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Caisse verrouillée"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center">
        <p className="text-xs uppercase tracking-wider text-pos-ink-3">
          Caisse verrouillée
        </p>
        <h2 className="mt-2 text-xl font-semibold text-pos-ink">{displayName}</h2>
        <p className="mt-2 text-sm text-pos-ink-3">
          Saisissez votre code PIN pour reprendre. Votre panier est conservé.
        </p>

        <form onSubmit={deverrouiller} className="mt-6 space-y-3">
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            className="w-full rounded-lg border-2 border-pos-border px-4 py-3 text-center text-2xl tracking-[0.5em] text-pos-ink"
            aria-label="Code PIN"
          />
          {erreur && <p className="text-sm text-pos-danger">{erreur}</p>}
          <button
            type="submit"
            disabled={envoi || pin.length < 4}
            className="min-h-[48px] w-full rounded-lg bg-pos-ink text-sm font-semibold text-pos-bg disabled:opacity-50"
          >
            {envoi ? "Vérification…" : "Déverrouiller"}
          </button>
        </form>
      </div>
    </div>
  );
}
