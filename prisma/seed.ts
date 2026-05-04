import { PrismaClient, Role, Category, BookingStatus, CommissionStatus } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import { randomBytes } from "crypto";
import "dotenv/config";

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

function nanoid(size = 10) {
  return randomBytes(size).toString("base64url").slice(0, size);
}

async function main() {
  console.log("🌱 Seeding database...");

  // Clean existing data
  await prisma.commission.deleteMany();
  await prisma.click.deleteMany();
  await prisma.collaborationRequest.deleteMany();
  await prisma.bookingItem.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.timeSlot.deleteMany();
  await prisma.trackingLink.deleteMany();
  await prisma.payout.deleteMany();
  await prisma.offer.deleteMany();
  await prisma.influencerProfile.deleteMany();
  await prisma.providerProfile.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await hash("password123", 12);

  // --- PROVIDERS ---
  const provider1 = await prisma.user.create({
    data: {
      email: "salon.nour@example.com",
      name: "Nour Beauty Salon",
      role: Role.PROVIDER,
      passwordHash,
      phone: "+21698123456",
      providerProfile: {
        create: {
          salonName: "Salon Nour",
          category: Category.COIFFURE,
          description: "Salon de coiffure et beauté au coeur de Tunis. Spécialisé en lissage brésilien, balayage et soins capillaires.",
          address: "15 Rue de Marseille",
          city: "Tunis",
          lat: 36.8065,
          lng: 10.1815,
          phone: "+21698123456",
          photos: ["/images/salon-nour-1.jpg", "/images/salon-nour-2.jpg"],
          verified: true,
          openingHours: {
            lundi: "09:00-18:00",
            mardi: "09:00-18:00",
            mercredi: "09:00-18:00",
            jeudi: "09:00-18:00",
            vendredi: "09:00-18:00",
            samedi: "09:00-14:00",
            dimanche: "Fermé",
          },
        },
      },
    },
    include: { providerProfile: true },
  });

  const provider2 = await prisma.user.create({
    data: {
      email: "institut.yasmine@example.com",
      name: "Institut Yasmine",
      role: Role.PROVIDER,
      passwordHash,
      phone: "+21697654321",
      providerProfile: {
        create: {
          salonName: "Institut Yasmine",
          category: Category.ESTHETIQUE,
          description: "Institut de beauté spécialisé en soins du visage, épilation et manucure. Ambiance zen et produits naturels.",
          address: "42 Avenue Habib Bourguiba",
          city: "Sousse",
          lat: 35.8256,
          lng: 10.6369,
          phone: "+21697654321",
          photos: ["/images/institut-yasmine-1.jpg"],
          verified: true,
          openingHours: {
            lundi: "10:00-19:00",
            mardi: "10:00-19:00",
            mercredi: "10:00-19:00",
            jeudi: "10:00-19:00",
            vendredi: "10:00-19:00",
            samedi: "10:00-16:00",
            dimanche: "Fermé",
          },
        },
      },
    },
    include: { providerProfile: true },
  });

  const provider3 = await prisma.user.create({
    data: {
      email: "nails.mariem@example.com",
      name: "Mariem Nails Art",
      role: Role.PROVIDER,
      passwordHash,
      phone: "+21655987654",
      providerProfile: {
        create: {
          salonName: "Mariem Nails Art",
          category: Category.ONGLERIE,
          description: "Nail art et pose de gel/résine. Les dernières tendances en manucure et pédicure.",
          address: "8 Rue de la Liberté",
          city: "La Marsa",
          lat: 36.8783,
          lng: 10.3247,
          phone: "+21655987654",
          photos: ["/images/nails-mariem-1.jpg"],
          verified: false,
          openingHours: {
            lundi: "10:00-18:00",
            mardi: "10:00-18:00",
            mercredi: "10:00-18:00",
            jeudi: "10:00-18:00",
            vendredi: "10:00-18:00",
            samedi: "10:00-15:00",
            dimanche: "Fermé",
          },
        },
      },
    },
    include: { providerProfile: true },
  });

  // --- INFLUENCERS ---
  const influencer1 = await prisma.user.create({
    data: {
      email: "amira.beauty@example.com",
      name: "Amira Ben Ali",
      role: Role.INFLUENCER,
      passwordHash,
      phone: "+21622334455",
      influencerProfile: {
        create: {
          instagramHandle: "@amira.beauty.tn",
          followersCount: 45000,
          category: "Beauté & Lifestyle",
          bio: "Passionnée de beauté, je partage mes découvertes et bons plans beauté en Tunisie 💄",
          verified: true,
          totalEarnings: 250.0,
          pendingBalance: 80.0,
        },
      },
    },
    include: { influencerProfile: true },
  });

  const influencer2 = await prisma.user.create({
    data: {
      email: "sara.style@example.com",
      name: "Sara Trabelsi",
      role: Role.INFLUENCER,
      passwordHash,
      phone: "+21699887766",
      influencerProfile: {
        create: {
          instagramHandle: "@sara.style.tn",
          followersCount: 120000,
          category: "Mode & Beauté",
          bio: "Influenceuse mode et beauté basée à Tunis. Collaborations et partenariats 🌸",
          verified: true,
          totalEarnings: 520.0,
          pendingBalance: 150.0,
        },
      },
    },
    include: { influencerProfile: true },
  });

  // --- CLIENTS ---
  const clients = await Promise.all(
    [
      { email: "fatma.client@example.com", name: "Fatma Bouzid", phone: "+21650111222" },
      { email: "ines.client@example.com", name: "Ines Mansouri", phone: "+21650333444" },
      { email: "rim.client@example.com", name: "Rim Gharbi", phone: "+21650555666" },
    ].map((c) =>
      prisma.user.create({
        data: { ...c, role: Role.CLIENT, passwordHash },
      })
    )
  );

  // --- ADMIN ---
  await prisma.user.create({
    data: {
      email: "admin@salonista.tn",
      name: "Admin",
      role: Role.ADMIN,
      passwordHash,
    },
  });

  // --- OFFERS ---
  const offers = await Promise.all([
    prisma.offer.create({
      data: {
        providerId: provider1.providerProfile!.id,
        title: "Lissage Brésilien -30%",
        description: "Lissage brésilien professionnel avec produits premium. Résultat garanti 3-4 mois.",
        originalPrice: 150.0,
        discountPrice: 105.0,
        category: Category.COIFFURE,
        photos: ["/images/lissage-1.jpg"],
        active: true,
      },
    }),
    prisma.offer.create({
      data: {
        providerId: provider1.providerProfile!.id,
        title: "Balayage + Coupe -20%",
        description: "Balayage naturel tendance avec coupe et brushing inclus.",
        originalPrice: 120.0,
        discountPrice: 96.0,
        category: Category.COIFFURE,
        photos: ["/images/balayage-1.jpg"],
        active: true,
      },
    }),
    prisma.offer.create({
      data: {
        providerId: provider2.providerProfile!.id,
        title: "Soin Visage Complet -25%",
        description: "Nettoyage profond, gommage, masque hydratant et massage facial. 1h de pure détente.",
        originalPrice: 80.0,
        discountPrice: 60.0,
        category: Category.ESTHETIQUE,
        photos: ["/images/soin-visage-1.jpg"],
        active: true,
      },
    }),
    prisma.offer.create({
      data: {
        providerId: provider2.providerProfile!.id,
        title: "Épilation Complète -15%",
        description: "Épilation corps complet à la cire orientale. Peau douce garantie.",
        originalPrice: 60.0,
        discountPrice: 51.0,
        category: Category.ESTHETIQUE,
        photos: ["/images/epilation-1.jpg"],
        active: true,
      },
    }),
    prisma.offer.create({
      data: {
        providerId: provider3.providerProfile!.id,
        title: "Pose Gel + Nail Art -20%",
        description: "Pose complète gel avec nail art au choix. Large choix de designs tendance.",
        originalPrice: 45.0,
        discountPrice: 36.0,
        category: Category.ONGLERIE,
        photos: ["/images/nails-1.jpg"],
        active: true,
      },
    }),
  ]);

  // --- TRACKING LINKS ---
  const trackingLinks = await Promise.all([
    prisma.trackingLink.create({
      data: {
        influencerId: influencer1.influencerProfile!.id,
        offerId: offers[0].id,
        token: nanoid(),
        clicksCount: 234,
        conversionsCount: 12,
      },
    }),
    prisma.trackingLink.create({
      data: {
        influencerId: influencer1.influencerProfile!.id,
        offerId: offers[2].id,
        token: nanoid(),
        clicksCount: 89,
        conversionsCount: 5,
      },
    }),
    prisma.trackingLink.create({
      data: {
        influencerId: influencer2.influencerProfile!.id,
        offerId: offers[0].id,
        token: nanoid(),
        clicksCount: 567,
        conversionsCount: 28,
      },
    }),
    prisma.trackingLink.create({
      data: {
        influencerId: influencer2.influencerProfile!.id,
        offerId: offers[4].id,
        token: nanoid(),
        clicksCount: 145,
        conversionsCount: 8,
      },
    }),
  ]);

  // --- BOOKINGS + COMMISSIONS (with tracking) ---
  const bookingData = [
    { client: clients[0], offer: offers[0], trackingLink: trackingLinks[0], status: BookingStatus.COMPLETED, date: new Date("2026-03-15T10:00:00") },
    { client: clients[1], offer: offers[0], trackingLink: trackingLinks[2], status: BookingStatus.COMPLETED, date: new Date("2026-03-16T14:00:00") },
    { client: clients[2], offer: offers[2], trackingLink: trackingLinks[1], status: BookingStatus.CONFIRMED, date: new Date("2026-04-10T11:00:00") },
    { client: clients[0], offer: offers[4], trackingLink: trackingLinks[3], status: BookingStatus.PENDING, date: new Date("2026-04-12T16:00:00") },
    { client: clients[1], offer: offers[1], trackingLink: null, status: BookingStatus.COMPLETED, date: new Date("2026-03-20T09:00:00") },
    { client: clients[2], offer: offers[3], trackingLink: null, status: BookingStatus.COMPLETED, date: new Date("2026-03-22T15:00:00") },
    { client: clients[0], offer: offers[2], trackingLink: trackingLinks[1], status: BookingStatus.COMPLETED, date: new Date("2026-03-25T10:30:00") },
    { client: clients[1], offer: offers[0], trackingLink: trackingLinks[0], status: BookingStatus.CANCELLED, date: new Date("2026-03-28T13:00:00") },
    { client: clients[2], offer: offers[4], trackingLink: null, status: BookingStatus.PENDING, date: new Date("2026-04-15T11:00:00") },
    { client: clients[0], offer: offers[3], trackingLink: trackingLinks[1], status: BookingStatus.CONFIRMED, date: new Date("2026-04-08T14:00:00") },
  ];

  for (const bd of bookingData) {
    const price = Number(bd.offer.discountPrice);
    const hasInfluencer = bd.trackingLink !== null;

    // Create a dedicated slot for this booking
    const slot = await prisma.timeSlot.create({
      data: {
        offerId: bd.offer.id,
        startTime: bd.date,
        endTime: new Date(bd.date.getTime() + 60 * 60 * 1000),
        capacity: 1,
        bookedCount: bd.status === BookingStatus.CANCELLED ? 0 : 1,
      },
    });

    const booking = await prisma.booking.create({
      data: {
        clientId: bd.client.id,
        status: bd.status,
        totalPrice: price,
        notes: bd.status === BookingStatus.CANCELLED ? "Client a annulé" : null,
        items: {
          create: [{ offerId: bd.offer.id, slotId: slot.id, unitPrice: price }],
        },
      },
    });

    // Create click if tracking link exists
    if (hasInfluencer) {
      await prisma.click.create({
        data: {
          trackingLinkId: bd.trackingLink!.id,
          clientIp: `192.168.1.${Math.floor(Math.random() * 255)}`,
          userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
          referrer: "https://www.instagram.com/",
          converted: bd.status === BookingStatus.COMPLETED,
          bookingId: booking.id,
        },
      });
    }

    // Create commission
    if (hasInfluencer) {
      await prisma.commission.create({
        data: {
          bookingId: booking.id,
          providerAmount: price * 0.8,
          influencerAmount: price * 0.1,
          platformAmount: price * 0.1,
          status: bd.status === BookingStatus.COMPLETED ? CommissionStatus.PAID : CommissionStatus.PENDING,
        },
      });
    } else {
      await prisma.commission.create({
        data: {
          bookingId: booking.id,
          providerAmount: price * 0.9,
          influencerAmount: null,
          platformAmount: price * 0.1,
          status: bd.status === BookingStatus.COMPLETED ? CommissionStatus.PAID : CommissionStatus.PENDING,
        },
      });
    }
  }

  console.log("✅ Seed complete!");
  console.log("   3 prestataires, 5 offres, 2 influenceuses, 3 clientes, 1 admin");
  console.log("   10 réservations avec commissions");
  console.log("   Tous les mots de passe: password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
