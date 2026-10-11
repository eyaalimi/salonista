"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * Une valeur affichee EN ENTIER, avec un bouton pour la copier.
 *
 * POURQUOI EN ENTIER. La recherche masquait auparavant le telephone
 * (« ••• 3456 ») et l'e-mail (« s***@gmail.com »), en partant du principe
 * qu'une fiche de support ne doit montrer que de quoi confirmer une identite
 * au telephone. Mais cet espace sert AUSSI a rappeler les salons : un numero
 * tronque est inutilisable pour appeler, et recopier a la main ce qu'on vient
 * de lire n'ajoute aucune securite — la donnee est deja a l'ecran.
 *
 * L'acces reste protege par trois gardes (role SUPERADMIN disjoint d'ADMIN,
 * TOTP de moins de 30 min, journal d'audit), et la consultation d'une fiche
 * est elle-meme journalisee. C'est la que se joue la protection, pas dans un
 * masquage d'affichage.
 *
 * POURQUOI UN BOUTON. Selectionner du texte au doigt sur un telephone est
 * penible, et c'est precisement la ou on consulte une fiche : en appelant un
 * salon.
 */
export function Copiable({
  valeur,
  lien,
  absent = false,
}: {
  /** Le texte affiche. */
  valeur: string;
  /** `tel:` ou `mailto:` — rend la valeur cliquable quand elle existe. */
  lien?: string | null;
  /** Vrai quand il n'y a rien a copier : on affiche alors un texte grise. */
  absent?: boolean;
}) {
  const [copie, setCopie] = useState(false);

  // Rien a copier : pas de bouton, et la valeur est grisee pour qu'on
  // distingue d'un coup d'oeil une donnee absente d'une donnee presente.
  if (absent) {
    return <span className="font-normal text-prune-soft">{valeur}</span>;
  }

  async function copier() {
    try {
      // On copie la valeur BRUTE du lien quand il y en a un (un numero sans
      // espaces se recolle mieux dans un composeur), sinon le texte affiche.
      const aCopier = lien?.replace(/^(tel:|mailto:)/, "") ?? valeur;
      await navigator.clipboard.writeText(aCopier);
      setCopie(true);
      setTimeout(() => setCopie(false), 1500);
    } catch {
      // `navigator.clipboard` echoue hors HTTPS et quand la permission est
      // refusee. Muet volontairement : la valeur est affichee en entier,
      // elle reste selectionnable a la main.
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      {lien ? (
        <a href={lien} className="ds-focus font-medium text-prune underline decoration-hairline">
          {valeur}
        </a>
      ) : (
        <span className="font-medium text-prune">{valeur}</span>
      )}
      <button
        type="button"
        onClick={copier}
        /* 44px de cible tactile : la charte l'exige, et on clique ici avec un
           telephone a l'oreille. */
        className="ds-press ds-focus -my-2 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--radius-pill)] text-prune-soft hover:bg-creme hover:text-prune"
        aria-label={copie ? "Copié" : `Copier ${valeur}`}
        title={copie ? "Copié" : "Copier"}
      >
        {copie ? (
          <Check size={15} className="text-menthe-deep" aria-hidden />
        ) : (
          <Copy size={15} aria-hidden />
        )}
      </button>
    </span>
  );
}
