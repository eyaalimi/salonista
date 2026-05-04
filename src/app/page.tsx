import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { HomeNav } from "@/components/home-nav";
import { Logo } from "@/components/logo";

const categoryLabels: Record<string, string> = {
  COIFFURE: "Coiffure",
  ESTHETIQUE: "Esthétique",
  ONGLERIE: "Onglerie",
  MASSAGE: "Massage",
  PARFUMERIE: "Parfumerie",
  AUTRE: "Autre",
};

const categoryEmoji: Record<string, string> = {
  COIFFURE: "✂️",
  ESTHETIQUE: "✨",
  ONGLERIE: "💅",
  MASSAGE: "🧖‍♀️",
  PARFUMERIE: "🌸",
  AUTRE: "💄",
};

export default async function Home() {
  const [offers, stats, topSalons, categories] = await Promise.all([
    prisma.offer.findMany({
      where: { active: true },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: {
        provider: { select: { salonName: true, city: true } },
      },
    }),
    Promise.all([
      prisma.providerProfile.count(),
      prisma.offer.count({ where: { active: true } }),
      prisma.booking.count(),
    ]),
    prisma.providerProfile.findMany({
      take: 8,
      include: {
        _count: { select: { offers: true } },
        offers: {
          where: { active: true, photos: { isEmpty: false } },
          take: 1,
          select: { photos: true },
        },
      },
      orderBy: { offers: { _count: "desc" } },
    }),
    prisma.offer.groupBy({
      by: ["category"],
      where: { active: true },
      _count: true,
    }),
  ]);

  const [providerCount, offerCount, bookingCount] = stats;

  const categoryData = Object.keys(categoryLabels).map((key) => ({
    key,
    label: categoryLabels[key],
    count: categories.find((c) => c.category === key)?._count || 0,
  })).filter((c) => c.count > 0);

  return (
    <div className="min-h-screen bg-brand-cream">
      <HomeNav />

      {/* HERO — full-bleed, minimal copy, instant search */}
      <section className="relative h-[90vh] min-h-[600px] overflow-hidden">
        <Image
          src="/uploads/hero-beauty.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-bordeaux/30 via-brand-bordeaux/20 to-brand-bordeaux/70" />

        <div className="relative h-full max-w-5xl mx-auto px-6 md:px-12 flex flex-col items-center justify-center text-center pt-16">
          <p className="text-[10px] md:text-xs tracking-[0.3em] uppercase text-white/80 mb-6 luxury-slide-up">
            Salonista · Tunisie
          </p>
          <h1 className="luxury-heading text-5xl md:text-7xl lg:text-8xl text-white mb-4 luxury-slide-up delay-200">
            Réservez votre
            <br />
            <span className="italic text-brand-gold-light">moment.</span>
          </h1>

          <form
            action="/offres"
            method="GET"
            className="w-full max-w-xl mt-10 luxury-slide-up delay-400"
          >
            <div className="flex bg-white/95 backdrop-blur-md shadow-2xl">
              <input
                type="text"
                name="q"
                placeholder="Coiffure, manucure, massage…"
                className="flex-1 px-6 py-5 text-sm text-brand-bordeaux placeholder:text-brand-bordeaux/40 bg-transparent focus:outline-none"
              />
              <button
                type="submit"
                className="px-8 py-5 bg-brand-bordeaux text-white hover:bg-brand-gold transition-colors duration-500"
                aria-label="Rechercher"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </form>

          {/* Quick category chips */}
          {categoryData.length > 0 && (
            <div className="flex gap-2 md:gap-3 mt-6 flex-wrap justify-center luxury-slide-up delay-600">
              {categoryData.slice(0, 5).map((cat) => (
                <Link
                  key={cat.key}
                  href={`/offres?category=${cat.key}`}
                  className="px-4 md:px-5 py-2 text-[11px] md:text-xs tracking-wider uppercase bg-white/15 backdrop-blur-md border border-white/30 text-white hover:bg-white hover:text-brand-bordeaux transition-all duration-500"
                >
                  {categoryEmoji[cat.key]} {cat.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/70 text-[10px] tracking-[0.3em] uppercase animate-pulse">
          Découvrir ↓
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="border-y border-brand-gold/15 bg-white py-8">
        <div className="max-w-5xl mx-auto px-6 md:px-12 grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="luxury-heading text-2xl md:text-3xl text-brand-bordeaux">
              {offerCount > 0 ? `${offerCount}+` : "200+"}
            </p>
            <p className="text-[9px] md:text-[10px] tracking-[0.2em] uppercase text-brand-bordeaux/40 mt-1">Offres</p>
          </div>
          <div className="border-x border-brand-gold/15">
            <p className="luxury-heading text-2xl md:text-3xl text-brand-bordeaux">
              {providerCount > 0 ? `${providerCount}+` : "50+"}
            </p>
            <p className="text-[9px] md:text-[10px] tracking-[0.2em] uppercase text-brand-bordeaux/40 mt-1">Salons</p>
          </div>
          <div>
            <p className="luxury-heading text-2xl md:text-3xl text-brand-bordeaux">
              {bookingCount > 0 ? `${bookingCount}+` : "1K+"}
            </p>
            <p className="text-[9px] md:text-[10px] tracking-[0.2em] uppercase text-brand-bordeaux/40 mt-1">Réservations</p>
          </div>
        </div>
      </section>

      {/* THE FEED — main attraction */}
      {offers.length > 0 && (
        <section id="offres" className="py-16 md:py-24">
          <div className="max-w-7xl mx-auto px-4 md:px-12">
            <div className="flex items-end justify-between mb-10">
              <div>
                <p className="text-[10px] tracking-[0.3em] uppercase text-brand-gold mb-2">Le feed</p>
                <h2 className="luxury-heading text-3xl md:text-5xl text-brand-bordeaux">
                  Tendances <span className="italic">du moment</span>
                </h2>
              </div>
              <Link
                href="/offres"
                className="hidden md:inline-flex items-center gap-2 text-[11px] tracking-[0.2em] uppercase text-brand-bordeaux/60 hover:text-brand-gold transition-colors"
              >
                Tout voir →
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-4">
              {offers.map((offer, idx) => {
                const discount = Math.round(
                  ((Number(offer.originalPrice) - Number(offer.discountPrice)) /
                    Number(offer.originalPrice)) *
                    100
                );
                // Mix portrait + square for visual rhythm
                const isPortrait = idx % 5 === 0 || idx % 5 === 3;
                return (
                  <Link
                    key={offer.id}
                    href={`/offre/${offer.id}`}
                    className={`group relative overflow-hidden bg-gradient-to-br from-brand-nude to-brand-peach ${
                      isPortrait ? "aspect-[3/4] md:row-span-2" : "aspect-square"
                    }`}
                  >
                    {offer.photos.length > 0 ? (
                      <Image
                        src={offer.photos[0]}
                        alt={offer.title}
                        fill
                        sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-1000"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-6xl opacity-40">
                        {categoryEmoji[offer.category]}
                      </div>
                    )}

                    {/* Gradient overlay always — content readable */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-90 group-hover:opacity-100 transition-opacity" />

                    {/* Discount badge */}
                    {discount > 0 && (
                      <div className="absolute top-3 right-3 px-2.5 py-1 bg-brand-gold text-white text-[10px] md:text-xs font-bold tracking-wide">
                        -{discount}%
                      </div>
                    )}

                    {/* Bottom info */}
                    <div className="absolute bottom-0 left-0 right-0 p-3 md:p-4 text-white">
                      <p className="text-[9px] md:text-[10px] tracking-[0.15em] uppercase opacity-70 mb-1 line-clamp-1">
                        {offer.provider.salonName}
                        {offer.provider.city && ` · ${offer.provider.city}`}
                      </p>
                      <h3 className="luxury-heading text-sm md:text-base leading-tight mb-2 line-clamp-2">
                        {offer.title}
                      </h3>
                      <div className="flex items-baseline gap-2">
                        <span className="luxury-heading text-lg md:text-xl text-brand-gold-light">
                          {Number(offer.discountPrice).toFixed(0)} DT
                        </span>
                        <span className="text-xs opacity-50 line-through">
                          {Number(offer.originalPrice).toFixed(0)}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            <div className="text-center mt-12 md:hidden">
              <Link
                href="/offres"
                className="inline-block px-10 py-4 text-xs tracking-[0.2em] uppercase bg-brand-bordeaux text-white"
              >
                Voir toutes les offres
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* SALONS — visual cards */}
      {topSalons.length > 0 && (
        <section id="salons" className="py-16 md:py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 md:px-12">
            <div className="flex items-end justify-between mb-10">
              <div>
                <p className="text-[10px] tracking-[0.3em] uppercase text-brand-gold mb-2">Salons</p>
                <h2 className="luxury-heading text-3xl md:text-5xl text-brand-bordeaux">
                  Nos <span className="italic">favoris</span>
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
              {topSalons.map((salon) => {
                const cover = salon.offers[0]?.photos[0];
                return (
                  <Link
                    key={salon.id}
                    href={`/salon/${salon.id}`}
                    className="group block"
                  >
                    <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-brand-nude to-brand-peach mb-3">
                      {cover ? (
                        <Image
                          src={cover}
                          alt={salon.salonName}
                          fill
                          sizes="(max-width: 768px) 50vw, 25vw"
                          className="object-cover group-hover:scale-105 transition-transform duration-1000"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="luxury-heading text-5xl text-brand-bordeaux/30">
                            {salon.salonName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <h3 className="luxury-heading text-base md:text-lg text-brand-bordeaux group-hover:text-brand-gold transition-colors line-clamp-1">
                      {salon.salonName}
                    </h3>
                    <p className="text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/40 mt-1">
                      {salon.city || "Tunisie"} · {salon._count.offers} offre{salon._count.offers > 1 ? "s" : ""}
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* PRO CTA — minimal, dual */}
      <section className="py-16 md:py-24 bg-brand-bordeaux text-white">
        <div className="max-w-7xl mx-auto px-6 md:px-12 grid md:grid-cols-2 gap-1 md:gap-1">
          <Link
            href="/register"
            className="group p-10 md:p-14 border border-white/10 hover:bg-white/5 transition-colors"
          >
            <p className="text-[10px] tracking-[0.3em] uppercase text-brand-gold-light mb-3">Prestataire</p>
            <h3 className="luxury-heading text-2xl md:text-4xl mb-4">
              Vous avez un <span className="italic">salon</span> ?
            </h3>
            <p className="text-sm text-white/60 mb-6 max-w-sm">
              Recevez des réservations qualifiées chaque jour.
            </p>
            <span className="inline-flex items-center gap-2 text-[11px] tracking-[0.2em] uppercase text-brand-gold-light group-hover:gap-4 transition-all">
              Rejoindre →
            </span>
          </Link>
          <Link
            href="/register"
            className="group p-10 md:p-14 border border-white/10 hover:bg-white/5 transition-colors"
          >
            <p className="text-[10px] tracking-[0.3em] uppercase text-brand-gold-light mb-3">Influenceuse</p>
            <h3 className="luxury-heading text-2xl md:text-4xl mb-4">
              Monétisez votre <span className="italic">audience</span>
            </h3>
            <p className="text-sm text-white/60 mb-6 max-w-sm">
              10% de commission sur chaque réservation.
            </p>
            <span className="inline-flex items-center gap-2 text-[11px] tracking-[0.2em] uppercase text-brand-gold-light group-hover:gap-4 transition-all">
              Devenir partenaire →
            </span>
          </Link>
        </div>
      </section>

      {/* FOOTER — slim */}
      <footer className="bg-brand-ink text-white border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <Logo tone="light" className="text-2xl" />
          <div className="flex items-center gap-6 md:gap-8 text-[11px] tracking-[0.2em] uppercase text-white/50">
            <Link href="/offres" className="hover:text-brand-gold transition-colors">Offres</Link>
            <Link href="/login" className="hover:text-brand-gold transition-colors">Connexion</Link>
            <Link href="/register" className="hover:text-brand-gold transition-colors">Inscription</Link>
          </div>
          <p className="text-[10px] text-white/30 tracking-wider">© 2026 · Fait en Tunisie</p>
        </div>
      </footer>

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "Salonista",
            url: process.env.NEXTAUTH_URL || "https://salonista.tn",
            description: "Réservez vos soins beauté en ligne, partout en Tunisie.",
            potentialAction: {
              "@type": "SearchAction",
              target: `${process.env.NEXTAUTH_URL || "https://salonista.tn"}/offres?q={search_term_string}`,
              "query-input": "required name=search_term_string",
            },
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Salonista",
            url: process.env.NEXTAUTH_URL || "https://salonista.tn",
            description: "Marketplace beauté en Tunisie",
            areaServed: { "@type": "Country", name: "Tunisia" },
          }),
        }}
      />
    </div>
  );
}
