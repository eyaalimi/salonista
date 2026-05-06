import Link from "next/link";

export function PromoBanner() {
  return (
    <Link
      href="/offres"
      className="mx-4 mt-3 flex items-center justify-between gap-3 rounded-2xl bg-brand-ink p-4 transition-opacity hover:opacity-90"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#FBFAF7]">🔥 Offres du weekend</p>
        <p className="mt-0.5 text-xs text-brand-gold-soft">
          Jusqu&apos;à -50% sur hammam &amp; coiffure
        </p>
      </div>
      <span className="shrink-0 rounded-full bg-brand-gold px-3 py-1.5 text-xs font-semibold text-brand-ink">
        Voir tout
      </span>
    </Link>
  );
}
