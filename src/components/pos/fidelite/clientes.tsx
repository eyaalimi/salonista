"use client";

/**
 * « Points de vos clientes » : la recherche et une carte par cliente.
 *
 * REMPLACE le tableau a cinq colonnes ET le widget « Top 10 fideles ».
 * Le tableau debordait sur un telephone (`min-w-[500px]` + defilement
 * horizontal), et le Top 10 montrait les memes clientes que la premiere page
 * de la liste, triee par points : deux fois la meme information, dont une en
 * colonne laterale qui volait la largeur du reste.
 *
 * « Total gagné » et « Déjà utilisé » n'ont pas disparu : ils sont dans la
 * modale « Modifier les points », ou ils servent vraiment — on les consulte
 * en cherchant pourquoi un total est ce qu'il est, pas en parcourant la
 * liste.
 */

import { useState } from "react";
import { cagnotteEnDinars } from "@/lib/rewards/fidelite-affichage";

export type ClienteFidele = {
  id: string;
  balance: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  customer: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    phone: string;
  };
};

function nomAffiche(c: ClienteFidele["customer"]): string {
  const nom = `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim();
  return nom || c.phone;
}

export function Clientes({
  clientes,
  dinarPerPoint,
  recherche,
  onRecherche,
  peutModifier,
  onModifierPoints,
}: {
  clientes: ClienteFidele[];
  dinarPerPoint: number;
  recherche: string;
  onRecherche: (valeur: string) => void;
  peutModifier: boolean;
  onModifierPoints: (cliente: ClienteFidele) => void;
}) {
  return (
    <section aria-labelledby="fid-clientes">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="fid-clientes" className="text-base md:text-lg font-semibold text-pos-ink">
          Points de vos clientes
        </h2>
        <div className="sm:w-72">
          <label htmlFor="fid-recherche" className="sr-only">
            Chercher une cliente par nom ou téléphone
          </label>
          <input
            id="fid-recherche"
            type="search"
            value={recherche}
            onChange={(e) => onRecherche(e.target.value)}
            placeholder="Nom ou téléphone"
            className="min-h-[44px] w-full rounded-xl border border-pos-border bg-white px-4 text-sm focus:border-pos-accent focus:outline-none"
          />
        </div>
      </div>

      {clientes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-pos-border bg-white px-4 py-12 text-center text-sm text-pos-ink-3">
          {recherche
            ? "Aucune cliente ne correspond à cette recherche."
            : "Aucune cliente n’a encore de points."}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {clientes.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-pos-border bg-white p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-pos-ink">
                  {nomAffiche(c.customer)}
                </p>
                <p className="mt-0.5 text-xs text-pos-ink-3 tabular-nums">
                  {c.customer.phone}
                </p>
              </div>

              <div className="text-right">
                <p className="text-xl font-semibold text-pos-ink tabular-nums">
                  {cagnotteEnDinars(c.balance, dinarPerPoint).replace(".", ",")} DT
                </p>
                <p className="mt-0.5 text-[11px] text-pos-ink-4 tabular-nums">
                  {c.balance.toLocaleString("fr-FR")} points
                </p>
              </div>

              {peutModifier && (
                <button
                  type="button"
                  onClick={() => onModifierPoints(c)}
                  className="min-h-[44px] w-full rounded-xl border border-pos-border px-4 text-sm text-pos-ink hover:bg-pos-highlight sm:w-auto"
                >
                  Modifier les points
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * La modale « Modifier les points » — l'ancienne « Ajuster ».
 *
 * Elle accueille desormais « Total gagné » et « Déjà utilisé », retires de la
 * liste. Le motif reste obligatoire : c'est lui qui rend un ajustement
 * explicable trois mois plus tard.
 */
export function ModaleModifierPoints({
  cliente,
  dinarPerPoint,
  onFermer,
  onFait,
}: {
  cliente: ClienteFidele;
  dinarPerPoint: number;
  onFermer: () => void;
  onFait: () => void | Promise<void>;
}) {
  const [delta, setDelta] = useState(0);
  const [motif, setMotif] = useState("");
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const apres = cliente.balance + delta;

  async function envoyer() {
    setErreur(null);
    if (delta === 0) {
      setErreur("Indiquez un nombre de points à ajouter ou à retirer.");
      return;
    }
    if (apres < 0) {
      setErreur("Le total ne peut pas devenir négatif.");
      return;
    }
    if (!motif.trim()) {
      setErreur("Indiquez pourquoi vous modifiez ces points.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/rewards/wallets/${cliente.id}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta, note: motif.trim() }),
      });
      if (res.ok) {
        await onFait();
      } else {
        const d = await res.json().catch(() => ({}));
        setErreur(d?.error ?? "Erreur");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="fid-modale-titre"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onFermer();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 id="fid-modale-titre" className="text-lg font-semibold text-pos-ink">
          Modifier les points
        </h2>
        <p className="mt-1 text-sm text-pos-ink-3">{nomAffiche(cliente.customer)}</p>

        <div className="mt-4 rounded-xl bg-pos-highlight px-4 py-3">
          <p className="text-2xl font-semibold text-pos-ink tabular-nums">
            {cagnotteEnDinars(cliente.balance, dinarPerPoint).replace(".", ",")} DT
          </p>
          <p className="text-xs text-pos-ink-3 tabular-nums">
            {cliente.balance.toLocaleString("fr-FR")} points aujourd’hui
          </p>
        </div>

        {/* Les deux totaux « de vie », deplaces depuis la liste. */}
        <dl className="mt-3 grid grid-cols-2 gap-3 text-center">
          <div className="rounded-xl border border-pos-border px-3 py-2">
            <dt className="text-[11px] text-pos-ink-3">Total gagné</dt>
            <dd className="text-sm font-semibold text-pos-ink tabular-nums">
              {cliente.lifetimeEarned.toLocaleString("fr-FR")} points
            </dd>
          </div>
          <div className="rounded-xl border border-pos-border px-3 py-2">
            <dt className="text-[11px] text-pos-ink-3">Déjà utilisé</dt>
            <dd className="text-sm font-semibold text-pos-ink tabular-nums">
              {cliente.lifetimeRedeemed.toLocaleString("fr-FR")} points
            </dd>
          </div>
        </dl>

        <div className="mt-5">
          <label
            htmlFor="fid-delta"
            className="block text-sm font-medium text-pos-ink"
          >
            Ajouter ou retirer des points
          </label>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              aria-label="Retirer 100 points"
              onClick={() => setDelta((d) => d - 100)}
              className="min-h-[44px] min-w-[44px] rounded-xl border border-pos-border text-lg text-pos-ink hover:bg-pos-highlight"
            >
              −
            </button>
            <input
              id="fid-delta"
              type="number"
              value={delta}
              onChange={(e) => setDelta(Math.trunc(Number(e.target.value) || 0))}
              className="min-h-[44px] flex-1 rounded-xl border border-pos-border px-3 text-center text-lg tabular-nums focus:border-pos-accent focus:outline-none"
            />
            <button
              type="button"
              aria-label="Ajouter 100 points"
              onClick={() => setDelta((d) => d + 100)}
              className="min-h-[44px] min-w-[44px] rounded-xl border border-pos-border text-lg text-pos-ink hover:bg-pos-highlight"
            >
              +
            </button>
          </div>
          {delta !== 0 && (
            <p aria-live="polite" className="mt-2 text-xs text-pos-ink-2 tabular-nums">
              Nouveau total&nbsp;: {apres.toLocaleString("fr-FR")} points ·{" "}
              {cagnotteEnDinars(Math.max(0, apres), dinarPerPoint).replace(".", ",")} DT
            </p>
          )}
        </div>

        <div className="mt-4">
          <label htmlFor="fid-motif" className="block text-sm font-medium text-pos-ink">
            Pourquoi&nbsp;? <span className="text-pos-ink-3">(obligatoire)</span>
          </label>
          <input
            id="fid-motif"
            type="text"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Ex : erreur de caisse, geste commercial"
            className="mt-2 min-h-[44px] w-full rounded-xl border border-pos-border px-3 text-sm focus:border-pos-accent focus:outline-none"
          />
        </div>

        {erreur && (
          <p className="mt-3 rounded-xl bg-pos-danger-soft px-3 py-2 text-sm text-pos-danger">
            {erreur}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onFermer}
            className="min-h-[44px] px-4 text-sm text-pos-ink-2 hover:text-pos-ink"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={envoyer}
            disabled={busy}
            className="min-h-[44px] rounded-xl bg-pos-accent px-6 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? "…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}
