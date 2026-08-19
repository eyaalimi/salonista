/**
 * Retire le salon cree par erreur sur un compte, et rend a ce compte son role.
 *
 * Contexte : l'inscription caisse (`/api/pos/signup`) fait un `user.update`
 * quand l'email existe deja. Un compte ADMIN qui s'y inscrit est donc bascule
 * en PROVIDER et perd l'acces a son espace d'administration.
 *
 * Usage :
 *   npx tsx scripts/fix-admin-salon.ts <email>            # inspecte, ne modifie RIEN
 *   npx tsx scripts/fix-admin-salon.ts <email> --apply    # applique
 *
 * Sans `--apply`, le script se contente d'afficher ce qu'il ferait. Lance-le
 * d'abord ainsi : c'est une base de production, on regarde avant d'agir.
 *
 * Le compte User n'est JAMAIS supprime — seul le ProviderProfile l'est, et
 * toutes ses donnees liees partent en cascade (employes, abonnements, offres,
 * produits, ventes, sessions de caisse, cartes de fidelite).
 */

import { prisma } from "../src/lib/prisma";

const email = process.argv[2]?.trim().toLowerCase();
const apply = process.argv.includes("--apply");

if (!email) {
  console.error("Usage : npx tsx scripts/fix-admin-salon.ts <email> [--apply]");
  process.exit(1);
}

async function main() {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      providerProfile: {
        include: {
          _count: {
            select: {
              offers: true,
              employees: true,
              products: true,
              sales: true,
              cashDrawerSessions: true,
              subscriptions: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    console.error(`Aucun compte avec l'email ${email}.`);
    process.exit(1);
  }

  console.log(`\nCompte   : ${user.email}`);
  console.log(`Role     : ${user.role}`);
  console.log(`Nom      : ${user.name ?? "(vide)"}`);

  if (!user.providerProfile) {
    console.log("\nAucun salon rattache a ce compte — rien a supprimer.");
    if (user.role !== "ADMIN") {
      console.log(`\nEn revanche le role est ${user.role}, pas ADMIN.`);
      if (apply) {
        await prisma.user.update({
          where: { id: user.id },
          data: { role: "ADMIN" },
        });
        console.log("Role remis a ADMIN.");
      } else {
        console.log("Relance avec --apply pour le remettre a ADMIN.");
      }
    }
    return;
  }

  const p = user.providerProfile;
  console.log(`\nSalon    : ${p.salonName} (${p.id})`);
  console.log("Donnees qui seront supprimees en cascade :");
  console.log(`  offres            ${p._count.offers}`);
  console.log(`  employes          ${p._count.employees}`);
  console.log(`  produits          ${p._count.products}`);
  console.log(`  ventes            ${p._count.sales}`);
  console.log(`  sessions caisse   ${p._count.cashDrawerSessions}`);
  console.log(`  abonnements       ${p._count.subscriptions}`);

  // Garde-fou : un salon qui a des ventes ou des offres n'est pas une erreur
  // d'inscription, c'est un vrai salon. On refuse de le supprimer sans une
  // confirmation explicite supplementaire.
  const hasRealActivity = p._count.sales > 0 || p._count.offers > 0;
  if (hasRealActivity && !process.argv.includes("--force")) {
    console.error(
      "\nARRET : ce salon a des ventes ou des offres — il ne ressemble pas a" +
        "\nune inscription faite par erreur. Verifie qu'il s'agit bien du bon" +
        "\ncompte, puis relance avec --force si tu confirmes la suppression.",
    );
    process.exit(1);
  }

  if (!apply) {
    console.log("\n--- SIMULATION, rien n'a ete modifie ---");
    console.log("Actions qui seraient faites :");
    console.log(`  1. supprimer le ProviderProfile ${p.id} (et sa cascade)`);
    console.log(`  2. remettre le role du compte a ADMIN (actuel : ${user.role})`);
    console.log("\nRelance avec --apply pour les executer.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.providerProfile.delete({ where: { id: p.id } });
    await tx.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
  });

  console.log("\nFait :");
  console.log(`  salon « ${p.salonName} » supprime`);
  console.log("  role du compte remis a ADMIN");
  console.log("\nDeconnecte-toi puis reconnecte-toi pour rafraichir ta session.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
