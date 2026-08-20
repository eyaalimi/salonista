import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { HomeNav } from "@/components/home-nav";
import { Logo } from "@/components/logo";
import { UploadedImage } from "@/components/uploaded-image";
import { Greeting } from "@/components/greeting";
import { PromoBanner } from "@/components/promo-banner";
import { FAQ_ITEMS, buildFaqJsonLd } from "@/lib/faq";
import { Chip } from "@/components/ui/chip";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { pickNextSlot, formatAvailability } from "@/lib/salon-availability";

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
          select: {
            photos: true,
            discountPrice: true,
            category: true,
            // Bornage volontaire : on ne remonte que les creneaux futurs, et
            // TimeSlot est indexe sur [offerId, startTime], donc ce filtre
            // utilise l'index. Sans borne, un salon actif remonterait des
            // milliers de lignes.
            slots: {
              where: { startTime: { gte: new Date() } },
              orderBy: { startTime: "asc" },
              take: 1,
              select: { startTime: true, capacity: true, bookedCount: true },
            },
            reviews: { select: { rating: true } },
          },
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

  // Donnees derivees des salons, calculees une fois pour l'affichage.
  //
  // Le badge et l'etoile n'apparaissent que si la donnee existe reellement :
  // un salon sans creneau libre n'affiche pas de badge, un salon sans avis
  // n'affiche pas d'etoile. Aucune valeur par defaut inventee.
  const now = new Date();
  const salonExtras = new Map(
    topSalons.map((salon) => {
      const slots = salon.offers.flatMap((o) => o.slots);
      const ratings = salon.offers.flatMap((o) => o.reviews.map((r) => r.rating));
      const prices = salon.offers.map((o) => Number(o.discountPrice));

      return [
        salon.id,
        {
          availability: formatAvailability(pickNextSlot(slots, now), now),
          rating:
            ratings.length > 0
              ? Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10
              : null,
          minPrice: prices.length > 0 ? Math.min(...prices) : null,
          categories: [...new Set(salon.offers.map((o) => categoryLabels[o.category]))]
            .filter(Boolean)
            .slice(0, 2),
        },
      ];
    }),
  );

  return (
    <div className="min-h-screen bg-creme">
      <HomeNav />

      {/* Spacer for fixed nav */}
      <div className="h-14 md:h-20" />

      {/* GREETING */}
      <Greeting />

      {/* SEARCH */}
      <section className="mx-auto max-w-6xl px-4 pt-4">
        <form action="/offres" method="GET" className="relative">
          <svg
            className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-prune-soft"
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
            placeholder="Salon, ville, prestation…"
            aria-label="Rechercher"
            className="ds-focus w-full min-h-[52px] rounded-[var(--radius-pill)] border-2 border-hairline bg-white pl-[52px] pr-5 text-base text-prune placeholder:text-prune-soft/60"
          />
        </form>
      </section>

      {/* PROMO BANNER */}
      <PromoBanner />

      {/* CATEGORY CHIPS */}
      {categoryData.length > 0 && (
        <section className="mx-auto mt-5 max-w-6xl px-4">
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            <Chip href="/offres" active>
              Tout
            </Chip>
            {categoryData.map((cat) => (
              <Chip key={cat.key} href={`/offres?category=${cat.key}`}>
                {categoryEmoji[cat.key]} {cat.label}
              </Chip>
            ))}
          </div>
        </section>
      )}

      {/* OFFERS — horizontal rail of compact cards */}
      {offers.length > 0 && (
        <section className="mx-auto mt-6 max-w-6xl px-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="ds-display text-lg text-prune">Offres du jour</h2>
            <Link href="/offres" className="text-sm font-semibold text-rose">
              Voir tout
            </Link>
          </div>

          {/* Defilement horizontal sur mobile — le geste y est naturel et la
              rangee reste compacte. Sur ordinateur il n'y a pas de raison de
              cacher des offres derriere un defilement : grille de 5. */}
          <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-5 md:overflow-visible">
            {offers.map((offer, index) => {
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
                  // La largeur fixe sert au defilement mobile ; dans la grille
                  // de bureau la cellule impose sa largeur.
                  //
                  // Au-dela de 10, les cartes formeraient une 3e rangee de
                  // deux, bancale. Sur mobile elles restent toutes accessibles
                  // par le defilement — « Voir tout » mene au reste.
                  className={`ds-press w-[170px] shrink-0 md:w-auto md:shrink ${
                    index >= 10 ? "md:hidden" : ""
                  }`}
                >
                  <Card>
                    <div className="relative h-[110px] w-full bg-rose-soft">
                      {offer.photos.length > 0 ? (
                        <UploadedImage
                          src={offer.photos[0]}
                          alt={offer.title}
                          fill
                          sizes="(max-width: 768px) 170px, 220px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-3xl">
                          {categoryEmoji[offer.category]}
                        </div>
                      )}
                      {discount > 0 && (
                        <span className="absolute right-2 top-2">
                          <Badge tone="rose">-{discount}%</Badge>
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-1 p-3">
                      <p className="line-clamp-1 text-xs text-prune-soft">
                        {offer.provider.salonName}
                        {offer.provider.city && ` · ${offer.provider.city}`}
                      </p>
                      <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-prune">
                        {offer.title}
                      </h3>
                      <div className="flex items-baseline gap-1.5 pt-1">
                        <span className="text-base font-bold text-rose">
                          {discounted.toFixed(0)} TND
                        </span>
                        {original > discounted && (
                          <span className="text-xs text-prune-soft line-through">
                            {original.toFixed(0)}
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* SALONS */}
      {topSalons.length > 0 && (
        // `max-w-6xl` : sans largeur maximale, les cartes s'etirent sur toute
        // la largeur d'un ecran d'ordinateur et deviennent des bandeaux.
        <section id="salons" className="mx-auto mt-8 max-w-6xl px-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="ds-display text-lg text-prune">Salons populaires</h2>
            <Link href="/offres" className="text-sm font-semibold text-rose">
              Voir tout
            </Link>
          </div>

          {/* Une colonne sur mobile, deux des 640px, trois sur ordinateur.
              `items-start` empeche les cartes d'une meme rangee de s'etirer a
              la hauteur de la plus haute. */}
          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {topSalons.map((salon) => {
              const cover = salon.offers[0]?.photos[0];
              const extras = salonExtras.get(salon.id);

              return (
                <Link key={salon.id} href={`/salon/${salon.id}`} className="ds-press block">
                  <Card>
                    <div className="relative h-[180px] w-full bg-rose-soft">
                      {cover ? (
                        <UploadedImage
                          src={cover}
                          alt={salon.salonName}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 380px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-5xl text-prune/30">
                          {salon.salonName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {/* Le badge n'apparait QUE si un creneau libre existe.
                          Sur des salons sans creneau, son absence est le
                          comportement correct. */}
                      {extras?.availability && (
                        <span className="absolute bottom-3 left-3">
                          <Badge tone="menthe">{extras.availability}</Badge>
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-1 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="line-clamp-1 text-base font-bold text-prune">
                          {salon.salonName}
                        </h3>
                        {/* Idem : pas d'avis, pas d'etoile. */}
                        {extras?.rating !== null && extras?.rating !== undefined && (
                          <span className="shrink-0 text-sm text-prune-soft">
                            ★ {extras.rating.toFixed(1).replace(".", ",")}
                          </span>
                        )}
                      </div>
                      <p className="line-clamp-1 text-sm text-prune-soft">
                        {[
                          salon.city || "Tunisie",
                          ...(extras?.categories ?? []),
                          extras?.minPrice != null ? `dès ${extras.minPrice.toFixed(0)} TND` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* SALONS NEAR YOU CTA */}
      <section className="mx-auto mt-6 max-w-6xl px-4">
        <div className="flex items-center justify-between gap-3 rounded-[var(--radius-panel)] border-2 border-hairline bg-white p-4">
          <div className="min-w-0">
            <p className="text-base font-semibold text-prune">
              Salons près de toi 📍
            </p>
            <p className="text-sm text-prune-soft">
              Disponibles maintenant
            </p>
          </div>
          <Link
            href="/offres"
            className="ds-press ds-focus inline-flex min-h-[44px] shrink-0 items-center rounded-[var(--radius-pill)] px-3 text-base font-semibold text-rose"
          >
            Voir →
          </Link>
        </div>
      </section>

      {/* PRO CTA — kept compact, stacked on mobile */}
      <section className="mt-8 bg-prune text-white">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/pro"
            className="ds-press ds-focus block border-b border-white/10 px-4 py-6 sm:py-10"
          >
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-white/60">
              Prestataire
            </p>
            <h3 className="ds-display text-xl sm:text-3xl">
              Tu as un <span className="italic">salon</span> ?
            </h3>
            <p className="mt-2 text-base text-white/70">
              Reçois des réservations qualifiées chaque jour.
            </p>
            <span className="mt-4 inline-flex min-h-[44px] items-center rounded-[var(--radius-pill)] bg-rose px-5 text-base font-semibold text-prune">
              Rejoindre →
            </span>
          </Link>
          <Link
            href="/register"
            className="ds-press ds-focus block px-4 py-6 sm:py-10"
          >
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-white/60">
              Influenceuse
            </p>
            <h3 className="ds-display text-xl sm:text-3xl">
              Monétise ton <span className="italic">audience</span>
            </h3>
            <p className="mt-2 text-base text-white/70">
              10% de commission sur chaque réservation.
            </p>
            <span className="mt-4 inline-flex min-h-[44px] items-center rounded-[var(--radius-pill)] bg-rose px-5 text-base font-semibold text-prune">
              Devenir partenaire →
            </span>
          </Link>
        </div>
      </section>

      {/* FAQ — le contenu reste dans le HTML meme replie (details/summary
          natif, sans JS), ce qui satisfait l'exigence de Google : une
          question balisee doit etre visible sur la page. */}
      <section className="mx-auto mt-10 max-w-6xl px-4" aria-labelledby="faq-titre">
        <div className="mx-auto max-w-3xl">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-prune-soft">
            Questions fréquentes
          </p>
          <h2 id="faq-titre" className="ds-display mb-6 text-2xl text-prune sm:text-3xl">
            Tout savoir sur <span className="italic">Salonista</span>
          </h2>

          <div className="divide-y divide-hairline border-y border-hairline">
            {FAQ_ITEMS.map((item) => (
              <details key={item.question} className="group py-4">
                <summary className="ds-focus flex min-h-[44px] cursor-pointer items-center justify-between gap-4 text-base font-semibold text-prune marker:content-['']">
                  {item.question}
                  <span
                    aria-hidden="true"
                    className="shrink-0 text-xl text-rose transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-base leading-relaxed text-prune-soft">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/10 bg-prune text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 px-4 py-8 sm:flex-row">
          <Logo tone="light" className="text-xl" />
          <div className="flex items-center gap-2 text-sm">
            <Link
              href="/offres"
              className="ds-press ds-focus inline-flex min-h-[44px] items-center rounded-[var(--radius-pill)] px-3 text-white/70 hover:text-white"
            >
              Offres
            </Link>
            <Link
              href="/login"
              className="ds-press ds-focus inline-flex min-h-[44px] items-center rounded-[var(--radius-pill)] px-3 text-white/70 hover:text-white"
            >
              Connexion
            </Link>
            <Link
              href="/register"
              className="ds-press ds-focus inline-flex min-h-[44px] items-center rounded-[var(--radius-pill)] px-3 text-white/70 hover:text-white"
            >
              Inscription
            </Link>
          </div>
          <p className="text-xs text-white/40">
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
