import Link from "next/link";
import { Lock } from "lucide-react";
import { PRIX_PREMIUM_LIBELLE } from "./contenu";

/**
 * Page affichee a la place d'une fonction Premium en version gratuite. Les
 * donnees ne sont pas perdues : elles reapparaissent au passage au Premium,
 * et la page le dit — sinon la gerante croit avoir tout perdu.
 */
export function PageVerrouilleePremium({
  titre,
  explication,
  points,
}: {
  titre: string;
  explication: string;
  points: string[];
}) {
  return (
    <div className="h-full overflow-y-auto bg-pos-bg p-4 md:p-8">
      <div className="mx-auto max-w-2xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-pos-border bg-pos-surface px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-pos-ink-3">
          <Lock size={12} />
          Premium
        </span>
        <h1 className="mt-4 text-2xl font-semibold text-pos-ink md:text-3xl">{titre}</h1>
        <p className="mt-3 text-sm leading-relaxed text-pos-ink-2">{explication}</p>
        <ul className="mt-6 space-y-2">
          {points.map((p) => (
            <li key={p} className="flex gap-2 text-sm text-pos-ink">
              <span aria-hidden="true" className="text-pos-accent">✓</span>
              {p}
            </li>
          ))}
        </ul>
        <p className="mt-6 rounded-xl border border-pos-border bg-pos-surface p-4 text-sm text-pos-ink-2">
          Vos données sont conservées. Elles réapparaissent dès le passage au Premium.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Link
            href="/pos/premium"
            className="rounded-lg bg-pos-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-pos-accent/90"
          >
            Passer au Premium
          </Link>
          <span className="pos-mono text-sm text-pos-ink-2">{PRIX_PREMIUM_LIBELLE}</span>
        </div>
      </div>
    </div>
  );
}
