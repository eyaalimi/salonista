import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { UploadedImage } from "@/components/uploaded-image";
import { NavAccount } from "@/components/nav-account";
import { Logo } from "@/components/logo";
import { Chip } from "@/components/ui/chip";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Offres",
  description:
    "Toutes les offres beauté en Tunisie : coiffure, esthétique, onglerie, massage. Jusqu'à -70% dans les meilleurs salons.",
  openGraph: {
    title: "Offres — Salonista",
    description: "Les meilleures offres beauté en Tunisie. Réservez en ligne.",
  },
};

const categoryLabels: Record<string, string> = {
  COIFFURE: "Coiffure",
  ESTHETIQUE: "Esthétique",
  ONGLERIE: "Onglerie",
  MASSAGE: "Massage",
  PARFUMERIE: "Parfumerie",
  AUTRE: "Autre",
};

export default async function OffresPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { q, category } = await searchParams;

  const offers = await prisma.offer.findMany({
    where: {
      active: true,
      publishedToMarketplace: true,
      photos: { isEmpty: false },
      ...(category ? { category: category as never } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" as const } },
              { description: { contains: q, mode: "insensitive" as const } },
              { provider: { salonName: { contains: q, mode: "insensitive" as const } } },
              { provider: { city: { contains: q, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    } as never,
    orderBy: { createdAt: "desc" },
    include: {
      provider: { select: { salonName: true, city: true } },
    },
  });

  return (
    <div className="min-h-screen bg-creme">
      {/* Nav */}
      <nav className="bg-creme border-b border-hairline sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-5 md:px-12 flex items-center justify-between h-16">
          <Logo className="text-xl" />
          <NavAccount />
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
        <div className="text-center mb-10 flex flex-col gap-2">
          <h1 className="ds-display text-3xl md:text-4xl text-prune">
            {q ? (
              <>Résultats pour « {q} »</>
            ) : category ? (
              <>{categoryLabels[category] || category}</>
            ) : (
              <>Nos offres beauté</>
            )}
          </h1>
          <p className="text-base text-prune-soft">
            {offers.length} offre{offers.length > 1 ? "s" : ""} disponible{offers.length > 1 ? "s" : ""}
          </p>
        </div>

        {/* Search + Filters */}
        <div className="mb-12 space-y-4">
          <form action="/offres" method="GET" className="mx-auto flex max-w-2xl overflow-hidden rounded-2xl border border-brand-gold-soft bg-brand-sand">
            <input
              type="text"
              name="q"
              defaultValue={q || ""}
              placeholder="Cherche un soin, un salon..."
              className="flex-1 bg-transparent px-5 py-3 text-base text-brand-ink placeholder:text-brand-ink-soft/70 focus:outline-none"
            />
            <button
              type="submit"
              className="bg-brand-ink px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-gold"
            >
              Rechercher
            </button>
          </form>

          <div className="flex gap-2 justify-center flex-wrap">
            <Link
              href="/offres"
              className={`px-4 py-2 text-[10px] tracking-[0.15em] uppercase font-medium transition-colors duration-500 ${
                !category ? "bg-brand-bordeaux text-white" : "border border-brand-gold/20 text-brand-bordeaux/60 hover:border-brand-gold"
              }`}
            >
              Toutes
            </Link>
            {Object.entries(categoryLabels).map(([key, label]) => (
              <Link
                key={key}
                href={`/offres?category=${key}`}
                className={`px-4 py-2 text-[10px] tracking-[0.15em] uppercase font-medium transition-colors duration-500 ${
                  category === key ? "bg-brand-bordeaux text-white" : "border border-brand-gold/20 text-brand-bordeaux/60 hover:border-brand-gold"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {offers.map((offer) => {
            const discount = Math.round(
              ((Number(offer.originalPrice) - Number(offer.discountPrice)) /
                Number(offer.originalPrice)) *
                100
            );
            return (
              <Link
                key={offer.id}
                href={`/offre/${offer.id}`}
                className="group flex min-h-[80px] flex-col overflow-hidden rounded-2xl border border-brand-line bg-white transition-shadow hover:shadow-md"
              >
                <div className="relative aspect-[4/5] overflow-hidden bg-gradient-to-br from-brand-sand to-brand-gold-soft/40">
                  {offer.photos.length > 0 ? (
                    <UploadedImage src={offer.photos[0]} alt={offer.title} fill sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-6xl opacity-30">
                      💇‍♀️
                    </div>
                  )}
                  <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-[11px] font-semibold text-brand-ink backdrop-blur-sm">
                    {categoryLabels[offer.category] || offer.category}
                  </span>
                  {discount > 0 && (
                    <span className="absolute right-3 top-3 rounded-full bg-brand-ink px-3 py-1 text-xs font-bold text-[#FBFAF7]">
                      -{discount}%
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-4 sm:p-5">
                  <p className="line-clamp-1 text-sm font-medium text-brand-ink">
                    {offer.provider.salonName}
                  </p>
                  {offer.provider.city && (
                    <p className="line-clamp-1 text-xs text-brand-ink-soft">
                      📍 {offer.provider.city}
                    </p>
                  )}
                  <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-brand-ink">
                    {offer.title}
                  </h3>
                  <div className="mt-auto pt-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-base font-bold text-brand-gold">
                        {Number(offer.discountPrice).toFixed(0)} DT
                      </span>
                      {Number(offer.originalPrice) > Number(offer.discountPrice) && (
                        <span className="text-xs text-gray-400 line-through">
                          {Number(offer.originalPrice).toFixed(0)} DT
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[9px] uppercase tracking-[0.15em] text-brand-bordeaux/40">
                      TVA incluse: {Number(offer.taxRate ?? 19)}%
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {offers.length === 0 && (
          <p className="text-center text-brand-bordeaux/40 py-20 text-sm tracking-wider">
            Aucune offre disponible pour le moment.
          </p>
        )}
      </div>
    </div>
  );
}
