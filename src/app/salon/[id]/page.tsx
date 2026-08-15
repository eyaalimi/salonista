import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { SalonClient } from "./salon-client";
import { isValidOpeningHours, type OpeningHours } from "@/lib/opening-hours";
import { buildSalonJsonLd, categoryLabel } from "@/lib/salon-jsonld";

interface Props {
  params: Promise<{ id: string }>;
}

const BASE_URL = process.env.NEXTAUTH_URL || "https://salonista.tn";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const provider = await prisma.providerProfile.findUnique({
    where: { id },
    select: {
      salonName: true,
      category: true,
      description: true,
      city: true,
      address: true,
      photos: true,
      offers: {
        where: { active: true, publishedToMarketplace: true, photos: { isEmpty: false } } as never,
        select: { title: true },
        take: 3,
      },
    },
  });

  if (!provider) {
    return { title: "Salon introuvable" };
  }

  const cat = categoryLabel(provider.category);
  const titre = provider.city
    ? `${provider.salonName}, ${provider.city} — ${cat}`
    : `${provider.salonName} — ${cat}`;

  // Description du salon si elle existe ; sinon on la compose a partir des
  // faits (ville, services publies). On n'invente rien : une description
  // absente vaut mieux qu'une description fausse.
  const services = provider.offers.map((o) => o.title).join(", ");
  const description =
    provider.description?.trim() ||
    [
      `${provider.salonName}${provider.city ? ` à ${provider.city}` : ""}`,
      services ? ` : ${services}.` : ".",
      " Réservez en ligne sur Salonista.",
      provider.address ? ` ${provider.address}.` : "",
    ].join("");

  const image = provider.photos[0]
    ? `${BASE_URL}${provider.photos[0]}`
    : undefined;

  return {
    title: titre,
    description,
    alternates: { canonical: `${BASE_URL}/salon/${id}` },
    openGraph: {
      title: `${titre} | Salonista`,
      description,
      type: "website",
      url: `${BASE_URL}/salon/${id}`,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function SalonPage({ params }: Props) {
  const { id } = await params;

  const provider = await prisma.providerProfile.findUnique({
    where: { id },
    include: {
      offers: {
        // Bug preexistant : cette page ne filtrait pas sur
        // publishedToMarketplace, laissant fuir les services POS-only sur la
        // page publique du salon. Avec la publication par defaut, tous les
        // services de caisse s'y afficheraient.
        where: { active: true, publishedToMarketplace: true, photos: { isEmpty: false } } as never,
        orderBy: { createdAt: "desc" },
        include: {
          slots: {
            where: { startTime: { gte: new Date() } },
            orderBy: { startTime: "asc" },
          },
        },
      },
    },
  });

  if (!provider) notFound();

  const openingHours: OpeningHours | null = isValidOpeningHours(provider.openingHours)
    ? (provider.openingHours as OpeningHours)
    : null;

  const jsonLd = buildSalonJsonLd(
    {
      id: provider.id,
      salonName: provider.salonName,
      category: provider.category,
      description: provider.description,
      address: provider.address,
      city: provider.city,
      phone: provider.phone,
      photos: provider.photos,
      lat: provider.lat,
      lng: provider.lng,
      openingHours,
    },
    BASE_URL,
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SalonClient
        salon={{
          id: provider.id,
          salonName: provider.salonName,
          category: provider.category,
          description: provider.description,
          address: provider.address,
          city: provider.city,
          phone: provider.phone,
          photos: provider.photos,
          verified: provider.verified,
          openingHours,
          lat: provider.lat ? Number(provider.lat) : null,
          lng: provider.lng ? Number(provider.lng) : null,
          offers: provider.offers.map((o) => ({
            id: o.id,
            title: o.title,
            description: o.description,
            originalPrice: Number(o.originalPrice),
            discountPrice: Number(o.discountPrice),
            taxRate: Number(o.taxRate),
            category: o.category,
            durationMinutes: o.durationMinutes,
            photos: o.photos,
            slots: o.slots.map((s) => ({
              id: s.id,
              startTime: s.startTime.toISOString(),
              capacity: s.capacity,
              bookedCount: s.bookedCount,
            })),
          })),
        }}
      />
    </>
  );
}
