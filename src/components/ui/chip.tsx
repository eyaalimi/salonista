import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Chip de categorie du feed.
 *
 * Rend un <Link> et non un <button> : ce sont des liens de navigation vers
 * /offres?category=…, et un bouton casserait l'ouverture dans un nouvel
 * onglet comme l'indexation.
 */
export function Chip({
  href,
  active = false,
  children,
}: {
  href: string;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        "ds-press ds-focus shrink-0 inline-flex items-center gap-1.5 " +
        // 44px de cible tactile : la regle du design system.
        "min-h-[44px] px-4 rounded-[var(--radius-pill)] text-sm font-semibold " +
        (active
          ? "bg-rose text-white"
          : "bg-white text-prune border-2 border-hairline hover:border-rose")
      }
    >
      {children}
    </Link>
  );
}
