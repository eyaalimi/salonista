import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { HomeNav } from "@/components/home-nav";

const categoryLabels: Record<string, string> = {
  COIFFURE: "Coiffure",
  ESTHETIQUE: "Esthétique",
  ONGLERIE: "Onglerie",
  MASSAGE: "Massage",
  PARFUMERIE: "Parfumerie",
  AUTRE: "Autre",
};

const categoryIcons: Record<string, string> = {
  COIFFURE: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z",
  ESTHETIQUE: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  ONGLERIE: "M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z",
  MASSAGE: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
  PARFUMERIE: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z",
  AUTRE: "M13 10V3L4 14h7v7l9-11h-7z",
};

export default async function Home() {
  // Fetch data in parallel
  const [offers, stats, topSalons, categories] = await Promise.all([
    // Featured offers
    prisma.offer.findMany({
      where: { active: true },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        provider: { select: { salonName: true, city: true } },
      },
    }),
    // Dynamic stats
    Promise.all([
      prisma.providerProfile.count(),
      prisma.offer.count({ where: { active: true } }),
      prisma.booking.count(),
    ]),
    // Top salons (most bookings)
    prisma.providerProfile.findMany({
      take: 6,
      include: {
        _count: { select: { offers: true } },
        user: { select: { name: true } },
      },
      orderBy: { offers: { _count: "desc" } },
    }),
    // Category counts
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
      {/* Navbar */}
      <HomeNav />

      {/* Hero */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-cream via-brand-peach/30 to-brand-nude/20" />
        <div className="absolute top-20 right-0 w-1/2 h-full opacity-10">
          <div className="w-full h-full bg-[radial-gradient(circle_at_center,_var(--color-brand-gold)_0%,_transparent_70%)]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 md:px-12 pt-32 pb-20 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="luxury-badge luxury-slide-up mb-8">
              La beaut&eacute;, r&eacute;invent&eacute;e
            </p>

            <h1 className="luxury-heading text-5xl md:text-7xl text-brand-bordeaux luxury-slide-up delay-200 mb-6">
              Votre beaut&eacute; m&eacute;rite
              <br />
              <span className="italic text-brand-gold">l&apos;excellence</span>
            </h1>

            <p className="text-base md:text-lg text-brand-bordeaux/60 leading-relaxed luxury-slide-up delay-400 mb-10 max-w-lg">
              D&eacute;couvrez les meilleures offres beaut&eacute; en Tunisie, s&eacute;lectionn&eacute;es
              par vos influenceuses pr&eacute;f&eacute;r&eacute;es. R&eacute;servez en un clic.
            </p>

            {/* Search bar */}
            <div className="luxury-slide-up delay-500 mb-12">
              <form action="/offres" method="GET" className="flex bg-white border border-brand-gold/20 overflow-hidden">
                <input
                  type="text"
                  name="q"
                  placeholder="Rechercher un service, un salon, une ville..."
                  className="flex-1 px-6 py-4 text-sm text-brand-bordeaux placeholder:text-brand-bordeaux/30 bg-transparent focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-8 py-4 text-xs tracking-[0.2em] uppercase bg-brand-bordeaux text-white hover:bg-brand-gold transition-colors duration-500"
                >
                  Rechercher
                </button>
              </form>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 luxury-slide-up delay-600">
              <Link
                href="/offres"
                className="inline-flex items-center justify-center gap-2 px-10 py-4 text-xs tracking-[0.2em] uppercase bg-brand-bordeaux text-white hover:bg-brand-gold transition-colors duration-500 group"
              >
                D&eacute;couvrir les offres
                <svg className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center justify-center px-10 py-4 text-xs tracking-[0.2em] uppercase border border-brand-bordeaux/20 text-brand-bordeaux hover:border-brand-gold hover:text-brand-gold transition-all duration-500"
              >
                Je suis prestataire
              </Link>
            </div>

            {/* Dynamic stats */}
            <div className="flex gap-12 mt-20 luxury-slide-up delay-700">
              {[
                { value: providerCount > 0 ? `${providerCount}+` : "500+", label: "Prestataires" },
                { value: offerCount > 0 ? `${offerCount}+` : "2K+", label: "Offres actives" },
                { value: bookingCount > 0 ? `${bookingCount}+` : "15K+", label: "R\u00e9servations" },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="luxury-heading text-2xl md:text-3xl text-brand-bordeaux">{stat.value}</p>
                  <p className="text-[10px] tracking-[0.2em] uppercase text-brand-bordeaux/40 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Hero image */}
          <div className="hidden lg:block relative">
            <div className="relative aspect-[3/4] overflow-hidden bg-gradient-to-br from-brand-nude via-brand-peach/50 to-brand-gold/10">
              <Image
                src="/uploads/hero-beauty.jpg"
                alt="Beauté.tn — Soins de beauté en Tunisie"
                fill
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-cream/40 to-transparent" />
              <div className="absolute bottom-8 left-8 right-8 p-6 bg-white/80 backdrop-blur-sm border border-brand-gold/20">
                <p className="text-[10px] tracking-[0.2em] uppercase text-brand-gold mb-1">Excellence</p>
                <p className="text-sm text-brand-bordeaux/70">Les meilleurs soins beauté, sélectionnés pour vous</p>
              </div>
            </div>
          </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      {categoryData.length > 0 && (
        <section id="categories" className="py-20 md:py-28 bg-white">
          <div className="max-w-7xl mx-auto px-6 md:px-12">
            <div className="text-center mb-16">
              <p className="luxury-badge mb-6">Explorer</p>
              <h2 className="luxury-heading text-3xl md:text-5xl text-brand-bordeaux mb-4">
                Nos <span className="italic">cat&eacute;gories</span>
              </h2>
              <div className="luxury-divider mt-6" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-6">
              {categoryData.map((cat) => (
                <Link
                  key={cat.key}
                  href={`/offres?category=${cat.key}`}
                  className="group text-center p-6 md:p-8 border border-brand-gold/15 hover:border-brand-gold bg-brand-cream/50 hover:bg-brand-cream transition-all duration-500"
                >
                  <div className="w-14 h-14 mx-auto mb-4 border border-brand-gold/30 flex items-center justify-center group-hover:border-brand-gold group-hover:bg-brand-gold/5 transition-all duration-500">
                    <svg className="w-6 h-6 text-brand-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={categoryIcons[cat.key] || categoryIcons.AUTRE} />
                    </svg>
                  </div>
                  <h3 className="luxury-heading text-sm text-brand-bordeaux group-hover:text-brand-gold transition-colors duration-500">
                    {cat.label}
                  </h3>
                  <p className="text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/30 mt-1">
                    {cat.count} offre{cat.count > 1 ? "s" : ""}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* How it works */}
      <section id="comment" className="py-24 md:py-32 bg-brand-peach/30">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="text-center mb-16 md:mb-24">
            <p className="luxury-badge mb-6">Le parcours</p>
            <h2 className="luxury-heading text-3xl md:text-5xl text-brand-bordeaux mb-4">
              Simple <span className="italic">&amp; &eacute;l&eacute;gant</span>
            </h2>
            <div className="luxury-divider mt-6" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 md:gap-8">
            {[
              { num: "01", title: "D\u00e9couvrez", desc: "Parcourez les offres exclusives s\u00e9lectionn\u00e9es par vos influenceuses beaut\u00e9 pr\u00e9f\u00e9r\u00e9es." },
              { num: "02", title: "R\u00e9servez", desc: "Choisissez votre cr\u00e9neau et r\u00e9servez en quelques secondes, sans appel." },
              { num: "03", title: "Payez en ligne", desc: "Paiement s\u00e9curis\u00e9 en ligne. Recevez votre QR code de confirmation." },
              { num: "04", title: "Profitez", desc: "Pr\u00e9sentez votre QR code au salon et profitez de votre service." },
            ].map((step) => (
              <div key={step.num} className="text-center group">
                <div className="relative inline-flex items-center justify-center w-16 h-16 mb-6">
                  <div className="absolute inset-0 border border-brand-gold/30 transition-all duration-700 group-hover:border-brand-gold group-hover:scale-110" />
                  <span className="luxury-heading text-lg text-brand-gold">{step.num}</span>
                </div>
                <h3 className="luxury-heading text-xl mb-3 text-brand-bordeaux">{step.title}</h3>
                <p className="text-sm text-brand-bordeaux/50 leading-relaxed max-w-xs mx-auto">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured offers */}
      {offers.length > 0 && (
        <section id="offres" className="py-24 md:py-32 bg-white">
          <div className="max-w-7xl mx-auto px-6 md:px-12">
            <div className="text-center mb-16 md:mb-24">
              <p className="luxury-badge mb-6">S&eacute;lection</p>
              <h2 className="luxury-heading text-3xl md:text-5xl text-brand-bordeaux mb-4">
                Offres <span className="italic">exclusives</span>
              </h2>
              <div className="luxury-divider mt-6" />
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
                        <Image src={offer.photos[0]} alt={offer.title} fill className="object-cover group-hover:scale-105 transition-transform duration-[1.2s]" />
                      ) : (
                        <span className="text-6xl opacity-30 group-hover:scale-110 transition-transform duration-[1.2s]">
                          {offer.category === "COIFFURE" ? "\u2702\uFE0F" :
                           offer.category === "MASSAGE" ? "\u{1F9D6}" :
                           offer.category === "ONGLERIE" ? "\u{1F485}" :
                           offer.category === "PARFUMERIE" ? "\u{1F338}" :
                           "\u2728"}
                        </span>
                      )}
                      <div className="absolute top-4 left-4">
                        <span className="luxury-badge text-[10px] bg-white/90 backdrop-blur-sm">
                          {categoryLabels[offer.category] || offer.category}
                        </span>
                      </div>
                      <div className="absolute top-4 right-4">
                        <span className="px-3 py-1 text-[10px] tracking-[0.1em] uppercase font-medium bg-brand-bordeaux text-white">
                          -{discount}%
                        </span>
                      </div>
                    </div>
                    <div className="p-5 md:p-6">
                      <p className="text-[10px] tracking-[0.2em] uppercase text-brand-bordeaux/40 mb-2">
                        {offer.provider.salonName}
                        {offer.provider.city && ` \u2014 ${offer.provider.city}`}
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
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            <div className="text-center mt-16">
              <Link
                href="/offres"
                className="inline-flex items-center gap-2 px-10 py-4 text-xs tracking-[0.2em] uppercase border border-brand-bordeaux/20 text-brand-bordeaux hover:border-brand-gold hover:text-brand-gold transition-all duration-500 group"
              >
                Voir toutes les offres
                <svg className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Top salons */}
      {topSalons.length > 0 && (
        <section id="salons" className="py-24 md:py-32 bg-brand-cream">
          <div className="max-w-7xl mx-auto px-6 md:px-12">
            <div className="text-center mb-16">
              <p className="luxury-badge mb-6">Nos partenaires</p>
              <h2 className="luxury-heading text-3xl md:text-5xl text-brand-bordeaux mb-4">
                Salons <span className="italic">d&apos;exception</span>
              </h2>
              <div className="luxury-divider mt-6" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {topSalons.map((salon) => (
                <Link
                  key={salon.id}
                  href={`/salon/${salon.id}`}
                  className="group p-8 bg-white border border-brand-gold/15 hover:border-brand-gold transition-all duration-500"
                >
                  <div className="w-14 h-14 mb-5 bg-gradient-to-br from-brand-nude to-brand-peach flex items-center justify-center">
                    <span className="luxury-heading text-lg text-brand-bordeaux">
                      {salon.salonName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <h3 className="luxury-heading text-xl text-brand-bordeaux mb-1 group-hover:text-brand-gold transition-colors duration-500">
                    {salon.salonName}
                  </h3>
                  {salon.city && (
                    <p className="text-xs tracking-[0.15em] uppercase text-brand-bordeaux/40 mb-3">{salon.city}</p>
                  )}
                  <p className="text-sm text-brand-bordeaux/50">
                    {salon._count.offers} offre{salon._count.offers > 1 ? "s" : ""} disponible{salon._count.offers > 1 ? "s" : ""}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Testimonials */}
      <section className="py-24 md:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="text-center mb-16">
            <p className="luxury-badge mb-6">T&eacute;moignages</p>
            <h2 className="luxury-heading text-3xl md:text-5xl text-brand-bordeaux mb-4">
              Ce qu&apos;elles <span className="italic">en disent</span>
            </h2>
            <div className="luxury-divider mt-6" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                name: "Amira B.",
                role: "Cliente",
                city: "Tunis",
                text: "J\u2019ai d\u00e9couvert mon salon pr\u00e9f\u00e9r\u00e9 gr\u00e2ce \u00e0 Beaut\u00e9.tn. La r\u00e9servation en ligne est tellement pratique, plus besoin d\u2019appeler !",
              },
              {
                name: "Salon Nour",
                role: "Prestataire",
                city: "Sousse",
                text: "Depuis qu\u2019on est sur la plateforme, on re\u00e7oit 3x plus de r\u00e9servations. Le syst\u00e8me de QR code rassure nos clientes.",
              },
              {
                name: "Yasmine K.",
                role: "Influenceuse",
                city: "Sfax",
                text: "Je partage des offres beaut\u00e9 que j\u2019aime vraiment et je gagne une commission. C\u2019est gagnant-gagnant pour tout le monde.",
              },
            ].map((t) => (
              <div key={t.name} className="p-8 border border-brand-gold/15 hover:border-brand-gold/30 transition-colors duration-500">
                <svg className="w-8 h-8 text-brand-gold/30 mb-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10H14.017zM0 21v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151C7.563 6.068 6 8.789 6 11h4v10H0z" />
                </svg>
                <p className="text-brand-bordeaux/60 leading-relaxed mb-6 text-sm">{t.text}</p>
                <div className="border-t border-brand-gold/15 pt-4">
                  <p className="luxury-heading text-sm text-brand-bordeaux">{t.name}</p>
                  <p className="text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/40">
                    {t.role} &mdash; {t.city}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For providers & influencers */}
      <section className="py-24 md:py-32 bg-brand-cream">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="luxury-badge mb-6">Pour les professionnels</p>
              <h2 className="luxury-heading text-3xl md:text-5xl text-brand-bordeaux mb-6">
                D&eacute;veloppez votre
                <br />
                <span className="italic text-brand-gold">activit&eacute;</span>
              </h2>
              <p className="text-brand-bordeaux/60 leading-relaxed mb-10 max-w-lg">
                Rejoignez la premi&egrave;re marketplace beaut&eacute; en Tunisie. Cr&eacute;ez vos offres,
                laissez les influenceuses les promouvoir, et recevez des r&eacute;servations qualifi&eacute;es.
              </p>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-10 py-4 text-xs tracking-[0.2em] uppercase bg-brand-bordeaux text-white hover:bg-brand-gold transition-colors duration-500 group"
              >
                Devenir prestataire
                <svg className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>

            <div className="space-y-8">
              {[
                { title: "Visibilit\u00e9 d\u00e9cupl\u00e9e", desc: "Touchez des milliers de clientes gr\u00e2ce au r\u00e9seau d\u2019influenceuses." },
                { title: "Client\u00e8le qualifi\u00e9e", desc: "Ne payez que pour les r\u00e9servations r\u00e9elles, pas les impressions." },
                { title: "Gestion simplifi\u00e9e", desc: "Dashboard intuitif pour g\u00e9rer vos offres et r\u00e9servations." },
                { title: "Paiement s\u00e9curis\u00e9", desc: "Vos clientes paient en ligne, vous \u00eates pay\u00e9 automatiquement." },
              ].map((b) => (
                <div
                  key={b.title}
                  className="flex gap-6 p-6 border-l-2 border-brand-gold/20 hover:border-brand-gold transition-colors duration-500 group"
                >
                  <div className="flex-shrink-0 w-12 h-12 border border-brand-gold/30 flex items-center justify-center group-hover:border-brand-gold group-hover:bg-brand-gold/5 transition-all duration-500">
                    <svg className="w-5 h-5 text-brand-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="luxury-heading text-lg text-brand-bordeaux mb-2">{b.title}</h3>
                    <p className="text-sm text-brand-bordeaux/50 leading-relaxed">{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Influencer CTA */}
          <div className="mt-24 p-12 md:p-16 border border-brand-gold/20 text-center bg-white">
            <p className="luxury-badge mb-6">Pour les influenceuses</p>
            <h3 className="luxury-heading text-2xl md:text-4xl text-brand-bordeaux mb-4">
              Mon&eacute;tisez votre <span className="italic text-brand-gold">influence</span>
            </h3>
            <p className="text-brand-bordeaux/60 max-w-lg mx-auto mb-8">
              Gagnez 10% de commission sur chaque r&eacute;servation effectu&eacute;e via vos liens de partage.
              Partagez, inspirez, gagnez.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-10 py-4 text-xs tracking-[0.2em] uppercase border border-brand-bordeaux text-brand-bordeaux hover:bg-brand-bordeaux hover:text-white transition-all duration-500"
            >
              Rejoindre le programme
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-brand-bordeaux text-white">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <div className="md:col-span-2">
              <p className="luxury-heading text-2xl tracking-wide mb-4">
                Beaut&eacute;<span className="text-brand-gold">.</span>tn
              </p>
              <p className="text-sm text-white/50 leading-relaxed max-w-sm mb-6">
                La premi&egrave;re marketplace beaut&eacute; en Tunisie qui connecte prestataires,
                influenceuses et clientes.
              </p>
              <div className="flex gap-4">
                {["instagram", "facebook", "tiktok"].map((social) => (
                  <span
                    key={social}
                    className="w-10 h-10 border border-white/20 flex items-center justify-center hover:border-brand-gold hover:text-brand-gold transition-colors duration-500 cursor-pointer"
                  >
                    <span className="text-[10px] tracking-wider uppercase">{social.slice(0, 2)}</span>
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] tracking-[0.2em] uppercase text-white/30 mb-4">Navigation</p>
              <div className="flex flex-col gap-3">
                <Link href="/offres" className="text-sm text-white/60 hover:text-brand-gold transition-colors duration-500">Offres</Link>
                <Link href="/login" className="text-sm text-white/60 hover:text-brand-gold transition-colors duration-500">Connexion</Link>
                <Link href="/register" className="text-sm text-white/60 hover:text-brand-gold transition-colors duration-500">Inscription</Link>
              </div>
            </div>
            <div>
              <p className="text-[10px] tracking-[0.2em] uppercase text-white/30 mb-4">Espaces</p>
              <div className="flex flex-col gap-3">
                <Link href="/register" className="text-sm text-white/60 hover:text-brand-gold transition-colors duration-500">Prestataires</Link>
                <Link href="/register" className="text-sm text-white/60 hover:text-brand-gold transition-colors duration-500">Influenceuses</Link>
                <Link href="/offres" className="text-sm text-white/60 hover:text-brand-gold transition-colors duration-500">Clientes</Link>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 mt-16 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-white/30">&copy; 2026 Beaut&eacute;.tn &mdash; Tous droits r&eacute;serv&eacute;s</p>
            <p className="text-xs text-white/30">Fait avec amour en Tunisie</p>
          </div>
        </div>
      </footer>

      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "Beauté.tn",
            url: process.env.NEXTAUTH_URL || "https://beaute.tn",
            description: "Marketplace beauté N°1 en Tunisie",
            potentialAction: {
              "@type": "SearchAction",
              target: `${process.env.NEXTAUTH_URL || "https://beaute.tn"}/offres?q={search_term_string}`,
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
            name: "Beauté.tn",
            url: process.env.NEXTAUTH_URL || "https://beaute.tn",
            description: "La première marketplace beauté en Tunisie",
            areaServed: { "@type": "Country", name: "Tunisia" },
          }),
        }}
      />
    </div>
  );
}
