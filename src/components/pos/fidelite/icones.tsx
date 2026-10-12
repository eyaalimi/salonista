/**
 * Icones au trait de la page Fidelite.
 *
 * POURQUOI PAS D'EMOJI. Un emoji change de dessin selon le telephone, ne
 * suit pas la couleur du texte, et se lit « image sans description » par un
 * lecteur d'ecran. Ces traces suivent `currentColor` et portent
 * `aria-hidden` : le sens est dans le texte a cote, pas dans l'icone.
 *
 * `lucide-react` est deja la (et utilise ailleurs dans la caisse), mais ses
 * icones sont dessinees pour 16–24 px. Ici elles s'affichent a 40 px et
 * au-dela : les traits paraissent fins et l'ensemble flotte. Ces quatre
 * tracés sont dessines pour cette taille, avec un trait de 1,5.
 */

type PropsIcone = {
  /** Cote du carre, en pixels. */
  taille?: number;
  className?: string;
};

const communs = (taille: number, className?: string) => ({
  width: taille,
  height: taille,
  viewBox: "0 0 48 48",
  fill: "none" as const,
  stroke: "currentColor" as const,
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
  className,
});

/** Billet + piece : « elle paie ». */
export function IconePaiement({ taille = 40, className }: PropsIcone) {
  return (
    <svg {...communs(taille, className)}>
      <rect x="4" y="13" width="31" height="20" rx="3" />
      <circle cx="19.5" cy="23" r="5" />
      <path d="M9 19v8M30 19v8" />
      <path d="M40 20v14a3 3 0 0 1-3 3H12" />
    </svg>
  );
}

/** Etoile dans un cercle : « elle gagne une cagnotte ». */
export function IconeCagnotte({ taille = 40, className }: PropsIcone) {
  return (
    <svg {...communs(taille, className)}>
      <circle cx="24" cy="24" r="18" />
      <path d="M24 12.5l3.6 7.4 8.1 1.2-5.85 5.75 1.4 8.1L24 30.6l-7.25 4.35 1.4-8.1L12.3 21.1l8.1-1.2z" />
    </svg>
  );
}

/** Etiquette de prix reduite : « elle paie moins ». */
export function IconeReduction({ taille = 40, className }: PropsIcone) {
  return (
    <svg {...communs(taille, className)}>
      <path d="M25.5 5.5H40a2.5 2.5 0 0 1 2.5 2.5v14.5a3 3 0 0 1-.88 2.12L24.6 41.6a2.5 2.5 0 0 1-3.54 0L6.4 26.94a2.5 2.5 0 0 1 0-3.54L23.4 6.4a3 3 0 0 1 2.1-.9z" />
      <circle cx="33.5" cy="14.5" r="2.5" />
      <path d="M17 29l10-10" />
      <circle cx="17.5" cy="20.5" r="2" />
      <circle cx="27" cy="29.5" r="2" />
    </svg>
  );
}

/** Fleche entre deux etapes. Horizontale sur grand ecran, verticale sinon. */
export function FlecheEtape({ className }: { className?: string }) {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable={false}
      className={className}
    >
      <path d="M5 14h18" />
      <path d="M17 8l6 6-6 6" />
    </svg>
  );
}
