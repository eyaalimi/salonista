"use client";

/**
 * Les trois autres regles, en pastilles : minimum pour utiliser la cagnotte,
 * plafond par ticket, cagnotte offerte.
 *
 * TOUT EST EN DINARS. La page precedente affichait « Min. points pour
 * echanger : 100 » — un nombre qui ne veut rien dire tant qu'on ne sait pas
 * ce que vaut un point. « 1,000 TND minimum » se comprend sans calcul.
 * Le nombre de points reste indique en petit : c'est lui que la caissiere
 * voit a l'encaissement, et il ne faut pas que les deux ecrans se
 * contredisent.
 */

import { cagnotteEnDinars, fractionLisible } from "@/lib/rewards/fidelite-affichage";

export function PastillesRegles({
  minPointsToRedeem,
  maxRedemptionPctPerSale,
  welcomeBonusPoints,
  birthdayBonusPoints,
  dinarPerPoint,
  peutModifier,
  onModifier,
}: {
  minPointsToRedeem: number;
  maxRedemptionPctPerSale: number;
  welcomeBonusPoints: number;
  birthdayBonusPoints: number;
  dinarPerPoint: number;
  peutModifier: boolean;
  onModifier: () => void;
}) {
  const cadeau = welcomeBonusPoints + birthdayBonusPoints;

  const pastilles = [
    {
      valeur: `${cagnotteEnDinars(minPointsToRedeem, dinarPerPoint).replace(".", ",")} DT`,
      libelle: "minimum pour utiliser la cagnotte",
      detail: `${minPointsToRedeem.toLocaleString("fr-FR")} points`,
    },
    {
      valeur: fractionLisible(maxRedemptionPctPerSale),
      libelle: "du ticket maximum en réduction",
      detail: `${maxRedemptionPctPerSale} % du total`,
    },
    {
      valeur:
        cadeau > 0
          ? `${cagnotteEnDinars(cadeau, dinarPerPoint).replace(".", ",")} DT`
          : "0",
      libelle: "cagnotte cadeau (bienvenue, anniversaire)",
      detail:
        cadeau > 0
          ? `${welcomeBonusPoints.toLocaleString("fr-FR")} + ${birthdayBonusPoints.toLocaleString("fr-FR")} points`
          : "Aucun cadeau",
    },
  ];

  return (
    <section aria-labelledby="fid-regles">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="fid-regles" className="text-base md:text-lg font-semibold text-pos-ink">
          Vos règles
        </h2>
        {peutModifier && (
          <button
            type="button"
            onClick={onModifier}
            className="min-h-[44px] rounded-xl border border-pos-border bg-white px-4 text-sm text-pos-ink hover:bg-pos-highlight"
          >
            Modifier
          </button>
        )}
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {pastilles.map((p) => (
          <li
            key={p.libelle}
            className="rounded-2xl border border-pos-border bg-white px-4 py-5 text-center"
          >
            <p className="text-3xl font-semibold text-pos-ink tabular-nums">{p.valeur}</p>
            <p className="mx-auto mt-2 max-w-[22ch] text-xs leading-snug text-pos-ink-2">
              {p.libelle}
            </p>
            <p className="mt-1.5 text-[11px] text-pos-ink-4 tabular-nums">{p.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
