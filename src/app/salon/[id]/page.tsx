import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { SalonClient } from "./salon-client";
import { isValidOpeningHours, type OpeningHours } from "@/lib/opening-hours";

interface Props {
  params: Promise<{ id: string }>;
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

  return (
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
  );
}
