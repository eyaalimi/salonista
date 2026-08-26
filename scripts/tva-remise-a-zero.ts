/**
 * Remet a 0 % la TVA des salons NON assujettis.
 *
 * Le taux etait porte par chaque offre et chaque produit, avec 19 % en dur
 * comme defaut. Les lignes creees avant le reglage « assujetti a la TVA »
 * portent donc un taux que leur salon ne collecte pas.
 *
 * La migration ne les touche pas : aucun montant ne doit bouger tout seul en
 * production. Ce script le fait explicitement, apres inspection.
 *
 * Usage :
 *   npx tsx scripts/tva-remise-a-zero.ts            # inspecte, n'ecrit RIEN
 *   npx tsx scripts/tva-remise-a-zero.ts --apply    # applique
 *
 * Idempotent : une ligne deja a 0 % est ignoree.
 *
 * NE TOUCHE PAS aux ventes passees. `SaleItem.taxRateSnapshot` fige le taux
 * au moment de l'encaissement : le reecrire falsifierait des tickets deja
 * remis a des clientes.
 */

// `tsx` ne charge pas `.env` comme le fait Next.js : sans ces deux lignes,
// DATABASE_URL est absente et pg echoue sur « client password must be a
// string ». Meme amorce que `scripts/create-admin.ts`.
import { config } from "dotenv";
config();

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const apply = process.argv.includes("--apply");

if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL introuvable. Lance le script depuis le dossier qui contient" +
      "\nle fichier .env (/home/ubuntu/salonista en production).",
  );
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL),
});

async function main() {
  if (!apply) console.log("=== INSPECTION — rien ne sera ecrit ===\n");

  const salons = await prisma.providerProfile.findMany({
    where: { vatRegistered: false },
    select: { id: true, salonName: true, city: true },
  });

  if (salons.length === 0) {
    console.log("Aucun salon non assujetti.");
    return;
  }

  const ids = salons.map((s) => s.id);

  const offres = await prisma.offer.count({
    where: { providerId: { in: ids }, taxRate: { gt: 0 } },
  });
  const produits = await prisma.product.count({
    where: { providerId: { in: ids }, taxRate: { gt: 0 } },
  });

  console.log(`${salons.length} salon(s) non assujetti(s).`);
  console.log(`  ${offres} offre(s) et ${produits} produit(s) portent encore une TVA.\n`);

  if (offres === 0 && produits === 0) {
    console.log("Rien a corriger.");
    return;
  }

  // Detail, pour que la decision soit eclairee.
  const detail = await prisma.offer.findMany({
    where: { providerId: { in: ids }, taxRate: { gt: 0 } },
    select: { title: true, taxRate: true, provider: { select: { salonName: true } } },
    take: 20,
  });
  for (const o of detail) {
    console.log(`  ${o.provider.salonName} — « ${o.title} » : ${o.taxRate} %`);
  }
  if (offres > detail.length) console.log(`  … et ${offres - detail.length} autre(s)`);

  if (!apply) {
    console.log(
      "\nInspection seule — aucune ligne modifiee." +
        "\nRelance avec --apply pour remettre ces taux a 0 %.",
    );
    return;
  }

  // Une transaction par entite, pas un verrou unique sur toute la base.
  const o = await prisma.offer.updateMany({
    where: { providerId: { in: ids }, taxRate: { gt: 0 } },
    data: { taxRate: 0 },
  });
  const p = await prisma.product.updateMany({
    where: { providerId: { in: ids }, taxRate: { gt: 0 } },
    data: { taxRate: 0 },
  });

  console.log(`\n${o.count} offre(s) et ${p.count} produit(s) remis a 0 %.`);
  console.log(
    "Les ventes DEJA encaissees gardent leur taux : leur ticket a ete remis" +
      "\na la cliente, le reecrire le falsifierait.",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
