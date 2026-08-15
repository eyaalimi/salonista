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
  trailing,
  className = "",
  ...props
}: {
  label: string;
  id: string;
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
        <input
          id={id}
          className={
            "ds-focus w-full min-h-[52px] px-5 text-base text-prune " +
            "rounded-[var(--radius-pill)] border-2 border-hairline bg-white " +
            "placeholder:text-prune-soft/50 " +
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
