import type { ReactNode } from "react";

/**
 * Pastille d'information.
 *
 * `menthe` est reserve a la disponibilite, aux economies, aux commissions et
 * aux confirmations — jamais a une action neutre ou destructrice.
 * `rose` sert aux remises.
 *
 * Le texte sur menthe utilise menthe-deep : le menthe pur n'a pas assez de
 * contraste pour etre lisible.
 */
export function Badge({
  tone = "menthe",
  children,
}: {
  tone?: "menthe" | "rose" | "prune";
  children: ReactNode;
}) {
  const tones: Record<string, string> = {
    menthe: "bg-menthe text-menthe-deep",
    rose: "bg-rose text-white",
    prune: "bg-prune text-white",
  };

  return (
    <span
      className={
        "inline-flex items-center rounded-[var(--radius-pill)] px-3 py-1 " +
        "text-xs font-bold uppercase tracking-wide " +
        tones[tone]
      }
    >
      {children}
    </span>
  );
}
