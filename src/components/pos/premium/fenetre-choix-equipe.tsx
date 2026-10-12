"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ChoixEquipe } from "@/lib/plan-equipe";

/**
 * A la premiere ouverture de la caisse apres la fin de l'essai : la caisse a
 * garde une employee par defaut (la derniere connectee), la gerante confirme
 * ou en choisit une autre. Rien n'est supprime — les autres sont en pause.
 */
export function FenetreChoixEquipe({ choix }: { choix: ChoixEquipe }) {
  const router = useRouter();
  const [ouverte, setOuverte] = useState(true);
  const [mode, setMode] = useState<"confirmer" | "choisir">("confirmer");
  const [selection, setSelection] = useState<string>(choix.enPause[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!ouverte) return null;

  async function envoyer(body: Record<string, string>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/pos/plan/equipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? "Enregistrement impossible.");
        return;
      }
      setOuverte(false);
      router.refresh();
    } catch {
      setError("Erreur réseau. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  const prenomGarde = choix.gardee?.displayName ?? "personne";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="choix-equipe-titre"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 id="choix-equipe-titre" className="text-lg font-semibold text-pos-ink">
          Votre essai Premium est terminé
        </h2>

        {mode === "confirmer" ? (
          <>
            <p className="mt-3 text-sm text-pos-ink-2">
              En version gratuite, une seule employée garde son accès.{" "}
              {choix.gardee ? (
                <>
                  Nous avons gardé <strong className="text-pos-ink">{prenomGarde}</strong>.
                </>
              ) : (
                "Aucune employée n'a été gardée."
              )}
            </p>
            <p className="mt-2 text-sm text-pos-ink-2">
              En pause : {choix.enPause.map((e) => e.displayName).join(", ")}. Leurs ventes et
              leurs commissions sont conservées.
            </p>
            {error && (
              <p className="mt-3 rounded bg-pos-danger-soft px-3 py-2 text-sm text-pos-danger">{error}</p>
            )}
            <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
              {choix.gardee && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void envoyer({ action: "confirmer" })}
                  className="rounded-lg bg-pos-accent px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  C&apos;est bien elle
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => setMode("choisir")}
                className="rounded-lg border border-pos-border px-4 py-2.5 text-sm text-pos-ink hover:bg-pos-bg"
              >
                Choisir une autre employée
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-3 text-sm text-pos-ink-2">
              Qui doit garder son accès à la caisse ?
              {choix.gardee && ` ${prenomGarde} passera en pause.`}
            </p>
            <fieldset className="mt-4 space-y-2">
              <legend className="sr-only">Employée gardée</legend>
              {choix.enPause.map((e) => (
                <label
                  key={e.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-pos-border px-3 py-2.5 text-sm text-pos-ink has-[:checked]:border-pos-accent"
                >
                  <input
                    type="radio"
                    name="employee-gardee"
                    value={e.id}
                    checked={selection === e.id}
                    onChange={() => setSelection(e.id)}
                  />
                  {e.displayName}
                </label>
              ))}
            </fieldset>
            {error && (
              <p className="mt-3 rounded bg-pos-danger-soft px-3 py-2 text-sm text-pos-danger">{error}</p>
            )}
            <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
              <button
                type="button"
                disabled={busy || !selection}
                onClick={() => void envoyer({ action: "echanger", employeeId: selection })}
                className="rounded-lg bg-pos-accent px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                Garder cette employée
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setMode("confirmer")}
                className="rounded-lg px-4 py-2.5 text-sm text-pos-ink-2 hover:text-pos-ink"
              >
                Retour
              </button>
            </div>
          </>
        )}

        <p className="mt-5 border-t border-pos-border pt-4 text-xs text-pos-ink-3">
          Avec le Premium, toute l&apos;équipe retrouve son accès.{" "}
          <Link href="/pos/premium" className="font-medium text-pos-ink underline">
            Passer au Premium
          </Link>
        </p>
      </div>
    </div>
  );
}
