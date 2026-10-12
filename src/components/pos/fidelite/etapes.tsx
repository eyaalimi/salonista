/**
 * Les trois etapes du programme, en haut de page.
 *
 * C'est la seule chose qu'une gerante doit comprendre pour vouloir du
 * programme : elle paie, elle gagne, elle revient. Trois icones, trois
 * phrases courtes, et la phrase a dire a sa cliente en dessous.
 *
 * Les fleches sont HORS de la liste, entre ses elements, et masquees aux
 * lecteurs d'ecran : l'ordre de l'`<ol>` dit deja la sequence. Les placer
 * dans les `<li>` aurait fait lire « etape 1, fleche droite » a chaque ligne.
 *
 * Composant serveur — aucun etat, aucun evenement.
 */

import { ETAPES } from "./contenu";
import { FlecheEtape, IconeCagnotte, IconePaiement, IconeReduction } from "./icones";

const ICONES = [IconePaiement, IconeCagnotte, IconeReduction] as const;

export function Etapes() {
  return (
    <section
      aria-label="Comment ça marche"
      className="rounded-2xl border border-pos-border bg-white px-4 py-6 md:px-8 md:py-8"
    >
      <ol className="flex flex-col gap-1 md:flex-row md:items-start md:gap-2">
        {ETAPES.map((etape, i) => {
          const Icone = ICONES[i];
          return (
            <li
              key={etape.fr}
              className="contents"
            >
              <div className="flex flex-1 flex-row items-center gap-4 md:flex-col md:gap-3 md:text-center">
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-pos-highlight text-pos-ink md:h-20 md:w-20">
                  <Icone taille={36} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-pos-ink md:text-base">
                    {etape.fr}
                  </span>
                  <span className="mt-0.5 block text-xs italic text-pos-ink-3 md:text-sm">
                    «&nbsp;{etape.darija}&nbsp;»
                  </span>
                </span>
              </div>

              {i < ETAPES.length - 1 && (
                <span
                  aria-hidden
                  className="flex shrink-0 justify-center py-1 pl-8 text-pos-border-strong md:items-center md:self-center md:py-0 md:pl-0"
                >
                  <FlecheEtape className="rotate-90 md:rotate-0" />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
