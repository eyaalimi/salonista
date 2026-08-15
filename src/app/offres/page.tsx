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
          <form action="/offres" method="GET" className="mx-auto flex max-w-2xl gap-2">
            <input
              type="text"
              name="q"
              defaultValue={q || ""}
              placeholder="Cherche un soin, un salon…"
              aria-label="Rechercher"
              className="ds-focus flex-1 min-h-[52px] rounded-[var(--radius-pill)] border-2 border-hairline bg-white px-5 text-base text-prune placeholder:text-prune-soft/60"
            />
            <button
              type="submit"
              className="ds-press ds-focus shrink-0 min-h-[52px] px-6 rounded-[var(--radius-pill)] bg-rose text-base font-semibold text-white hover:bg-[#F04A79]"
            >
              Rechercher
            </button>
          </form>

          <div className="flex gap-2 justify-center flex-wrap">
            <Chip href="/offres" active={!category}>
              Toutes
            </Chip>
            {Object.entries(categoryLabels).map(([key, label]) => (
              <Chip
                key={key}
                href={`/offres?category=${key}`}
                active={category === key}
              >
                {label}
              </Chip>
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
                className="ds-press block"
              >
                <Card className="flex h-full flex-col">
                  <div className="relative aspect-[4/5] w-full bg-rose-soft">
                    {offer.photos.length > 0 ? (
                      <UploadedImage
                        src={offer.photos[0]}
                        alt={offer.title}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-6xl opacity-40">
                        💇‍♀️
                      </div>
                    )}
                    <span className="absolute left-3 top-3">
                      <Badge tone="prune">
                        {categoryLabels[offer.category] || offer.category}
                      </Badge>
                    </span>
                    {discount > 0 && (
                      <span className="absolute right-3 top-3">
                        <Badge tone="rose">-{discount}%</Badge>
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col gap-1 p-4">
                    <p className="line-clamp-1 text-sm text-prune-soft">
                      {offer.provider.salonName}
                      {offer.provider.city && ` · ${offer.provider.city}`}
                    </p>
                    <h3 className="line-clamp-2 text-base font-semibold leading-snug text-prune">
                      {offer.title}
                    </h3>
                    <div className="mt-auto flex flex-col gap-0.5 pt-3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-bold text-rose">
                          {Number(offer.discountPrice).toFixed(0)} TND
                        </span>
                        {Number(offer.originalPrice) > Number(offer.discountPrice) && (
                          <span className="text-sm text-prune-soft line-through">
                            {Number(offer.originalPrice).toFixed(0)} TND
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-prune-soft">
                        TVA incluse : {Number(offer.taxRate ?? 19)}%
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>

        {offers.length === 0 && (
          <p className="text-center text-base text-prune-soft py-20">
            Aucune offre disponible pour le moment.
          </p>
        )}
      </div>
    </div>
  );
}
