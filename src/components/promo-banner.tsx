import Link from "next/link";

export function PromoBanner() {
  return (
    // Meme enveloppe que les sections de la page d'accueil : `max-w-6xl` et
    // une gouttiere `px-4`. Sans limite de largeur, la banniere s'etirait sur
    // tout l'ecran alors que les feeds s'arretaient plus tot — d'ou un
    // decalage visible entre les blocs sur ordinateur.
    <div className="mx-auto max-w-6xl px-4">
      <Link
        href="/offres"
        className="ds-press ds-focus mt-3 flex items-center justify-between gap-3 rounded-[var(--radius-panel)] bg-prune p-4"
      >
        <div className="min-w-0">
          <p className="text-base font-semibold text-white">🔥 Offres du weekend</p>
          <p className="mt-0.5 text-sm text-white/70">
            Jusqu&apos;à -50% sur hammam &amp; coiffure
          </p>
        </div>
        {/* Traitement secondaire, pas `bg-rose` : le rose plein est reserve au
            CTA professionnel plus bas. Cette banniere et le CTA pro peuvent se
            voir ensemble au defilement — trois pilules roses se concurrenceraient. */}
        <span className="ds-press shrink-0 rounded-[var(--radius-pill)] bg-rose-soft px-4 py-2 text-sm font-semibold text-prune">
          Voir tout
        </span>
      </Link>
    </div>
  );
}
