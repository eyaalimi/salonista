// Seed credentials:
//   Provider 1 (POS + Rewards trial):  salon.nour@example.com / password123
//   Provider 2 (POS only):              institut.yasmine@example.com / password123
//   Provider 3 (no modules):            nails.mariem@example.com / password123
//   Cashier PIN (provider1 + provider2): 1234
//   Admin: run `npx tsx scripts/create-admin.ts`

import { PrismaClient, Role, Category, BookingStatus, CommissionStatus } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import { randomBytes, randomUUID } from "crypto";
import "dotenv/config";

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

function nanoid(size = 10) {
  return randomBytes(size).toString("base64url").slice(0, size);
}

async function main() {
  console.log("🌱 Seeding database...");

  // Clean existing data
  await prisma.cashDrawerSession.deleteMany();
  await prisma.refundItem.deleteMany();
  await prisma.refund.deleteMany();
  await prisma.tipAllocation.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.saleSequence.deleteMany();
  await prisma.product.deleteMany();
  await prisma.commission.deleteMany();
  await prisma.click.deleteMany();
  await prisma.collaborationRequest.deleteMany();
  await prisma.bookingItem.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.timeSlot.deleteMany();
  await prisma.trackingLink.deleteMany();
  await prisma.payout.deleteMany();
  await prisma.offer.deleteMany();
  await prisma.salonSubscription.deleteMany();
  await prisma.salonEmployee.deleteMany();
  await prisma.customer.deleteMany();
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
          matriculeFiscal: "1234567/A/M/000",
          receiptFooter: "Merci pour votre visite — à bientôt chez Salon Nour",
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

  // --- SALON EMPLOYEES (one OWNER + optional CASHIER per provider) ---
  const cashierPinHash = await hash("1234", 10);
  await prisma.salonEmployee.create({
    data: {
      providerId: provider1.providerProfile!.id,
      userId: provider1.id,
      displayName: provider1.name!,
      role: "OWNER",
    },
  });
  await prisma.salonEmployee.create({
    data: {
      providerId: provider1.providerProfile!.id,
      displayName: "Sarra (Caisse)",
      role: "CASHIER",
      pinHash: cashierPinHash,
    },
  });
  await prisma.salonEmployee.create({
    data: {
      providerId: provider2.providerProfile!.id,
      userId: provider2.id,
      displayName: provider2.name!,
      role: "OWNER",
    },
  });
  await prisma.salonEmployee.create({
    data: {
      providerId: provider2.providerProfile!.id,
      displayName: "Mounir (Caisse)",
      role: "CASHIER",
      pinHash: cashierPinHash,
    },
  });
  await prisma.salonEmployee.create({
    data: {
      providerId: provider3.providerProfile!.id,
      userId: provider3.id,
      displayName: provider3.name!,
      role: "OWNER",
    },
  });

  // --- SUBSCRIPTIONS ---
  // provider1: POS active + REWARDS trial expiring in 30 days
  // provider2: POS only
  // provider3: nothing (contrast case)
  const trialExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await prisma.salonSubscription.create({
    data: {
      providerId: provider1.providerProfile!.id,
      module: "POS",
      status: "ACTIVE",
      pricingSnapshot: { monthlyPrice: 30, currency: "DT" },
    },
  });
  await prisma.salonSubscription.create({
    data: {
      providerId: provider1.providerProfile!.id,
      module: "REWARDS",
      status: "TRIAL",
      expiresAt: trialExpiry,
      pricingSnapshot: { monthlyPrice: 20, currency: "DT" },
    },
  });
  await prisma.salonSubscription.create({
    data: {
      providerId: provider2.providerProfile!.id,
      module: "POS",
      status: "ACTIVE",
      pricingSnapshot: { monthlyPrice: 30, currency: "DT" },
    },
  });

  // --- CUSTOMERS (decoupled from User; covers walk-ins + linked clients) ---
  const customer1 = await prisma.customer.create({
    data: {
      phone: clients[0].phone!,
      firstName: "Fatma",
      lastName: "Bouzid",
      email: clients[0].email,
      userId: clients[0].id,
      firstSalonId: provider1.providerProfile!.id,
    },
  });
  const customer2 = await prisma.customer.create({
    data: {
      phone: clients[1].phone!,
      firstName: "Ines",
      lastName: "Mansouri",
      email: clients[1].email,
      userId: clients[1].id,
      firstSalonId: provider2.providerProfile!.id,
    },
  });
  // Walk-ins (no User)
  await prisma.customer.create({
    data: {
      phone: "+21622000111",
      firstName: "Salma",
      lastName: "Khelifi",
      firstSalonId: provider1.providerProfile!.id,
    },
  });
  await prisma.customer.create({
    data: {
      phone: "+21622000222",
      firstName: "Ahlem",
      lastName: "Hamdi",
      firstSalonId: provider2.providerProfile!.id,
    },
  });
  await prisma.customer.create({
    data: {
      phone: "+21622000333",
      firstName: "Yosra",
      lastName: "Ben Salem",
      firstSalonId: provider1.providerProfile!.id,
    },
  });

  const clientCustomers: Record<string, string | null> = {
    [clients[0].id]: customer1.id,
    [clients[1].id]: customer2.id,
    [clients[2].id]: null,
  };

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
        customerId: clientCustomers[bd.client.id] ?? null,
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

  // ----- POS PRODUCTS -----
  const provider1Products = await Promise.all([
    prisma.product.create({
      data: {
        providerId: provider1.providerProfile!.id,
        name: "Shampooing Kérastase Bain Satin 250ml",
        category: "HAIRCARE",
        sku: "P1-HC-001",
        barcode: "6191234500011",
        purchasePrice: 22.0,
        salePrice: 38.0,
        taxRate: 19,
        stockQuantity: 12,
        lowStockThreshold: 3,
      },
    }),
    prisma.product.create({
      data: {
        providerId: provider1.providerProfile!.id,
        name: "Masque réparateur Olaplex No.3",
        category: "HAIRCARE",
        sku: "P1-HC-002",
        barcode: "6191234500028",
        purchasePrice: 45.0,
        salePrice: 75.0,
        taxRate: 19,
        stockQuantity: 6,
        lowStockThreshold: 2,
      },
    }),
    prisma.product.create({
      data: {
        providerId: provider1.providerProfile!.id,
        name: "Spray protecteur thermique 200ml",
        category: "HAIRCARE",
        sku: "P1-HC-003",
        barcode: "6191234500035",
        purchasePrice: 18.0,
        salePrice: 32.0,
        taxRate: 19,
        stockQuantity: 9,
        lowStockThreshold: 3,
      },
    }),
    prisma.product.create({
      data: {
        providerId: provider1.providerProfile!.id,
        name: "Crème hydratante visage 50ml",
        category: "SKINCARE",
        sku: "P1-SK-001",
        barcode: "6191234500042",
        purchasePrice: 28.0,
        salePrice: 49.0,
        taxRate: 19,
        stockQuantity: 4,
        lowStockThreshold: 5,
      },
    }),
    prisma.product.create({
      data: {
        providerId: provider1.providerProfile!.id,
        name: "Sérum vitamine C 30ml",
        category: "SKINCARE",
        sku: "P1-SK-002",
        purchasePrice: 35.0,
        salePrice: 60.0,
        taxRate: 19,
        stockQuantity: 7,
        lowStockThreshold: 2,
      },
    }),
    prisma.product.create({
      data: {
        providerId: provider1.providerProfile!.id,
        name: "Brosse plate céramique",
        category: "ACCESSORIES",
        sku: "P1-AC-001",
        purchasePrice: 15.0,
        salePrice: 28.0,
        taxRate: 19,
        stockQuantity: 0,
        lowStockThreshold: 2,
      },
    }),
  ]);

  await Promise.all([
    prisma.product.create({
      data: {
        providerId: provider2.providerProfile!.id,
        name: "Huile de jojoba bio 100ml",
        category: "SKINCARE",
        sku: "P2-SK-001",
        purchasePrice: 16.0,
        salePrice: 28.0,
        taxRate: 19,
        stockQuantity: 8,
        lowStockThreshold: 2,
      },
    }),
    prisma.product.create({
      data: {
        providerId: provider2.providerProfile!.id,
        name: "Gommage corps 200g",
        category: "SKINCARE",
        sku: "P2-SK-002",
        purchasePrice: 12.0,
        salePrice: 22.0,
        taxRate: 19,
        stockQuantity: 5,
        lowStockThreshold: 2,
      },
    }),
    prisma.product.create({
      data: {
        providerId: provider2.providerProfile!.id,
        name: "Bougie aromathérapie",
        category: "WELLNESS",
        sku: "P2-WL-001",
        purchasePrice: 10.0,
        salePrice: 20.0,
        taxRate: 19,
        stockQuantity: 3,
        lowStockThreshold: 2,
      },
    }),
  ]);

  // Initial PURCHASE stock movements for provider1's products.
  for (const p of provider1Products) {
    if (p.stockQuantity > 0) {
      await prisma.stockMovement.create({
        data: {
          productId: p.id,
          delta: p.stockQuantity,
          reason: "PURCHASE",
          note: "Stock initial seed",
        },
      });
    }
  }

  // ----- SAMPLE SALES -----
  // Find provider1's OWNER employee for the seeded sales.
  const provider1Owner = await prisma.salonEmployee.findFirst({
    where: { providerId: provider1.providerProfile!.id, role: "OWNER" },
  });
  const provider1Cashier = await prisma.salonEmployee.findFirst({
    where: { providerId: provider1.providerProfile!.id, role: "CASHIER" },
  });
  const provider1Customer = await prisma.customer.findFirst({
    where: { firstSalonId: provider1.providerProfile!.id, userId: { not: null } },
  });

  if (provider1Owner && provider1Cashier && provider1Customer) {
    // Sale 1: 1 service + 1 product, cash, with tip.
    const offer1 = offers[0]; // Lissage Brésilien
    const product1 = provider1Products[0]; // Shampooing
    const sale1Date = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const sale1 = await prisma.sale.create({
      data: {
        providerId: provider1.providerProfile!.id,
        customerId: provider1Customer.id,
        employeeId: provider1Cashier.id,
        receiptNumber: "S-SEED-0001",
        status: "PAID",
        subtotal: 143.0,
        discountAmount: 0,
        taxTotal: 22.840,
        tipTotal: 7.0,
        total: 150.0,
        closedAt: sale1Date,
        createdAt: sale1Date,
        items: {
          create: [
            {
              kind: "SERVICE",
              offerId: offer1.id,
              assignedEmployeeId: provider1Owner.id,
              nameSnapshot: offer1.title,
              priceSnapshot: 105.0,
              taxRateSnapshot: 19,
              quantity: 1,
              lineSubtotal: 105.0,
              lineTaxAmount: 16.765,
              lineTotal: 105.0,
            },
            {
              kind: "PRODUCT",
              productId: product1.id,
              nameSnapshot: product1.name,
              priceSnapshot: 38.0,
              taxRateSnapshot: 19,
              quantity: 1,
              lineSubtotal: 38.0,
              lineTaxAmount: 6.067,
              lineTotal: 38.0,
            },
          ],
        },
        payments: {
          create: [{ method: "CASH", amount: 150.0 }],
        },
        tipAllocations: {
          create: [{ employeeId: provider1Owner.id, amount: 7.0 }],
        },
      },
    });
    await prisma.product.update({
      where: { id: product1.id },
      data: { stockQuantity: { decrement: 1 } },
    });
    await prisma.stockMovement.create({
      data: {
        productId: product1.id,
        delta: -1,
        reason: "SALE",
        saleId: sale1.id,
        employeeId: provider1Cashier.id,
      },
    });

    // Sale 2: 2 products, card payment, with a partial refund applied later.
    const product2 = provider1Products[1];
    const product3 = provider1Products[2];
    const sale2Date = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    const sale2 = await prisma.sale.create({
      data: {
        providerId: provider1.providerProfile!.id,
        customerId: provider1Customer.id,
        employeeId: provider1Cashier.id,
        receiptNumber: "S-SEED-0002",
        status: "PARTIALLY_REFUNDED",
        subtotal: 107.0,
        discountAmount: 0,
        taxTotal: 17.084,
        tipTotal: 0,
        total: 107.0,
        refundedTotal: 32.0,
        closedAt: sale2Date,
        createdAt: sale2Date,
        items: {
          create: [
            {
              kind: "PRODUCT",
              productId: product2.id,
              nameSnapshot: product2.name,
              priceSnapshot: 75.0,
              taxRateSnapshot: 19,
              quantity: 1,
              lineSubtotal: 75.0,
              lineTaxAmount: 11.975,
              lineTotal: 75.0,
            },
            {
              kind: "PRODUCT",
              productId: product3.id,
              nameSnapshot: product3.name,
              priceSnapshot: 32.0,
              taxRateSnapshot: 19,
              quantity: 1,
              refundedQuantity: 1,
              lineSubtotal: 32.0,
              lineTaxAmount: 5.109,
              lineTotal: 32.0,
            },
          ],
        },
        payments: {
          create: [{ method: "CARD", amount: 107.0, reference: "AUTH-SEED" }],
        },
      },
      include: { items: true },
    });
    await prisma.product.update({
      where: { id: product2.id },
      data: { stockQuantity: { decrement: 1 } },
    });
    // product3 was sold then refunded — net stock unchanged, but we record both movements.
    await prisma.stockMovement.create({
      data: {
        productId: product2.id,
        delta: -1,
        reason: "SALE",
        saleId: sale2.id,
        employeeId: provider1Cashier.id,
      },
    });
    const product3SaleItem = sale2.items.find((it) => it.productId === product3.id)!;
    const refund = await prisma.refund.create({
      data: {
        saleId: sale2.id,
        employeeId: provider1Cashier.id,
        reason: "PRODUCT_DEFECT",
        notes: "Spray défectueux signalé par la cliente",
        totalAmount: 32.0,
        refundMethod: "CASH",
        items: {
          create: [
            {
              saleItemId: product3SaleItem.id,
              productId: product3.id,
              quantity: 1,
              amountRefunded: 32.0,
              restock: true,
            },
          ],
        },
      },
    });
    await prisma.stockMovement.create({
      data: {
        productId: product3.id,
        delta: -1,
        reason: "SALE",
        saleId: sale2.id,
        employeeId: provider1Cashier.id,
      },
    });
    await prisma.stockMovement.create({
      data: {
        productId: product3.id,
        delta: 1,
        reason: "RETURN",
        refundId: refund.id,
        employeeId: provider1Cashier.id,
        note: "Retour suite remboursement",
      },
    });
  }

  // Quiet helper to avoid the "randomUUID unused" lint complaint.
  void randomUUID;

  // ----- PHASE 3: future bookings + cash drawer sessions -----
  // Prereqs: provider1Owner, provider1Cashier already located above.
  if (provider1Owner && provider1Cashier) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 8 future bookings for provider1 across the next 7 days.
    const futurePlan: Array<{ offerIdx: number; dayOffset: number; hour: number; client: typeof clients[number]; createdViaPos: boolean }> = [
      { offerIdx: 0, dayOffset: 1, hour: 10, client: clients[0], createdViaPos: false },
      { offerIdx: 1, dayOffset: 1, hour: 14, client: clients[1], createdViaPos: false },
      { offerIdx: 0, dayOffset: 2, hour: 11, client: clients[2], createdViaPos: true },
      { offerIdx: 1, dayOffset: 2, hour: 16, client: clients[0], createdViaPos: true },
      { offerIdx: 0, dayOffset: 3, hour: 9, client: clients[1], createdViaPos: false },
      { offerIdx: 1, dayOffset: 4, hour: 13, client: clients[2], createdViaPos: false },
      { offerIdx: 0, dayOffset: 5, hour: 15, client: clients[0], createdViaPos: true },
      { offerIdx: 1, dayOffset: 6, hour: 10, client: clients[1], createdViaPos: false },
    ];

    for (const p of futurePlan) {
      const offer = offers[p.offerIdx];
      const date = new Date(today);
      date.setDate(date.getDate() + p.dayOffset);
      date.setHours(p.hour, 0, 0, 0);
      const slot = await prisma.timeSlot.create({
        data: {
          offerId: offer.id,
          startTime: date,
          endTime: new Date(date.getTime() + offer.durationMinutes * 60_000),
          capacity: 1,
          bookedCount: 1,
        },
      });
      await prisma.booking.create({
        data: {
          clientId: p.client.id,
          customerId: clientCustomers[p.client.id] ?? null,
          assignedEmployeeId: provider1Owner.id,
          createdViaPos: p.createdViaPos,
          phantom: false,
          status: BookingStatus.CONFIRMED,
          totalPrice: Number(offer.discountPrice),
          items: {
            create: [{ offerId: offer.id, slotId: slot.id, unitPrice: Number(offer.discountPrice) }],
          },
        },
      });
    }

    // 1 closed cash drawer session from yesterday (with -2.5 DT variance).
    const yStart = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    yStart.setHours(9, 0, 0, 0);
    const yEnd = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    yEnd.setHours(19, 0, 0, 0);
    await prisma.cashDrawerSession.create({
      data: {
        providerId: provider1.providerProfile!.id,
        employeeId: provider1Cashier.id,
        status: "CLOSED",
        openedAt: yStart,
        closedAt: yEnd,
        openingFloat: 50.0,
        closingCount: 197.5,
        expectedCash: 200.0,
        variance: -2.5,
        openingNotes: "Fond fourni par Nour",
        closingNotes: "Petit écart probable (rendu de monnaie)",
      },
    });

    // 1 currently-open session for the cashier.
    await prisma.cashDrawerSession.create({
      data: {
        providerId: provider1.providerProfile!.id,
        employeeId: provider1Cashier.id,
        status: "OPEN",
        openingFloat: 50.0,
        openingNotes: "Fond du jour",
      },
    });
  }

  // Provider 2: 4 future bookings + 1 closed session with zero variance.
  const provider2Owner = await prisma.salonEmployee.findFirst({
    where: { providerId: provider2.providerProfile!.id, role: "OWNER" },
  });
  const provider2Cashier = await prisma.salonEmployee.findFirst({
    where: { providerId: provider2.providerProfile!.id, role: "CASHIER" },
  });
  if (provider2Owner && provider2Cashier) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const p2Plan: Array<{ offerIdx: number; dayOffset: number; hour: number; client: typeof clients[number] }> = [
      { offerIdx: 2, dayOffset: 1, hour: 11, client: clients[0] },
      { offerIdx: 3, dayOffset: 2, hour: 14, client: clients[1] },
      { offerIdx: 2, dayOffset: 3, hour: 16, client: clients[2] },
      { offerIdx: 3, dayOffset: 5, hour: 10, client: clients[0] },
    ];
    for (const p of p2Plan) {
      const offer = offers[p.offerIdx];
      const date = new Date(today);
      date.setDate(date.getDate() + p.dayOffset);
      date.setHours(p.hour, 0, 0, 0);
      const slot = await prisma.timeSlot.create({
        data: {
          offerId: offer.id,
          startTime: date,
          endTime: new Date(date.getTime() + offer.durationMinutes * 60_000),
          capacity: 1,
          bookedCount: 1,
        },
      });
      await prisma.booking.create({
        data: {
          clientId: p.client.id,
          customerId: clientCustomers[p.client.id] ?? null,
          assignedEmployeeId: provider2Owner.id,
          createdViaPos: false,
          status: BookingStatus.CONFIRMED,
          totalPrice: Number(offer.discountPrice),
          items: {
            create: [{ offerId: offer.id, slotId: slot.id, unitPrice: Number(offer.discountPrice) }],
          },
        },
      });
    }

    const yStart2 = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    yStart2.setHours(10, 0, 0, 0);
    const yEnd2 = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    yEnd2.setHours(18, 0, 0, 0);
    await prisma.cashDrawerSession.create({
      data: {
        providerId: provider2.providerProfile!.id,
        employeeId: provider2Cashier.id,
        status: "CLOSED",
        openedAt: yStart2,
        closedAt: yEnd2,
        openingFloat: 30.0,
        closingCount: 30.0,
        expectedCash: 30.0,
        variance: 0,
      },
    });
  }

  // --- PHASE 4: REWARDS (provider1 only — REWARDS active per Phase 1 seed) ---
  // Cashback 3% (1 DT spent = 3 pts; 100 pts = 1 DT). Welcome 100, birthday 50,
  // inactivity 12 months. Wallets seeded for 3 customers with mixed histories.
  const program = await prisma.rewardProgram.create({
    data: {
      providerId: provider1.providerProfile!.id,
      pointsPerDinar: "3.000",
      dinarPerPoint: "0.010",
      minPointsToRedeem: 100,
      maxRedemptionPctPerSale: 50,
      eligibleOn: "BOTH",
      welcomeBonusPoints: 100,
      birthdayBonusPoints: 50,
      inactivityExpireMonths: 12,
      active: true,
      displayName: `${provider1.providerProfile!.salonName} Fidélité`,
    },
  });

  const seedCustomers = await prisma.customer.findMany({
    where: { firstSalonId: provider1.providerProfile!.id },
    select: { id: true },
    take: 3,
  });

  for (let i = 0; i < seedCustomers.length; i++) {
    const c = seedCustomers[i];
    const wallet = await prisma.rewardWallet.create({
      data: {
        programId: program.id,
        providerId: provider1.providerProfile!.id,
        customerId: c.id,
        balance: 0,
        welcomeBonusApplied: true,
      },
    });

    // History: welcome bonus + a couple of EARN_PURCHASE rows.
    let bal = 0;
    bal += 100;
    await prisma.rewardTransaction.create({
      data: {
        walletId: wallet.id,
        delta: 100,
        balanceAfter: bal,
        reason: "WELCOME_BONUS",
        createdAt: new Date(Date.now() - 60 * 24 * 3600 * 1000),
      },
    });
    bal += 180;
    await prisma.rewardTransaction.create({
      data: {
        walletId: wallet.id,
        delta: 180,
        balanceAfter: bal,
        reason: "EARN_PURCHASE",
        createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1000),
      },
    });
    if (i === 0) {
      // Customer 1 has a redemption.
      bal -= 100;
      await prisma.rewardTransaction.create({
        data: {
          walletId: wallet.id,
          delta: -100,
          balanceAfter: bal,
          reason: "REDEEM_PURCHASE",
          createdAt: new Date(Date.now() - 20 * 24 * 3600 * 1000),
        },
      });
    }
    if (i === 1) {
      // Customer 2 has a refund clawback.
      bal -= 30;
      await prisma.rewardTransaction.create({
        data: {
          walletId: wallet.id,
          delta: -30,
          balanceAfter: bal,
          reason: "REFUND_REVERSAL",
          createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1000),
        },
      });
    }
    bal += 90;
    await prisma.rewardTransaction.create({
      data: {
        walletId: wallet.id,
        delta: 90,
        balanceAfter: bal,
        reason: "EARN_PURCHASE",
        createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000),
      },
    });

    await prisma.rewardWallet.update({
      where: { id: wallet.id },
      data: {
        balance: bal,
        lifetimeEarned: 370,
        lifetimeRedeemed: i === 0 ? 100 : 0,
      },
    });
  }

  console.log("✅ Seed complete!");
  console.log("   3 prestataires, 5 offres, 2 influenceuses, 3 clientes, 1 admin");
  console.log("   10 réservations avec commissions");
  console.log("   9 produits POS + 2 ventes seedées (provider1)");
  console.log("   12 réservations futures + 3 sessions de caisse seedées");
  console.log("   Phase 4: programme fidélité provider1 (3% cashback) + 3 portefeuilles");
  console.log("   Tous les mots de passe: password123 · PIN cashier: 1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
