/**
 * La barre d'entonnoir — ou perd-on les salons ?
 *
 * TROIS CORRECTIONS PAR RAPPORT A LA VERSION PRECEDENTE :
 *
 *  - les sept cases tiennent sur la largeur d'un ecran d'ordinateur. Elles
 *    debordaient, et le defilement horizontal faisait apparaitre une barre
 *    doree (l'ancien token `brand-gold`) au milieu de l'espace superadmin,
 *    qui n'utilise que prune, rose, menthe et creme. Le defilement ne
 *    subsiste que sous `lg`, ou aucun ecran ne tient sept colonnes ;
 *  - les libelles sont en casse normale. Les majuscules + `tracking` large
 *    rendaient « CATALOGUE PRÊT » plus voyant que son propre chiffre ;
 *  - plus de tiret « — » sous les cases sans blocage : une case vide se lit
 *    mieux qu'un tiret qui ressemble a une valeur manquante.
 *
 * Composant serveur : aucun etat, les filtres passent par des liens.
 */

import Link from "next/link";
import type { LigneEntonnoir } from "@/lib/cockpit-appels";
import { accord, motAccorde } from "@/lib/format-fr";

export function Entonnoir({
  lignes,
  marcheActive,
  lien,
}: {
  lignes: readonly LigneEntonnoir[];
  marcheActive: string | null;
  /** Construit l'URL de filtre pour une marche (chaine vide = tout voir). */
  lien: (marche: string) => string;
}) {
  const total = lignes[0]?.atteint ?? 0;

  return (
    <section
      aria-label="Entonnoir d'activation"
      className="rounded-[var(--radius-card)] border border-hairline bg-white p-4 md:p-5"
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="ds-display text-base text-prune">
          Où en sont les {accord(total, "salon")}
        </h2>
        <p className="text-xs text-prune-soft">
          Chaque marche filtre la file des salons bloqués à cet endroit.
        </p>
      </div>

      {/* `lg:grid-cols-7` : sur ordinateur les sept cases tiennent, sans
          defilement ni barre. En dessous, defilement horizontal simple. */}
      <ol className="flex gap-2 overflow-x-auto pb-1 lg:grid lg:grid-cols-7 lg:overflow-visible lg:pb-0">
        {lignes.map((e, i) => {
          const actif = marcheActive === e.marche;
          const perte = i === 0 ? 0 : (lignes[i - 1].atteint - e.atteint);
          return (
            <li key={e.marche} className="min-w-[8rem] flex-1 lg:min-w-0">
              <div
                className={`flex h-full flex-col rounded-[var(--radius-panel)] border p-3 ${
                  e.plusGrossePerte
                    ? "border-rose-fonce bg-rose-soft/30"
                    : "border-hairline bg-creme/40"
                }`}
              >
                <span className="text-xs font-medium text-prune-soft">{e.libelle}</span>

                <span className="mt-1 flex items-baseline gap-1.5">
                  <span className="ds-display text-xl text-prune">{e.atteint}</span>
                  <span className="text-xs text-prune-soft">{e.pourcentage} %</span>
                </span>

                {/* La barre de progression : la part des inscrits arrivee
                    jusqu'ici, lisible d'un coup d'oeil. */}
                <span
                  aria-hidden
                  className="mt-2 block h-1.5 overflow-hidden rounded-[var(--radius-pill)] bg-hairline"
                >
                  <span
                    className={`block h-full rounded-[var(--radius-pill)] ${
                      e.plusGrossePerte ? "bg-rose-fonce" : "bg-prune"
                    }`}
                    style={{ width: `${e.pourcentage}%` }}
                  />
                </span>

                {perte > 0 && (
                  <span className="mt-1.5 text-xs text-rose-fonce">−{perte}</span>
                )}

                {e.plusGrossePerte && (
                  <span className="mt-1 text-[11px] font-semibold text-rose-fonce">
                    Plus grosse perte
                  </span>
                )}

                {/* `mt-auto` aligne le bouton en bas, quelle que soit la
                    hauteur du contenu au-dessus. Absent quand rien ne bloque :
                    un bouton « 0 bloqué » n'a rien a filtrer. */}
                {e.bloques > 0 && (
                  <Link
                    href={lien(actif ? "" : e.marche)}
                    className={`ds-focus mt-auto flex min-h-[44px] items-center justify-center rounded-[var(--radius-pill)] border px-2 pt-2 text-xs font-semibold ${
                      actif
                        ? "border-prune bg-prune text-creme"
                        : "border-hairline bg-white text-prune hover:border-prune"
                    }`}
                  >
                    {e.bloques} {motAccorde(e.bloques, "bloqué")} ici
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
