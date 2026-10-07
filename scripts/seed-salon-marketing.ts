/**
 * Cree un salon fictif DEDIE aux captures marketing (HyperFrames, demos,
 * captures d'ecran publiques).
 *
 * POURQUOI UN SCRIPT SEPARE de seed.ts : les trois salons du seed principal
 * (Salon Nour, Institut Yasmine, Mariem Nails Art) ont des clientes aux
 * numeros au format tunisien plausible (+216...). Les montrer dans une
 * video PUBLIQUE, meme "de demo", cree une confusion involontaire avec de
 * vraies personnes. Ce script cree un salon a part, explicitement marque
 * comme demo (`demo: true`), avec des noms et numeros qui ne peuvent PAS
 * etre pris pour de vraies clientes.
 *
 * Idempotent : peut etre relance sans dupliquer (supprime et recree le
 * salon marketing existant).
 *
 * Usage :
 *   npx tsx scripts/seed-salon-marketing.ts
 */

import { PrismaClient, Category } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import "dotenv/config";

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

const EMAIL = "demo.marketing@salonista.tn";
const SALON_NAME = "Salon Démo Salonista";

// Numeros volontairement NON plausibles (prefixe 000) : aucune chance de
// coincider avec un vrai numero tunisien, reconnaissable comme fictif meme
// a l'oeil nu dans une capture.
const CLIENTES = [
  { firstName: "Cliente", lastName: "Démo 1", phone: "walk-in-demo-000001" },
  { firstName: "Cliente", lastName: "Démo 2", phone: "walk-in-demo-000002" },
  { firstName: "Cliente", lastName: "Démo 3", phone: "walk-in-demo-000003" },
];

// Prix ronds et lisibles a l'ecran, duree realiste. Les noms couvrent les
// familles les plus photogeniques pour une grille de services.
const SERVICES = [
  { title: "Coupe & Brushing", category: Category.COIFFURE, price: "45.000", duration: 45 },
  { title: "Coloration", category: Category.COIFFURE, price: "80.000", duration: 90 },
  { title: "Soin du visage", category: Category.ESTHETIQUE, price: "60.000", duration: 60 },
  { title: "Manucure", category: Category.ONGLERIE, price: "25.000", duration: 30 },
  { title: "Pédicure", category: Category.ONGLERIE, price: "30.000", duration: 40 },
  { title: "Massage relaxant", category: Category.MASSAGE, price: "70.000", duration: 60 },
];

async function main() {
  console.log("🎬 Préparation du salon marketing...");

  const ancien = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (ancien) {
    console.log("   Salon existant trouvé, suppression avant recréation...");
    // onDelete: Cascade sur ProviderProfile supprime offres, employes, etc.
    await prisma.user.delete({ where: { id: ancien.id } });
  }

  const passwordHash = await hash("DemoMarketing2026!", 10);
  const pinHash = await hash("0000", 10);

  const user = await prisma.user.create({
    data: {
      email: EMAIL,
      passwordHash,
      role: "PROVIDER",
      name: SALON_NAME,
      emailVerified: new Date(),
    },
  });

  const provider = await prisma.providerProfile.create({
    data: {
      userId: user.id,
      salonName: SALON_NAME,
      category: Category.COIFFURE,
      city: "Tunis",
      governorate: "Tunis",
      phone: "+21600000000", // prefixe 000 : non attribuable, non plausible
      // CRUCIAL : exclu de l'index Google et du sitemap (voir note 19 de
      // CLAUDE.md), tout en restant parfaitement consultable pour les
      // captures manuelles.
      demo: true,
      verified: true,
    },
  });

  await prisma.salonEmployee.create({
    data: {
      providerId: provider.id,
      userId: user.id,
      displayName: "Gérante",
      role: "OWNER",
      pinHash,
      active: true,
    },
  });

  await prisma.salonSubscription.create({
    data: { providerId: provider.id, module: "POS", status: "ACTIVE" },
  });

  const offers = [];
  for (const s of SERVICES) {
    const offer = await prisma.offer.create({
      data: {
        providerId: provider.id,
        title: s.title,
        category: s.category,
        discountPrice: s.price,
        originalPrice: s.price,
        durationMinutes: s.duration,
        taxRate: "19.00",
        active: true,
        publishedToMarketplace: false,
        photos: [],
      },
    });
    offers.push(offer);
  }

  const clients = [];
  for (const c of CLIENTES) {
    const client = await prisma.customer.create({
      data: {
        firstName: c.firstName,
        lastName: c.lastName,
        phone: c.phone,
        firstSalonId: provider.id,
      },
    });
    clients.push(client);
  }

  console.log(`✅ Salon marketing créé : ${SALON_NAME}`);
  console.log(`   Email  : ${EMAIL}`);
  console.log(`   Mot de passe : DemoMarketing2026!`);
  console.log(`   PIN caisse   : 0000`);
  console.log(`   ${offers.length} services, ${clients.length} clientes fictives.`);
  console.log("");
  console.log("⚠️  Ce salon est marqué demo=true : exclu de l'index Google");
  console.log("   et du sitemap, mais reste accessible pour tes captures.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
