/**
 * Injecte des ventes passees dans le salon marketing (voir
 * seed-salon-marketing.ts), pour que le tableau de bord statistiques ait
 * deja de l'allure en capture — chiffre d'affaires, graphique sur plusieurs
 * jours — sans avoir a cliquer manuellement dans l'interface.
 *
 * REUTILISE LA VRAIE LOGIQUE DE CALCUL (computeTotals de sale-totals.ts) et
 * le vrai generateur de numero de ticket (nextReceiptNumber) : les ventes
 * crees ici sont donc des Decimal strictement coherents avec ce que
 * produirait une vraie vente dans la caisse, pas des chiffres inventes a la
 * main qui pourraient diverger de la logique reelle.
 *
 * Idempotent : supprime les ventes existantes du salon marketing avant de
 * recreer, pour pouvoir etre relance sans accumuler les doublons.
 *
 * Usage :
 *   npx tsx scripts/seed-ventes-marketing.ts
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { computeTotals, type CartLineInput } from "../src/lib/sale-totals";
import { nextReceiptNumber } from "../src/lib/receipt-number";
import "dotenv/config";

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

const EMAIL = "demo.marketing@salonista.tn";

/**
 * Repartition des ventes sur les 21 derniers jours, en excluant pas tous les
 * jours : un salon n'encaisse pas forcement tous les jours, et une courbe
 * avec quelques creux est plus credible qu'une ligne parfaitement reguliere.
 *
 * Chaque entree : (jours en arriere, nombre de ventes ce jour-la).
 */
const REPARTITION: Array<[number, number]> = [
  [0, 3], [1, 2], [2, 4], [3, 1], [4, 0], [5, 3], [6, 2],
  [7, 5], [8, 2], [9, 0], [10, 3], [11, 4], [12, 1], [13, 2],
  [14, 3], [15, 0], [16, 2], [17, 4], [18, 1], [19, 3], [20, 2],
];

function heureAleatoire(jour: Date): Date {
  // Une caisse de salon encaisse surtout entre 9h et 19h.
  const heure = 9 + Math.floor(Math.random() * 10);
  const minute = Math.floor(Math.random() * 60);
  const d = new Date(jour);
  d.setHours(heure, minute, 0, 0);
  return d;
}

async function main() {
  console.log("💰 Génération des ventes marketing...");

  const user = await prisma.user.findUnique({
    where: { email: EMAIL },
    select: { id: true },
  });
  if (!user) {
    console.error("❌ Salon marketing introuvable. Lance d'abord :");
    console.error("   npx tsx scripts/seed-salon-marketing.ts");
    process.exit(1);
  }

  const provider = await prisma.providerProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!provider) {
    console.error("❌ ProviderProfile introuvable pour ce salon.");
    process.exit(1);
  }
  const providerId = provider.id;

  const employee = await prisma.salonEmployee.findFirst({
    where: { providerId, role: "OWNER" },
    select: { id: true },
  });
  if (!employee) {
    console.error("❌ Aucun employé OWNER trouvé pour ce salon.");
    process.exit(1);
  }

  const offers = await prisma.offer.findMany({
    where: { providerId, active: true },
    select: { id: true, title: true, discountPrice: true, taxRate: true },
  });
  if (offers.length === 0) {
    console.error("❌ Aucun service actif. Relance seed-salon-marketing.ts.");
    process.exit(1);
  }

  const customers = await prisma.customer.findMany({
    where: { firstSalonId: providerId },
    select: { id: true },
  });

  // Nettoyage : supprime les ventes (et items/paiements en cascade) du
  // salon marketing uniquement, jamais celles des autres salons.
  const anciennes = await prisma.sale.findMany({
    where: { providerId },
    select: { id: true },
  });
  if (anciennes.length > 0) {
    console.log(`   ${anciennes.length} vente(s) existante(s) supprimée(s)...`);
    await prisma.sale.deleteMany({ where: { providerId } });
    await prisma.saleSequence.deleteMany({ where: { providerId } });
  }

  let total = 0;

  for (const [joursEnArriere, nbVentes] of REPARTITION) {
    const jour = new Date();
    jour.setDate(jour.getDate() - joursEnArriere);

    for (let i = 0; i < nbVentes; i++) {
      // Une a deux prestations par vente, comme une vraie visite.
      const nbLignes = 1 + Math.floor(Math.random() * 2);
      const choisis = [...offers]
        .sort(() => Math.random() - 0.5)
        .slice(0, nbLignes);

      const lignes: CartLineInput[] = choisis.map((o) => ({
        kind: "SERVICE",
        offerId: o.id,
        nameSnapshot: o.title,
        priceSnapshot: o.discountPrice.toString(),
        taxRateSnapshot: o.taxRate.toString(),
        quantity: 1,
      }));

      const totaux = computeTotals({ lines: lignes });
      const createdAt = heureAleatoire(jour);
      const client =
        customers.length > 0 && Math.random() > 0.3
          ? customers[Math.floor(Math.random() * customers.length)]
          : null;

      await prisma.$transaction(async (tx) => {
        const receiptNumber = await nextReceiptNumber(tx, providerId, createdAt);

        const sale = await tx.sale.create({
          data: {
            providerId,
            employeeId: employee.id,
            customerId: client?.id ?? null,
            receiptNumber,
            status: "PAID",
            subtotal: totaux.subtotal,
            taxTotal: totaux.taxTotal,
            total: totaux.total,
            createdAt,
            closedAt: createdAt,
            items: {
              create: totaux.lines.map((l, idx) => ({
                kind: "SERVICE" as const,
                offerId: choisis[idx].id,
                nameSnapshot: choisis[idx].title,
                priceSnapshot: choisis[idx].discountPrice.toString(),
                taxRateSnapshot: choisis[idx].taxRate.toString(),
                quantity: 1,
                lineSubtotal: l.lineSubtotal,
                lineTaxAmount: l.lineTaxAmount,
                lineTotal: l.lineTotal,
              })),
            },
            payments: {
              // CASH pour toutes : c'est le mode de paiement le plus
              // representatif d'un salon de quartier en Tunisie.
              create: [{ method: "CASH", amount: totaux.total }],
            },
          },
        });
        total += Number(totaux.total);
        return sale;
      });
    }
  }

  const nbVentesTotal = REPARTITION.reduce((s, [, n]) => s + n, 0);
  console.log(`✅ ${nbVentesTotal} ventes créées sur 21 jours.`);
  console.log(`   Chiffre d'affaires total : ${total.toFixed(3)} TND`);
  console.log("");
  console.log("Le tableau de bord (/pos/analytics) a maintenant de l'allure.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
