"use client";

/**
 * Le compte rendu d'appel — la seule action rose de la page.
 *
 * Le design system n'autorise qu'UNE action rose par vue : c'est celle-ci.
 * Tout le reste du cockpit (filtres, onglets, liens) est en contour ou en
 * texte, pour que « Enregistrer l'appel » soit le seul geste qui saute aux
 * yeux une fois le telephone raccroche.
 *
 * La validation vit cote serveur dans `compte-rendu-appel.ts` : ce formulaire
 * la DOUBLE pour eviter un aller-retour inutile, il ne la remplace pas. Les
 * messages affiches ici sont ceux que la route renverrait de toute facon.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  LIBELLE_RESULTAT,
  RESULTATS_APPEL,
  type ResultatAppel,
} from "@/lib/compte-rendu-appel";

const ORDRE: ResultatAppel[] = [
  RESULTATS_APPEL.JOINT,
  RESULTATS_APPEL.PAS_DE_REPONSE,
  RESULTATS_APPEL.A_RAPPELER,
  RESULTATS_APPEL.PAS_INTERESSE,
];

export function CompteRenduClient({ salonId }: { salonId: string }) {
  const router = useRouter();
  const [resultat, setResultat] = useState<ResultatAppel | null>(null);
  const [contenu, setContenu] = useState("");
  const [rappelLe, setRappelLe] = useState("");
  const [blocageLeve, setBlocageLeve] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // « À rappeler » sans date ne ressort dans aucune liste : le salon ne serait
  // jamais rappele. On le dit AVANT l'envoi plutot qu'apres un refus serveur.
  const dateManquante = resultat === RESULTATS_APPEL.A_RAPPELER && !rappelLe;

  async function envoyer() {
    setErreur(null);
    if (contenu.trim().length < 3) {
      setErreur("Écrivez ce qui s'est dit pendant l'appel.");
      return;
    }
    if (dateManquante) {
      setErreur("Indiquez quand rappeler ce salon.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/superadmin/salons/${salonId}/note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contenu: contenu.trim(),
          resultat,
          // `<input type="date">` rend "2026-10-20" : on vise la fin de
          // journee, sinon un rappel pose pour aujourd'hui serait refuse comme
          // « deja passe » des que midi est depasse.
          rappelLe: rappelLe ? `${rappelLe}T23:59:00` : null,
          blocageLeve,
        }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setErreur(d.error ?? "Enregistrement impossible");
        return;
      }
      setContenu("");
      setResultat(null);
      setRappelLe("");
      setBlocageLeve(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold text-prune">Résultat de l&apos;appel</legend>
        <div className="flex flex-wrap gap-2">
          {ORDRE.map((r) => {
            const actif = resultat === r;
            return (
              <button
                key={r}
                type="button"
                aria-pressed={actif}
                onClick={() => setResultat(actif ? null : r)}
                className={`ds-focus min-h-[44px] rounded-[var(--radius-pill)] border px-4 text-sm font-semibold ${
                  actif
                    ? "border-prune bg-prune text-creme"
                    : "border-hairline bg-white text-prune-soft hover:text-prune"
                }`}
              >
                {LIBELLE_RESULTAT[r]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-prune">Ce qui s&apos;est dit</span>
        <textarea
          value={contenu}
          onChange={(e) => setContenu(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Ex : la gérante n'avait pas vu l'e-mail de confirmation, renvoyé ensemble."
          className="ds-focus rounded-[var(--radius-panel)] border border-hairline bg-white px-3 py-2 text-sm text-prune"
        />
      </label>

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-prune">
            Rappeler le{" "}
            {dateManquante && <span className="text-rose-fonce">— obligatoire</span>}
          </span>
          <input
            type="date"
            value={rappelLe}
            onChange={(e) => setRappelLe(e.target.value)}
            className="ds-focus min-h-[44px] rounded-[var(--radius-pill)] border border-hairline bg-white px-4 text-sm text-prune"
          />
        </label>

        <label className="flex min-h-[44px] items-center gap-2">
          <input
            type="checkbox"
            checked={blocageLeve}
            onChange={(e) => setBlocageLeve(e.target.checked)}
            className="h-4 w-4 accent-prune"
          />
          <span className="text-sm text-prune">L&apos;appel a débloqué la situation</span>
        </label>
      </div>

      {erreur && (
        <p role="status" className="text-sm text-rose-fonce">
          {erreur}
        </p>
      )}

      <div>
        <button
          type="button"
          onClick={envoyer}
          disabled={busy}
          className="ds-press ds-focus min-h-[44px] rounded-[var(--radius-pill)] bg-rose px-6 text-sm font-semibold text-prune disabled:opacity-50"
        >
          {busy ? "Enregistrement…" : "Enregistrer l'appel"}
        </button>
      </div>
    </div>
  );
}
