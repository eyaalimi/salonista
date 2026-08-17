import Link from "next/link";

export function PromoBanner() {
  return (
    <Link
      href="/offres"
      className="ds-press ds-focus mx-4 mt-3 flex items-center justify-between gap-3 rounded-[var(--radius-panel)] bg-prune p-4"
    >
      <div className="min-w-0">
        <p className="text-base font-semibold text-white">🔥 Offres du weekend</p>
        <p className="mt-0.5 text-sm text-white/70">
          Jusqu&apos;à -50% sur hammam &amp; coiffure
        </p>
      </div>
      <span className="ds-press shrink-0 rounded-[var(--radius-pill)] bg-rose px-4 py-2 text-sm font-semibold text-white">
        Voir tout
      </span>
    </Link>
  );
}
