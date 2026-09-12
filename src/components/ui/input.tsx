"use client";

import type { InputHTMLAttributes, ReactNode } from "react";

/**
 * Champ de saisie du design system 2026.
 *
 * Pill, bordure fine, focus en anneau rose. Le corps fait 16px : en dessous,
 * iOS zoome automatiquement au focus, ce qui casse la mise en page.
 */
export function Input({
  label,
  id,
  leading,
  trailing,
  className = "",
  /* Extrait du reste : `{...props}` est etale APRES nos attributs, il
     ecraserait sinon le `aria-describedby` qui decrit le prefixe. */
  "aria-describedby": describedBy,
  ...props
}: {
  label: string;
  id: string;
  /**
   * Prefixe fixe, colle au bord gauche du champ — un indicatif telephonique
   * par exemple. Il n'est PAS dans la valeur saisie : la personne tape les
   * huit chiffres, le code pays reste affiche a cote.
   */
  leading?: ReactNode;
  trailing?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="text-xs font-semibold uppercase tracking-[0.12em] text-prune-soft"
      >
        {label}
      </label>
      <div className="relative flex items-center">
        {/* Le prefixe n'est PAS `aria-hidden` : il porte le format attendu
            (un indicatif pays, par exemple). Masque, un lecteur d'ecran
            annoncerait « Ton telephone » sans dire quel numero on attend. Il
            est lie au champ par `aria-describedby`, donc lu apres le libelle
            plutot qu'a la place. */}
        {leading && (
          <div
            id={`${id}-leading`}
            className="pointer-events-none absolute left-5 flex items-center text-base text-prune-soft"
          >
            {leading}
          </div>
        )}
        <input
          id={id}
          /* Un `aria-describedby` fourni par l'appelant est conserve : le
             prefixe s'y ajoute au lieu de l'ecraser. */
          aria-describedby={
            [leading ? `${id}-leading` : null, describedBy]
              .filter(Boolean)
              .join(" ") || undefined
          }
          className={
            "ds-focus w-full min-h-[52px] px-5 text-base text-prune " +
            "rounded-[var(--radius-pill)] border-2 border-hairline bg-white " +
            "placeholder:text-prune-soft/50 " +
            (leading ? "pl-[4.5rem] " : "") +
            (trailing ? "pr-14 " : "") +
            className
          }
          {...props}
        />
        {trailing && (
          <div className="absolute right-4 flex items-center">{trailing}</div>
        )}
      </div>
    </div>
  );
}
