/**
 * L'exemple pedagogique en deux visites, a 10 %.
 *
 * LE POURCENTAGE EST FIXE (10 %) mais les REGLES SONT CELLES DU SALON :
 * minimum pour utiliser la cagnotte et plafond par ticket. C'est ce qui evite
 * la contradiction la plus facile a produire sur cette page — un exemple ou
 * la cliente depense 15 DT de cagnotte, juste sous une pastille annoncant un
 * minimum de 50 DT.
 *
 * Quand les reglages du salon rendent l'exemple injouable, on le DIT et on
 * montre la reduction que le salon accorderait vraiment. Un chiffre rond et
 * faux serait pire qu'un chiffre explique.
 *
 * Composant serveur — le calcul vient des props.
 */

import {
  exempleDeuxVisites,
  pointsEnDinars,
  ratiosDepuisPct,
  EXEMPLE_PCT,
} from "@/lib/rewards/fidelite-affichage";
import { EXEMPLE_VISITES } from "./contenu";

function virgule(montant: string): string {
  return montant.replace(".", ",");
}

export function ExempleVisites({
  minPointsToRedeem,
  maxRedemptionPctPerSale,
}: {
  minPointsToRedeem: number;
  maxRedemptionPctPerSale: number;
}) {
  const ex = exempleDeuxVisites({
    minPointsToRedeem,
    maxRedemptionPctPerSale,
    montantVisite1: EXEMPLE_VISITES.montant1,
    montantVisite2: EXEMPLE_VISITES.montant2,
  });

  // La cagnotte gagnee en visite 1, en dinars. On repasse par
  // `pointsEnDinars` plutot que de multiplier a la main : c'est la meme
  // conversion que la caisse, arrondi compris.
  const gain1 = virgule(
    pointsEnDinars(ex.visite1.pointsGagnes, ratiosDepuisPct(EXEMPLE_PCT).dinarPerPoint),
  );

  return (
    <section aria-labelledby="fid-exemple">
      <div className="mb-3">
        <h2 id="fid-exemple" className="text-base md:text-lg font-semibold text-pos-ink">
          Un exemple avec {EXEMPLE_PCT} %
        </h2>
        <p className="mt-1 text-xs text-pos-ink-3">
          Avec vos règles actuelles.
        </p>
      </div>

      {ex.impossible && (
        <p
          role="status"
          className="mb-3 rounded-xl border border-pos-warn/40 bg-pos-highlight px-3 py-2 text-xs text-pos-warn"
        >
          {ex.impossible}
        </p>
      )}

      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Visite 1 — elle gagne */}
        <li className="rounded-2xl border border-pos-border bg-white p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-pos-ink-4">
            {EXEMPLE_VISITES.visite1.titre}
          </p>
          <p className="mt-3 text-sm italic leading-snug text-pos-ink-2">
            «&nbsp;{EXEMPLE_VISITES.visite1.darija}&nbsp;»
          </p>
          <p className="mt-4 inline-flex items-center rounded-full bg-pos-highlight px-3 py-1.5 text-sm font-semibold text-pos-ink tabular-nums">
            + {gain1} DT de cagnotte
          </p>
        </li>

        {/* Visite 2 — elle utilise */}
        <li className="rounded-2xl border border-pos-border bg-white p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-pos-ink-4">
            {EXEMPLE_VISITES.visite2.titre}
          </p>
          <p className="mt-3 text-sm italic leading-snug text-pos-ink-2">
            «&nbsp;{EXEMPLE_VISITES.visite2.darija}&nbsp;»
          </p>
          <p className="mt-4 inline-flex items-center rounded-full bg-pos-accent-soft px-3 py-1.5 text-sm font-semibold text-pos-ink tabular-nums">
            − {virgule(ex.visite2.reductionDT)} DT
          </p>
        </li>

        {/* Resultat — ce qu'elle a economise */}
        <li className="rounded-2xl border border-pos-accent bg-pos-accent p-5 text-white">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
            {EXEMPLE_VISITES.resultat.titre}
          </p>
          <p className="mt-3 text-sm italic leading-snug text-white/90">
            «&nbsp;Khallset {virgule(ex.visite2.payeDT)} DT barka&nbsp;!&nbsp;»
          </p>
          <p className="mt-4 text-3xl font-semibold tabular-nums">
            {virgule(ex.visite2.payeDT)} DT
          </p>
          <p className="mt-1 text-xs text-white/70 tabular-nums">
            au lieu de {virgule(ex.visite2.montant.toFixed(3))} DT
          </p>
        </li>
      </ol>
    </section>
  );
}
