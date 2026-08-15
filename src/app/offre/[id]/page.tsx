import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { OfferClient } from "./offer-client";
import { buildOfferJsonLd } from "@/lib/offer-jsonld";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ref?: string }>;
}

const BASE_URL = process.env.NEXTAUTH_URL || "https://salonista.tn";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const offer = await prisma.offer.findUnique({
    where: { id, active: true },
    include: { provider: { select: { salonName: true, city: true, demo: true } } },
  });

  if (!offer || !(offer as { publishedToMarketplace?: boolean }).publishedToMarketplace) {
    return { title: "Offre introuvable" };
  }

  const discount = Math.round(
    ((Number(offer.originalPrice) - Number(offer.discountPrice)) / Number(offer.originalPrice)) * 100
  );

  return {
    title: `${offer.title} — ${offer.provider.salonName}`,
    description: `${offer.title} à ${Number(offer.discountPrice).toFixed(0)} DT au lieu de ${Number(offer.originalPrice).toFixed(0)} DT (-${discount}%) chez ${offer.provider.salonName}${offer.provider.city ? `, ${offer.provider.city}` : ""}. Réservez en ligne sur Salonista.`,
    alternates: { canonical: `${BASE_URL}/offre/${id}` },
    // Un salon de demonstration ne doit pas polluer l'index : ses offres
    // sortent des resultats avec lui.
    ...(offer.provider.demo ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      title: `${offer.title} — ${offer.provider.salonName} | Salonista`,
      description: `${offer.title} à -${discount}% chez ${offer.provider.salonName}. Réservez maintenant.`,
      type: "website",
    },
  };
}

export default async function OffrePage({ params, searchParams }: Props) {
  const { id } = await params;
  const { ref } = await searchParams;

  const offer = await prisma.offer.findUnique({
    where: { id, active: true },
    include: {
      provider: {
        select: {
          id: true,
          salonName: true,
          city: true,
          category: true,
          description: true,
          demo: true,
        },
      },
      slots: {
        where: { startTime: { gte: new Date() } },
        orderBy: { startTime: "asc" },
      },
    },
  });

  if (!offer || !(offer as { publishedToMarketplace?: boolean }).publishedToMarketplace) notFound();

  // Tracking cookie is set by /api/tracking/click (Server Components cannot set cookies).
  // If a ?ref= is present (e.g. direct link), validate it; otherwise read the stored cookie.
  let trackingToken: string | null = null;
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get("tracking_ref")?.value || null;

  if (ref) {
    const trackingLink = await prisma.trackingLink.findUnique({
      where: { token: ref },
    });
    if (trackingLink && trackingLink.offerId === id) {
      trackingToken = ref;
    } else {
      trackingToken = cookieToken;
    }
  } else {
    trackingToken = cookieToken;
  }

  const categoryLabels: Record<string, string> = {
    COIFFURE: "Coiffure",
    ESTHETIQUE: "Esthétique",
    ONGLERIE: "Onglerie",
    MASSAGE: "Massage",
    PARFUMERIE: "Parfumerie",
    AUTRE: "Autre",
  };

  // Fetch reviews for this offer
  const reviews = await prisma.review.findMany({
    where: { offerId: id },
    orderBy: { createdAt: "desc" },
    include: { client: { select: { name: true } } },
  });

  const avgRating =
    reviews.length > 0
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
      : 0;

  // Un creneau est libre s'il reste de la capacite. La requete ne charge que
  // les creneaux futurs (startTime >= maintenant).
  const freeSlotCount = offer.slots.filter((s) => s.bookedCount < s.capacity).length;

  const jsonLd = buildOfferJsonLd(
    {
      id: offer.id,
      title: offer.title,
      description: offer.description,
      discountPrice: offer.discountPrice.toString(),
      originalPrice: offer.originalPrice ? offer.originalPrice.toString() : null,
      category: offer.category,
      photos: offer.photos,
      salonName: offer.provider.salonName,
      freeSlotCount,
      reviewCount: reviews.length,
      avgRating,
    },
    BASE_URL,
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <OfferClient
        offer={{
          id: offer.id,
          title: offer.title,
          description: offer.description,
          originalPrice: Number(offer.originalPrice),
          discountPrice: Number(offer.discountPrice),
          taxRate: Number(offer.taxRate),
          category: categoryLabels[offer.category] || offer.category,
          photos: offer.photos,
          provider: offer.provider,
          slots: offer.slots.map((s) => ({
            id: s.id,
            startTime: s.startTime.toISOString(),
            endTime: s.endTime.toISOString(),
            capacity: s.capacity,
            bookedCount: s.bookedCount,
          })),
        }}
        trackingToken={trackingToken}
        reviews={reviews.map((r) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          clientName: r.client.name || "Cliente",
          createdAt: r.createdAt.toISOString(),
        }))}
        avgRating={avgRating}
      />
    </>
  );
}
