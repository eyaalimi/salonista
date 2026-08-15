"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Bouton du design system 2026.
 *
 * Tout ce qui est cliquable est une pill. Aucune ombre : la hierarchie passe
 * par la couleur. Une seule action `primary` (rose) par vue — au-dela, l'oeil
 * ne sait plus ou aller.
 */
export function Button({
  variant = "primary",
  fullWidth = false,
  children,
  className = "",
  ...props
}: {
  variant?: "primary" | "secondary" | "ghost";
  fullWidth?: boolean;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const base =
    "ds-press ds-focus inline-flex items-center justify-center gap-2 " +
    // 44px minimum : cible tactile confortable au doigt.
    "min-h-[48px] px-6 rounded-[var(--radius-pill)] " +
    "text-base font-semibold border-2 border-transparent";

  const variants: Record<string, string> = {
    primary: "bg-rose text-white hover:bg-[#F04A79]",
    secondary: "bg-prune text-white hover:bg-[#4E1832]",
    ghost: "bg-transparent text-prune border-hairline hover:bg-creme",
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
