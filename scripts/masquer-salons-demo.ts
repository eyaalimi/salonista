/**
 * Retire de l'index Google les salons dont les offres sont des tests.
 *
 * Trois des six offres visibles sur l'accueil s'appelaient « test » ou
 * « test0 » : indexees par Google et presentes dans le sitemap. Le garde-fou
 * ajoute au lot E empeche d'en publier de nouvelles, mais celles deja en
 * base restent visibles.
 *
 * Poser `demo = true` sur le SALON fait passer le salon ET ses offres en
 * `noindex`, et les sort du sitemap — tout en les laissant consultables. Voir
 * docs/seo-notes.md.
 *
 * Usage :
 *   npx tsx scripts/masquer-salons-demo.ts            # inspecte, ne modifie RIEN
 *   npx tsx scripts/masquer-salons-demo.ts --apply    # applique
 *
 * Idempotent : les salons deja marques sont ignores.
 */

// `tsx` ne charge pas `.env` comme le fait Next.js : sans ces deux lignes,
// DATABASE_URL est absente et pg echoue sur « client password must be a
// string ». Meme amorce que `scripts/create-admin.ts`.
import { config } from "dotenv";
config();

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { refusTitreOffre } from "../src/lib/offer-title";

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
  const salons = await prisma.providerProfile.findMany({
    where: { demo: false },
    select: {
      id: true,
      salonName: true,
      city: true,
      offers: {
        where: { publishedToMarketplace: true },
        select: { id: true, title: true },
      },
    },
  });

  // Un salon est suspect si TOUTES ses offres publiees ont un titre de test.
  // Le critere est volontairement strict : un salon reel qui aurait laisse
  // trainer une offre « test » ne doit pas disparaitre de l'index pour
  // autant — c'est l'offre qu'il faut alors renommer, pas le salon.
  const suspects = salons.filter(
    (s) => s.offers.length > 0 && s.offers.every((o) => refusTitreOffre(o.title) !== null),
  );

  // Signale aussi les cas mixtes, sans les traiter : ils demandent une
  // decision humaine.
  const mixtes = salons.filter(
    (s) =>
      s.offers.length > 0 &&
      s.offers.some((o) => refusTitreOffre(o.title) !== null) &&
      !s.offers.every((o) => refusTitreOffre(o.title) !== null),
  );

  if (mixtes.length > 0) {
    console.log("Salons avec QUELQUES offres de test — a renommer a la main :");
    for (const s of mixtes) {
      const mauvaises = s.offers.filter((o) => refusTitreOffre(o.title) !== null);
      console.log(`  ${s.salonName}${s.city ? ` (${s.city})` : ""}`);
      for (const o of mauvaises) console.log(`      « ${o.title} »  id=${o.id}`);
    }
    console.log("");
  }

  if (suspects.length === 0) {
    console.log("Aucun salon entierement compose d'offres de test.");
    return;
  }

  console.log(`${suspects.length} salon(s) a masquer de l'index :`);
  for (const s of suspects) {
    console.log(
      `  ${s.salonName}${s.city ? ` (${s.city})` : ""} — ${s.offers.length} offre(s) : ` +
        s.offers.map((o) => `« ${o.title} »`).join(", "),
    );
  }

  if (!apply) {
    console.log(
      "\nInspection seule — rien n'a ete modifie." +
        "\nRelance avec --apply pour poser demo = true.",
    );
    return;
  }

  const { count } = await prisma.providerProfile.updateMany({
    where: { id: { in: suspects.map((s) => s.id) } },
    data: { demo: true },
  });

  console.log(`\n${count} salon(s) marque(s) demo = true.`);
  console.log("Google les retire de son index sous quelques jours.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
