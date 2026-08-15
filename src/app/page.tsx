import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { HomeNav } from "@/components/home-nav";
import { Logo } from "@/components/logo";
import { UploadedImage } from "@/components/uploaded-image";
import { Greeting } from "@/components/greeting";
import { PromoBanner } from "@/components/promo-banner";
import { FAQ_ITEMS, buildFaqJsonLd } from "@/lib/faq";

const categoryLabels: Record<string, string> = {
  COIFFURE: "Coiffure",
  ESTHETIQUE: "Soin visage",
  ONGLERIE: "Ongles",
  MASSAGE: "Massage",
  PARFUMERIE: "Parfumerie",
  AUTRE: "Autre",
};

const categoryEmoji: Record<string, string> = {
  COIFFURE: "💇‍♀️",
  ESTHETIQUE: "✨",
  ONGLERIE: "💅",
  MASSAGE: "💆",
  PARFUMERIE: "🌸",
  AUTRE: "💄",
};

export default async function Home() {
  const [offers, topSalons, categories] = await Promise.all([
    prisma.offer.findMany({
      where: { active: true, publishedToMarketplace: true, photos: { isEmpty: false } } as never,
      orderBy: { createdAt: "desc" },
      take: 12,
      include: {
        provider: { select: { salonName: true, city: true } },
      },
    }),
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

  const categoryData = Object.keys(categoryLabels)
    .map((key) => ({
      key,
      label: categoryLabels[key],
      count: categories.find((c) => c.category === key)?._count || 0,
    }))
    .filter((c) => c.count > 0);

  return (
    <div className="min-h-screen bg-brand-cream">
      <HomeNav />

      {/* Spacer for fixed nav */}
      <div className="h-14 md:h-20" />

      {/* GREETING */}
      <Greeting />

      {/* SEARCH — mobile-first, big, friendly */}
      <section className="px-4 pt-4">
        <form action="/offres" method="GET" className="relative">
          <svg
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-gold"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            name="q"
            placeholder="Cherche un soin, un salon..."
            aria-label="Rechercher"
            className="w-full rounded-2xl border border-brand-gold-soft bg-brand-sand py-3 pl-12 pr-4 text-base text-brand-ink placeholder:text-brand-ink-soft/70 focus:border-brand-gold focus:outline-none"
          />
        </form>
      </section>

      {/* PROMO BANNER */}
      <PromoBanner />

      {/* CATEGORY CHIPS — horizontal scroll */}
      {categoryData.length > 0 && (
        <section className="mt-5">
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-1">
            <Link
              href="/offres"
              className="shrink-0 rounded-full border border-brand-line bg-brand-sand px-4 py-2 text-sm text-brand-ink"
            >
              Tout
            </Link>
            {categoryData.map((cat) => (
              <Link
                key={cat.key}
                href={`/offres?category=${cat.key}`}
                className="shrink-0 rounded-full border border-brand-line bg-brand-sand px-4 py-2 text-sm text-brand-ink"
              >
                {categoryEmoji[cat.key]} {cat.label}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* OFFERS — horizontal rail of compact cards */}
      {offers.length > 0 && (
        <section className="mt-6">
          <div className="flex items-center justify-between px-4 mb-3">
            <h2 className="text-sm font-semibold text-brand-ink">
              🔥 Soldes — Offres du jour
            </h2>
            <Link
              href="/offres"
              className="text-sm font-semibold text-brand-gold"
            >
              Voir →
            </Link>
          </div>

          <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-2">
            {offers.map((offer) => {
              const original = Number(offer.originalPrice);
              const discounted = Number(offer.discountPrice);
              const discount =
                original > 0
                  ? Math.round(((original - discounted) / original) * 100)
                  : 0;

              return (
                <Link
                  key={offer.id}
                  href={`/offre/${offer.id}`}
                  className="flex w-[160px] shrink-0 flex-col overflow-hidden rounded-2xl border border-brand-line bg-white"
                >
                  <div className="relative h-[90px] w-full bg-gradient-to-br from-brand-sand to-brand-gold-soft/40">
                    {offer.photos.length > 0 ? (
                      <UploadedImage
                        src={offer.photos[0]}
                        alt={offer.title}
                        fill
                        sizes="160px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-3xl">
                        {categoryEmoji[offer.category]}
                      </div>
                    )}
                    {discount > 0 && (
                      <span className="absolute right-2 top-2 rounded-full bg-brand-ink px-2 py-0.5 text-[10px] font-bold text-[#FBFAF7]">
                        -{discount}%
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col px-2 pb-2">
                    <p className="mt-2 line-clamp-1 text-[10px] text-brand-ink-soft">
                      {offer.provider.salonName}
                      {offer.provider.city && ` · ${offer.provider.city}`}
                    </p>
                    <h3 className="mt-0.5 line-clamp-2 text-xs font-semibold leading-tight text-brand-ink">
                      {offer.title}
                    </h3>
                    <div className="mt-auto flex items-baseline gap-1.5 pt-2">
                      <span className="text-sm font-bold text-brand-gold">
                        {discounted.toFixed(0)} DT
                      </span>
                      {original > discounted && (
                        <span className="text-xs text-gray-400 line-through">
                          {original.toFixed(0)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* SALONS — visual rail */}
      {topSalons.length > 0 && (
        <section id="salons" className="mt-6">
          <div className="flex items-center justify-between px-4 mb-3">
            <h2 className="text-sm font-semibold text-brand-ink">
              ✨ Salons populaires
            </h2>
            <Link
              href="/offres"
              className="text-sm font-semibold text-brand-gold"
            >
              Voir →
            </Link>
          </div>

          <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-2">
            {topSalons.map((salon) => {
              const cover = salon.offers[0]?.photos[0];
              return (
                <Link
                  key={salon.id}
                  href={`/salon/${salon.id}`}
                  className="block w-[140px] shrink-0"
                >
                  <div className="relative aspect-square overflow-hidden rounded-2xl bg-gradient-to-br from-brand-sand to-brand-gold-soft/40">
                    {cover ? (
                      <UploadedImage
                        src={cover}
                        alt={salon.salonName}
                        fill
                        sizes="140px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-4xl text-brand-ink/30">
                        {salon.salonName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <h3 className="mt-2 line-clamp-1 text-sm font-semibold text-brand-ink">
                    {salon.salonName}
                  </h3>
                  <p className="line-clamp-1 text-xs text-brand-ink-soft">
                    {salon.city || "Tunisie"} · {salon._count.offers} offre
                    {salon._count.offers > 1 ? "s" : ""}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* SALONS NEAR YOU CTA */}
      <section className="mt-6 px-0">
        <div className="mx-4 flex items-center justify-between gap-3 rounded-2xl bg-brand-sand p-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-brand-ink">
              Salons près de toi 📍
            </p>
            <p className="text-xs text-brand-ink-soft">
              Disponibles maintenant
            </p>
          </div>
          <Link
            href="/offres"
            className="shrink-0 text-sm font-semibold text-brand-gold"
          >
            Voir →
          </Link>
        </div>
      </section>

      {/* PRO CTA — kept compact, stacked on mobile */}
      <section className="mt-8 bg-brand-ink text-white">
        <div className="mx-auto max-w-7xl">
          <Link
            href="/register"
            className="block border-b border-white/10 p-6 sm:p-10"
          >
            <p className="mb-2 text-[11px] tracking-widest uppercase text-brand-gold-soft">
              Prestataire
            </p>
            <h3 className="luxury-heading text-xl sm:text-3xl">
              Vous avez un <span className="italic">salon</span> ?
            </h3>
            <p className="mt-2 text-sm text-white/60">
              Recevez des réservations qualifiées chaque jour.
            </p>
            <span className="mt-3 inline-block text-sm font-semibold text-brand-gold-soft">
              Rejoindre →
            </span>
          </Link>
          <Link
            href="/register"
            className="block p-6 sm:p-10"
          >
            <p className="mb-2 text-[11px] tracking-widest uppercase text-brand-gold-soft">
              Influenceuse
            </p>
            <h3 className="luxury-heading text-xl sm:text-3xl">
              Monétisez votre <span className="italic">audience</span>
            </h3>
            <p className="mt-2 text-sm text-white/60">
              10% de commission sur chaque réservation.
            </p>
            <span className="mt-3 inline-block text-sm font-semibold text-brand-gold-soft">
              Devenir partenaire →
            </span>
          </Link>
        </div>
      </section>

      {/* FAQ — le contenu reste dans le HTML meme replie (details/summary
          natif, sans JS), ce qui satisfait l'exigence de Google : une
          question balisee doit etre visible sur la page. */}
      <section className="mt-10 px-6 md:px-12" aria-labelledby="faq-titre">
        <div className="mx-auto max-w-3xl">
          <p className="mb-2 text-[11px] tracking-widest uppercase text-brand-bordeaux/40">
            Questions fréquentes
          </p>
          <h2 id="faq-titre" className="luxury-heading mb-6 text-2xl sm:text-3xl">
            Tout savoir sur <span className="italic">Salonista</span>
          </h2>

          <div className="divide-y divide-brand-gold/20 border-y border-brand-gold/20">
            {FAQ_ITEMS.map((item) => (
              <details key={item.question} className="group py-4">
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-medium text-brand-bordeaux marker:content-['']">
                  {item.question}
                  <span
                    aria-hidden="true"
                    className="shrink-0 text-brand-gold transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-brand-bordeaux/70">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-brand-ink text-white border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 px-6 py-8 sm:flex-row md:px-12">
          <Logo tone="light" className="text-xl" />
          <div className="flex items-center gap-5 text-xs text-white/60">
            <Link href="/offres" className="hover:text-brand-gold transition-colors">
              Offres
            </Link>
            <Link href="/login" className="hover:text-brand-gold transition-colors">
              Connexion
            </Link>
            <Link href="/register" className="hover:text-brand-gold transition-colors">
              Inscription
            </Link>
          </div>
          <p className="text-[10px] text-white/30">
            © 2026 · Fait en Tunisie
          </p>
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
      {/* FAQPage : contrairement a WebSite et Organization ci-dessus, valides
          mais non previsualisables, ce type est reconnu par le Test des
          resultats enrichis de Google. Meme source que la section affichee. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqJsonLd()) }}
      />
    </div>
  );
}
