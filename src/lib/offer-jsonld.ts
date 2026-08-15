/**
 * Traduction d'une offre en Product Schema.org.
 *
 * Pas d'import Prisma ici — le module doit rester chargeable par vitest
 * (cf. src/lib/verify-authz.ts, meme contrainte).
 */

/** Offre reduite a ce qui sert au balisage. */
export type OfferForJsonLd = {
  id: string;
  title: string;
  description: string | null;
  /** Prix reellement paye, en chaine a 3 decimales. */
  discountPrice: string;
  originalPrice: string | null;
  category: string;
  photos: string[];
  salonName: string;
  /** Nombre de creneaux futurs encore libres. */
  freeSlotCount: number;
  reviewCount: number;
  avgRating: number;
};

const CATEGORY_LABELS: Record<string, string> = {
  COIFFURE: "Coiffure",
  ESTHETIQUE: "Esthétique",
  ONGLERIE: "Onglerie",
  MASSAGE: "Massage",
  PARFUMERIE: "Parfumerie",
  AUTRE: "Autre",
};

/** Fenetre de generation des creneaux, en jours. */
const SLOT_WINDOW_DAYS = 30;

/**
 * Objet JSON-LD Product pour une offre.
 *
 * Le prix balise est celui que la cliente PAIE (discountPrice), jamais le prix
 * barre : Google compare le balisage a ce que la page affiche, et un ecart
 * coute l'extrait enrichi.
 *
 * Le prix reste une CHAINE : le dinar tunisien a 3 decimales (millimes), et un
 * flottant deriverait.
 */
export function buildOfferJsonLd(
  offer: OfferForJsonLd,
  baseUrl: string,
): Record<string, unknown> {
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: offer.title,
    category: CATEGORY_LABELS[offer.category] ?? offer.category,
    brand: { "@type": "Brand", name: offer.salonName },
  };

  if (offer.description?.trim()) {
    ld.description = offer.description.trim();
  }

  if (offer.photos.length > 0) {
    ld.image = offer.photos.map((p) => (p.startsWith("http") ? p : `${baseUrl}${p}`));
  }

  // priceValidUntil : sans ce champ, Google finit par considerer le prix comme
  // perime et cesse de l'afficher. On l'aligne sur la fenetre des creneaux.
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + SLOT_WINDOW_DAYS);

  ld.offers = {
    "@type": "Offer",
    price: offer.discountPrice,
    priceCurrency: "TND",
    availability:
      offer.freeSlotCount > 0
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    url: `${baseUrl}/offre/${offer.id}`,
    priceValidUntil: validUntil.toISOString().slice(0, 10),
    seller: { "@type": "LocalBusiness", name: offer.salonName },
  };

  // aggregateRating UNIQUEMENT s'il y a au moins un avis : une note de 0 sur
  // zero avis est une violation. La page affiche les etoiles sous la meme
  // condition (reviews.length > 0), donc balisage et affichage restent
  // alignes par construction.
  if (offer.reviewCount > 0) {
    ld.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: String(offer.avgRating),
      reviewCount: offer.reviewCount,
      bestRating: "5",
      worstRating: "1",
    };
  }

  return ld;
}
