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
        {leading && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-5 flex items-center text-base text-prune-soft"
          >
            {leading}
          </div>
        )}
        <input
          id={id}
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
