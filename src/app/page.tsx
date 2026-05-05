import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { HomeNav } from "@/components/home-nav";
import { Logo } from "@/components/logo";
import { UploadedImage } from "@/components/uploaded-image";

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

      {/* HERO — split, bounded image, search on the left */}
      <section className="bg-brand-sand pt-20 md:pt-24">
        <div className="max-w-7xl mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Left: copy + search */}
          <div className="py-12 lg:py-20">
            <h1 className="luxury-heading text-4xl md:text-6xl lg:text-7xl text-brand-ink mb-3 luxury-slide-up">
              Casse la routine.
            </h1>
            <h2 className="luxury-heading text-4xl md:text-6xl lg:text-7xl text-brand-ink mb-8 luxury-slide-up delay-200">
              Réserve <span className="italic text-brand-gold">ton moment.</span>
            </h2>

            <p className="text-base text-brand-ink-soft mb-8 max-w-md luxury-slide-up delay-400">
              Coiffure, esthétique, onglerie, massage — partout en Tunisie.
            </p>

            <form action="/offres" method="GET" className="space-y-3 max-w-md luxury-slide-up delay-500">
              <div className="relative">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-ink-soft" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  name="q"
                  placeholder="Rechercher des soins / salons"
                  className="w-full pl-12 pr-5 py-4 text-sm text-brand-ink placeholder:text-brand-ink-soft/60 bg-white border border-brand-line rounded-md focus:outline-none focus:border-brand-gold transition-colors"
                />
              </div>

              <div className="relative">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-ink-soft" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <input
                  type="text"
                  name="city"
                  placeholder="Ville ou quartier"
                  className="w-full pl-12 pr-5 py-4 text-sm text-brand-ink placeholder:text-brand-ink-soft/60 bg-white border border-brand-line rounded-md focus:outline-none focus:border-brand-gold transition-colors"
                />
              </div>

              <button
                type="submit"
                className="w-full px-6 py-4 text-sm font-medium tracking-wide bg-brand-ink text-white hover:bg-brand-gold transition-colors duration-300 rounded-md"
              >
                Je recherche
              </button>
            </form>

            {/* Quick category chips */}
            {categoryData.length > 0 && (
              <div className="flex gap-2 mt-8 flex-wrap luxury-slide-up delay-600">
                {categoryData.slice(0, 5).map((cat) => (
                  <Link
                    key={cat.key}
                    href={`/offres?category=${cat.key}`}
                    className="px-4 py-2 text-xs bg-white border border-brand-line text-brand-ink-soft hover:border-brand-gold hover:text-brand-ink transition-all duration-300 rounded-full"
                  >
                    {categoryEmoji[cat.key]} {cat.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Right: bounded hero image */}
          <div className="relative h-[420px] md:h-[520px] lg:h-[620px] order-first lg:order-last -mx-6 md:-mx-12 lg:mx-0">
            <UploadedImage
              src="/uploads/hero-beauty.jpg"
              alt=""
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
              priority
            />
          </div>
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
                      <UploadedImage
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
                        <UploadedImage
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
