/**
 * Quatre salons, un par etat de l'offre gratuite + Premium, pour tester a la
 * main chaque ecran. Appele en fin de `seed.ts`.
 *
 * Le mois offert court depuis la PREMIERE VENTE : la date des ventes de
 * chaque salon est donc posee en consequence.
 *
 * | Salon            | 1re vente il y a | Etat            | Ce qu'on y teste                                |
 * |------------------|------------------|-----------------|-------------------------------------------------|
 * | Salon Nouveau    | aucune vente     | avant 1re vente | equipe + commissions configurables sans blocage |
 * | Salon Essai J-3  | 27 jours         | essai, 3 jours  | bandeau chiffre (gerante oui, caissiere non)    |
 * | Salon Gratuit    | 35 jours         | mois ecoule     | appliquerLimiteEquipe, choix, tuile en pause    |
 * | Salon Premium    | 60 jours         | Premium, 2 mois | tout debloque                                   |
 *
 * Identifiants : e-mail ci-dessous, mot de passe `password123`. PIN de la
 * gerante 0000, des employees 1234.
 */

import type { PrismaClient } from "../src/generated/prisma/client";
import { hash } from "bcryptjs";

const JOUR = 24 * 60 * 60 * 1000;

type Salon = { providerId: string; ownerId: string; employees: string[] };

async function creerSalon(
  prisma: PrismaClient,
  args: {
    email: string;
    nom: string;
    telephone: string;
    passwordHash: string;
    pinGerante: string;
    pinEmployee: string;
    /** Premiere vente : le mois offert en part. null = aucune vente. */
    premiereVente: Date | null;
  },
): Promise<Salon> {
  const user = await prisma.user.create({
    data: {
      email: args.email,
      name: args.nom,
      role: "PROVIDER",
      passwordHash: args.passwordHash,
      emailVerified: new Date(),
      phone: args.telephone,
      providerProfile: {
        create: {
          salonName: args.nom,
          category: "COIFFURE",
          city: "Tunis",
          phone: args.telephone,
          verified: true,
          onboardingDismissedAt: new Date(),
        },
      },
    },
    include: { providerProfile: true },
  });
  const providerId = user.providerProfile!.id;

  await prisma.salonSubscription.create({
    data: { providerId, module: "POS", status: "ACTIVE" },
  });
  // Le mois offert, pose a la premiere vente comme le fait pos-sale-create.
  if (args.premiereVente) {
    await prisma.salonSubscription.create({
      data: {
        providerId,
        module: "PREMIUM",
        status: "TRIAL",
        activatedAt: args.premiereVente,
        expiresAt: new Date(args.premiereVente.getTime() + 30 * JOUR),
        pricingSnapshot: { monthlyPriceDT: 39, freeTrialDays: 30 },
        notes: "Mois offert à la première vente",
      },
    });
  }

  const owner = await prisma.salonEmployee.create({
    data: { providerId, userId: user.id, displayName: "Gérante", role: "OWNER", pinHash: args.pinGerante },
  });

  // Trois employees, connectees a des dates differentes : appliquerLimiteEquipe
  // garde la plus recente (Amel).
  const equipe = [
    { displayName: "Amel", role: "CASHIER" as const, commissionRate: "30.00", lastLoginAt: new Date(Date.now() - 1 * JOUR) },
    { displayName: "Ines", role: "STYLIST" as const, commissionRate: "25.00", lastLoginAt: new Date(Date.now() - 4 * JOUR) },
    { displayName: "Rim", role: "STYLIST" as const, commissionRate: null, lastLoginAt: new Date(Date.now() - 9 * JOUR) },
  ];
  const employees: string[] = [];
  for (const e of equipe) {
    const created = await prisma.salonEmployee.create({
      data: { providerId, ...e, pinHash: args.pinEmployee },
    });
    employees.push(created.id);
  }
  return { providerId, ownerId: owner.id, employees };
}

/** Ventes payees avec une ligne de service commissionnee, non reglee. */
async function creerVentes(
  prisma: PrismaClient,
  salon: Salon,
  clientes: string[],
  premiereVente: Date,
): Promise<void> {
  for (let i = 0; i < clientes.length; i++) {
    const closedAt = new Date(premiereVente.getTime() + i * JOUR);
    await prisma.sale.create({
      data: {
        providerId: salon.providerId,
        customerId: clientes[i],
        employeeId: salon.ownerId,
        receiptNumber: `S-SEED-${String(i + 1).padStart(4, "0")}`,
        status: "PAID",
        subtotal: "60.000",
        taxTotal: "9.580",
        total: "60.000",
        closedAt,
        createdAt: closedAt,
        items: {
          create: {
            kind: "SERVICE",
            assignedEmployeeId: salon.employees[0],
            nameSnapshot: "Brushing",
            priceSnapshot: "60.000",
            taxRateSnapshot: "19.00",
            lineSubtotal: "60.000",
            lineTaxAmount: "9.580",
            lineTotal: "60.000",
            // 30 % de 50,420 HT
            commissionRateSnapshot: "30.00",
            commissionAmount: "15.126",
          },
        },
      },
    });
  }
}

