import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import Image from "next/image";
import { NavAccount } from "@/components/nav-account";
import { Logo } from "@/components/logo";

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
    },
    orderBy: { createdAt: "desc" },
    include: {
      provider: { select: { salonName: true, city: true } },
    },
  });

  return (
    <div className="min-h-screen bg-brand-cream">
      {/* Nav */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-brand-gold/15 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex items-center justify-between h-16">
          <Logo className="text-xl" />
          <NavAccount />
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
        <div className="text-center mb-12">
          <p className="luxury-badge mb-6">Collection</p>
          <h1 className="luxury-heading text-3xl md:text-5xl text-brand-bordeaux mb-4">
            {q ? (
              <>R&eacute;sultats pour <span className="italic">&laquo; {q} &raquo;</span></>
            ) : category ? (
              <>{categoryLabels[category] || category}</>
            ) : (
              <>Nos offres <span className="italic">beaut&eacute;</span></>
            )}
          </h1>
          <p className="text-brand-bordeaux/50 mt-4 max-w-md mx-auto">
            {offers.length} offre{offers.length > 1 ? "s" : ""} disponible{offers.length > 1 ? "s" : ""}
          </p>
          <div className="luxury-divider mt-6" />
        </div>

        {/* Search + Filters */}
        <div className="mb-12 space-y-4">
          <form action="/offres" method="GET" className="flex bg-white border border-brand-gold/20 overflow-hidden max-w-2xl mx-auto">
            <input
              type="text"
              name="q"
              defaultValue={q || ""}
              placeholder="Rechercher un service, un salon, une ville..."
              className="flex-1 px-6 py-3.5 text-sm text-brand-bordeaux placeholder:text-brand-bordeaux/30 bg-transparent focus:outline-none"
            />
            <button
              type="submit"
              className="px-6 py-3.5 text-xs tracking-[0.2em] uppercase bg-brand-bordeaux text-white hover:bg-brand-gold transition-colors duration-500"
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
                className="group luxury-card overflow-hidden"
              >
                <div className="relative aspect-[4/5] overflow-hidden bg-gradient-to-br from-brand-nude to-brand-peach flex items-center justify-center">
                  {offer.photos.length > 0 ? (
                    <Image src={offer.photos[0]} alt={offer.title} fill sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover group-hover:scale-105 transition-transform duration-[1.2s]" />
                  ) : (
                    <span className="text-6xl opacity-30 group-hover:scale-110 transition-transform duration-[1.2s]">
                      💇‍♀️
                    </span>
                  )}
                  <div className="absolute top-4 left-4">
                    <span className="luxury-badge text-[10px] bg-white/90 backdrop-blur-sm">
                      {categoryLabels[offer.category] || offer.category}
                    </span>
                  </div>
                </div>
                <div className="p-5 md:p-6">
                  <p className="text-[10px] tracking-[0.2em] uppercase text-brand-bordeaux/40 mb-2">
                    {offer.provider.salonName}
                    {offer.provider.city && ` — ${offer.provider.city}`}
                  </p>
                  <h3 className="luxury-heading text-lg text-brand-bordeaux mb-3 group-hover:text-brand-gold transition-colors duration-500">
                    {offer.title}
                  </h3>
                  <div className="flex items-baseline gap-3">
                    <span className="luxury-heading text-xl text-brand-gold">
                      {Number(offer.discountPrice).toFixed(0)} DT
                    </span>
                    <span className="text-sm text-brand-bordeaux/30 line-through">
                      {Number(offer.originalPrice).toFixed(0)} DT
                    </span>
                    <span className="ml-auto text-[10px] tracking-[0.15em] uppercase text-brand-gold font-medium">
                      -{discount}%
                    </span>
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
