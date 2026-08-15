import type { ReactNode } from "react";

/**
 * Conteneur de carte du design system.
 *
 * AUCUNE ombre : la carte se detache par sa couleur (blanc sur creme), pas
 * par une elevation. C'est la regle du design system, et elle vaut aussi
 * pour les cartes cliquables.
 */
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-[var(--radius-card)] bg-white ${className}`}
    >
      {children}
    </div>
  );
}