/** Clientes du salon, chacune avec un portefeuille de points. */
async function creerClientesFideles(
  prisma: PrismaClient,
  providerId: string,
  soldes: number[],
): Promise<string[]> {
  const program = await prisma.rewardProgram.create({
    data: { providerId, pointsPerDinar: "5.000", dinarPerPoint: "0.010", inactivityExpireMonths: 6 },
  });
  const ids: string[] = [];
  for (let i = 0; i < soldes.length; i++) {
    const c = await prisma.customer.create({
      data: {
        phone: `+2162000${String(i).padStart(4, "0")}${providerId.slice(-2)}`,
        firstName: ["Sonia", "Leila", "Hela", "Mouna"][i % 4],
        lastName: "Test",
        firstSalonId: providerId,
      },
    });
    await prisma.rewardWallet.create({
      data: {
        programId: program.id,
        providerId,
        customerId: c.id,
        balance: soldes[i],
        lifetimeEarned: soldes[i],
      },
    });
    ids.push(c.id);
  }
  return ids;
}

export async function seedFreemium(prisma: PrismaClient, passwordHash: string): Promise<string[]> {
  const pinGerante = await hash("0000", 10);
  const pinEmployee = await hash("1234", 10);
  const commun = { passwordHash, pinGerante, pinEmployee };
  const maintenant = Date.now();

  // 1. Aucune vente : tout est debloque, le compteur ne tourne pas.
  await creerSalon(prisma, {
    ...commun,
    email: "freemium.nouveau@example.com",
    nom: "Salon Nouveau",
    telephone: "+21650000001",
    premiereVente: null,
  });

  // 2. Premiere vente il y a 27 jours : encore 3 jours, ventes, points,
  // commissions non reglees — le bandeau chiffre s'affiche.
  const venteEssai = new Date(maintenant - 27 * JOUR);
  const essai = await creerSalon(prisma, {
    ...commun,
    email: "freemium.essai@example.com",
    nom: "Salon Essai J-3",
    telephone: "+21650000002",
    premiereVente: venteEssai,
  });
  const clientesEssai = await creerClientesFideles(prisma, essai.providerId, [450, 600, 400]);
  await creerVentes(prisma, essai, clientesEssai, venteEssai);

  // 3. Premiere vente il y a 35 jours : mois ecoule, 3 employees ENCORE
  // actives — la premiere ouverture de la caisse doit en mettre deux en pause.
  const venteGratuit = new Date(maintenant - 35 * JOUR);
  const gratuit = await creerSalon(prisma, {
    ...commun,
    email: "freemium.gratuit@example.com",
    nom: "Salon Gratuit",
    telephone: "+21650000003",
    premiereVente: venteGratuit,
  });
  const clientesGratuit = await creerClientesFideles(prisma, gratuit.providerId, [800, 250]);
  await creerVentes(prisma, gratuit, clientesGratuit, venteGratuit);

  // 4. Premiere vente il y a 60 jours, Premium paye jusqu'a dans 2 mois.
  const ventePremium = new Date(maintenant - 60 * JOUR);
  const premium = await creerSalon(prisma, {
    ...commun,
    email: "freemium.premium@example.com",
    nom: "Salon Premium",
    telephone: "+21650000004",
    premiereVente: ventePremium,
  });
  const clientesPremium = await creerClientesFideles(prisma, premium.providerId, [300]);
  await creerVentes(prisma, premium, clientesPremium, ventePremium);
  await prisma.salonSubscription.update({
    where: { providerId_module: { providerId: premium.providerId, module: "PREMIUM" } },
    data: {
      status: "ACTIVE",
      activatedAt: new Date(maintenant - 20 * JOUR),
      expiresAt: new Date(maintenant + 61 * JOUR),
      pricingSnapshot: { monthlyPriceDT: 39, months: 3 },
      notes: "Mois offert à la première vente\nSeed : Premium 3 mois — virement",
    },
  });

  return [
    "Offre Premium (mot de passe password123 · PIN gérante 0000 · PIN employées 1234) :",
    "   freemium.nouveau@example.com  — aucune vente, tout débloqué",
    "   freemium.essai@example.com    — mois offert à J-3, bandeau chiffré",
    "   freemium.gratuit@example.com  — mois offert écoulé, 3 employées à ramener à 1",
    "   freemium.premium@example.com  — Premium jusqu'à dans 2 mois",
  ];
}
