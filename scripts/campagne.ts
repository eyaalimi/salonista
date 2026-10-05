/**
 * Gestion des campagnes marketing.
 *
 * Usage :
 *   npx tsx scripts/campagne.ts list
 *   npx tsx scripts/campagne.ts creer <slug> "<nom>" "<canal>" [budget-DT] [--apply]
 *   npx tsx scripts/campagne.ts supprimer <slug> [--apply]
 *
 * INSPECTE PAR DEFAUT, comme les autres scripts du depot.
 *
 * Pourquoi un script et pas un formulaire : creer une campagne est un geste
 * rare (quelques-unes par mois) et le faire en ligne de commande evite
 * d'exposer une ecriture de plus dans l'espace superadmin. Un formulaire
 * pourra venir si le rythme le justifie.
 */

import { config } from "dotenv";
config();

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { slugValide } from "../src/lib/campagne-attribution";

const prisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL!),
});

const ORIGINE = process.env.NEXTAUTH_URL || "https://salonista.tn";

function usage(): never {
  console.error(
    [
      "Usage :",
      "  npx tsx scripts/campagne.ts list",
      '  npx tsx scripts/campagne.ts creer <slug> "<nom>" "<canal>" [budget-DT] [--apply]',
      "  npx tsx scripts/campagne.ts supprimer <slug> [--apply]",
      "",
      "Le slug voyage dans /c/<slug> : minuscules, chiffres et tirets.",
      "Exemple :",
      '  npx tsx scripts/campagne.ts creer fb-octobre "Facebook octobre" "Facebook" 300 --apply',
    ].join("\n"),
  );
  process.exit(1);
}

async function lister() {
  const campagnes = await prisma.campaign.findMany({ orderBy: { startsAt: "desc" } });
  if (campagnes.length === 0) {
    console.log("Aucune campagne.");
    return;
  }
  console.log(`${campagnes.length} campagne(s) :\n`);
  for (const c of campagnes) {
    const clics = await prisma.campaignEvent.count({
      where: { campaignId: c.id, type: "CLIC" },
    });
    const inscrits = await prisma.providerProfile.count({ where: { campaignId: c.id } });
    const budget =
      c.budgetMillimes === null ? "sans budget" : `${(c.budgetMillimes / 1000).toFixed(3)} DT`;
    console.log(`  ${c.name}  [${c.channel}]`);
    console.log(`    ${ORIGINE}/c/${c.slug}`);
    console.log(`    ${clics} clic(s), ${inscrits} inscrit(s), ${budget}`);
  }
}

async function creer(
  slug: string,
  nom: string,
  canal: string,
  budgetDt: string | undefined,
  appliquer: boolean,
) {
  if (!slugValide(slug)) {
    console.error(
      `Slug invalide : « ${slug} ».\n` +
        "Minuscules, chiffres et tirets ; 3 a 50 caracteres ; ni tiret au debut ni a la fin.\n" +
        "Il est imprime sur des flyers et dicte au telephone.",
    );
    process.exit(1);
  }

  const existante = await prisma.campaign.findUnique({ where: { slug } });
  if (existante) {
    console.error(`Le slug « ${slug} » est deja pris par « ${existante.name} ».`);
    process.exit(1);
  }

  // Le budget est saisi en DINARS (ce que lit un humain) et stocke en
  // MILLIMES entiers (le dinar a 3 decimales, et la monnaie ne flotte pas).
  let budgetMillimes: number | null = null;
  if (budgetDt !== undefined) {
    const n = Number(budgetDt.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) {
      console.error(`Budget invalide : « ${budgetDt} ». Attendu un nombre de dinars.`);
      process.exit(1);
    }
    budgetMillimes = Math.round(n * 1000);
  }

  console.log(`Campagne   : ${nom}`);
  console.log(`Canal      : ${canal}`);
  console.log(`Lien court : ${ORIGINE}/c/${slug}`);
  console.log(
    `Budget     : ${budgetMillimes === null ? "aucun" : `${(budgetMillimes / 1000).toFixed(3)} DT`}`,
  );

  if (!appliquer) {
    console.log("\n(inspection — ajoute --apply pour creer)");
    return;
  }

  await prisma.campaign.create({
    data: {
      slug,
      name: nom,
      channel: canal,
      startsAt: new Date(),
      budgetMillimes,
      // Deduits du canal : ce sont les valeurs qui atterriront dans l'URL.
      utmSource: canal.toLowerCase().replace(/\s+/g, "-"),
      utmMedium: budgetMillimes === null ? "organique" : "paye",
    },
  });

  console.log(`\nCree. Diffuse ce lien : ${ORIGINE}/c/${slug}`);
}

async function supprimer(slug: string, appliquer: boolean) {
  const c = await prisma.campaign.findUnique({ where: { slug } });
  if (!c) {
    console.error(`Aucune campagne « ${slug} ».`);
    process.exit(1);
  }
  const inscrits = await prisma.providerProfile.count({ where: { campaignId: c.id } });

  console.log(`Supprimer « ${c.name} » (${slug})`);
  console.log(`  ${inscrits} salon(s) lui sont attribues.`);
  console.log(
    "  Ils ne seront PAS supprimes : leur champ campagne passe a vide, mais\n" +
      "  les UTM restent et racontent toujours d'ou ils viennent.",
  );

  if (!appliquer) {
    console.log("\n(inspection — ajoute --apply pour supprimer)");
    return;
  }
  await prisma.campaign.delete({ where: { id: c.id } });
  console.log("\nSupprimee.");
}

async function main() {
  const args = process.argv.slice(2);
  const appliquer = args.includes("--apply");
  const positionnels = args.filter((a) => !a.startsWith("--"));
  const [commande, a, b, c, d] = positionnels;

  switch (commande) {
    case "list":
      await lister();
      break;
    case "creer":
      if (!a || !b || !c) usage();
      await creer(a, b, c, d, appliquer);
      break;
    case "supprimer":
      if (!a) usage();
      await supprimer(a, appliquer);
      break;
    default:
      usage();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
