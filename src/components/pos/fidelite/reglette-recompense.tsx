"use client";

/**
 * Le bloc « Combien vous offrez ? » : une reglette 3–10 % et l'apercu en
 * direct de ce qu'elle donne.
 *
 * LA REGLETTE EST UN `<input type="range">` NATIF. Le projet n'a pas de
 * composant de ce genre, et une version maison en `div` + `onPointerMove`
 * aurait coute le clavier (fleches, Origine/Fin), le lecteur d'ecran et le
 * geste tactile — tout ce que le natif donne gratuitement. On ne l'habille
 * qu'en CSS.
 *
 * L'APERCU N'EST PAS UN CALCUL LOCAL : il passe par `apercuRecompense`, donc
 * par les vraies formules de la caisse, arrondi vers le bas compris. Un
 * apercu qui multiplierait simplement le montant par le pourcentage
 * promettrait des dinars que la caisse ne donnera pas.
 */

import { useId, useState } from "react";
import {
  RECOMPENSE_MAX_PCT,
  RECOMPENSE_MIN_PCT,
  RECOMPENSE_PAS_PCT,
  apercuRecompense,
  type EtatRecompense,
} from "@/lib/rewards/fidelite-affichage";
import { formatDT } from "@/lib/money";

const MONTANT_APERCU = 100;

export function RegletteRecompense({
  etat,
  peutModifier,
  onEnregistrer,
}: {
  etat: EtatRecompense;
  peutModifier: boolean;
  onEnregistrer: (pct: number) => Promise<void>;
}) {
  const [pct, setPct] = useState(etat.curseur);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enregistre, setEnregistre] = useState(false);
  const idReglette = useId();
  const idApercu = useId();

  // Le bouton ne sert a rien tant que rien n'a bouge — sauf pour un salon
  // hors bornes, qui doit justement pouvoir entrer dans les bornes.
  const modifie = pct !== etat.curseur || etat.horsBornes;

  const apercu = apercuRecompense(pct, MONTANT_APERCU);

  async function enregistrer() {
    setBusy(true);
    setErreur(null);
    try {
      await onEnregistrer(pct);
      setEnregistre(true);
      // Le mot « Enregistré » disparait seul : laisse a l'ecran, il finirait
      // par decrire un etat qui n'est plus vrai.
      setTimeout(() => setEnregistre(false), 2500);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-labelledby={idReglette}>
      {/* Carte gauche — le reglage */}
      <div className="rounded-2xl border border-pos-border bg-white p-5 md:p-6">
        <h2
          id={idReglette}
          className="text-base md:text-lg font-semibold text-pos-ink"
        >
          Combien vous offrez sur chaque prestation&nbsp;?
        </h2>

        {etat.horsBornes && (
          <p
            role="status"
            className="mt-3 rounded-xl border border-pos-warn/40 bg-pos-highlight px-3 py-2 text-xs text-pos-warn"
          >
            Votre réglage actuel est de{" "}
            <strong>{etat.reel.toLocaleString("fr-FR")} %</strong>, en dehors des
            limites. Enregistrez pour passer à {pct} %.
          </p>
        )}

        <p className="mt-5 flex items-baseline gap-2">
          <span
            className="text-5xl md:text-6xl font-semibold text-pos-ink tabular-nums"
            aria-hidden
          >
            {pct} %
          </span>
          <span className="text-sm text-pos-ink-3">du prix</span>
        </p>

        <label htmlFor={`${idReglette}-range`} className="sr-only">
          Récompense offerte, en pourcentage du prix
        </label>
        <input
          id={`${idReglette}-range`}
          type="range"
          min={RECOMPENSE_MIN_PCT}
          max={RECOMPENSE_MAX_PCT}
          step={RECOMPENSE_PAS_PCT}
          value={pct}
          disabled={!peutModifier}
          onChange={(e) => setPct(Number(e.target.value))}
          aria-describedby={idApercu}
          aria-valuetext={`${pct} pour cent du prix`}
          className="fid-reglette mt-5 w-full"
        />
        <div className="mt-1 flex justify-between text-xs text-pos-ink-3 tabular-nums">
          <span>{RECOMPENSE_MIN_PCT} %</span>
          <span>{RECOMPENSE_MAX_PCT} %</span>
        </div>

        {erreur && (
          <p className="mt-4 rounded-xl bg-pos-danger-soft px-3 py-2 text-sm text-pos-danger">
            {erreur}
          </p>
        )}

        {peutModifier ? (
          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={enregistrer}
              disabled={busy || !modifie}
              className="min-h-[44px] rounded-xl bg-pos-accent px-6 text-sm font-semibold text-white disabled:opacity-40"
            >
              {busy ? "Enregistrement…" : "Enregistrer"}
            </button>
            {enregistre && (
              <span role="status" className="text-sm font-medium text-pos-accent">
                Enregistré
              </span>
            )}
          </div>
        ) : (
          <p className="mt-5 text-xs text-pos-ink-3">
            Seule la propriétaire peut changer ce réglage.
          </p>
        )}
      </div>

      {/* Carte droite — l'apercu, fond fonce */}
      <div
        id={idApercu}
        aria-live="polite"
        className="rounded-2xl bg-pos-ink p-5 md:p-6 text-white"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
          Ce que ça donne
        </p>

        <p className="mt-5 text-2xl md:text-3xl font-semibold tabular-nums">
          {MONTANT_APERCU} DT
          <span className="mx-2 text-white/40" aria-hidden>
            →
          </span>
          <span className="text-pos-accent-soft">{apercu.valeurDT.replace(".", ",")} DT</span>
        </p>
        <p className="mt-2 text-sm text-white/70">
          de cagnotte pour votre cliente
        </p>

        <p className="mt-6 border-t border-white/15 pt-4 text-sm italic text-white/85">
          «&nbsp;Prestation b {MONTANT_APERCU} DT, terba7{" "}
          {apercu.valeurDT.replace(".", ",")} DT cagnotte.&nbsp;»
        </p>

        {/* Les points restent la verite en base : on les mentionne en petit,
            sans en faire le chiffre principal. */}
        <p className="mt-4 text-xs text-white/50 tabular-nums">
          Soit {apercu.points.toLocaleString("fr-FR")} points ·{" "}
          {formatDT(apercu.valeurDT)}
        </p>
      </div>
    </section>
  );
}
