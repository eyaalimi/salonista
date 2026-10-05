/**
 * Gestion des comptes SUPERADMIN — le SEUL moyen d'en creer un.
 *
 * Aucune interface web ne peut attribuer ce role : aucune route API n'ecrit
 * `role: "SUPERADMIN"`, et un test le verrouille
 * (superadmin-pas-de-creation-web.test.ts). Le seul chemin est ce script, qui
 * exige un acces au serveur.
 *
 * Usage :
 *   npx tsx scripts/superadmin.ts list
 *   npx tsx scripts/superadmin.ts promote <email> [--apply]
 *   npx tsx scripts/superadmin.ts revoke  <email> [--apply]
 *   npx tsx scripts/superadmin.ts reset-totp <email> [--apply]
 *
 * INSPECTE PAR DEFAUT, comme les autres scripts du depot
 * (masquer-salons-demo.ts, tva-remise-a-zero.ts) : sans `--apply`, il annonce
 * ce qu'il ferait sans rien ecrire. Promouvoir un compte par megarde sur la
 * production n'est pas rattrapable discretement.
 *
 * L'enrolement TOTP se fait ensuite dans le navigateur, au premier acces :
 * ce script ne pose PAS de secret. Un secret transmis par copier-coller dans
 * un terminal finirait dans l'historique du shell.
 */

import { config } from "dotenv";
config();

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL!),
});

function usage(): never {
  console.error(
    [
      "Usage :",
      "  npx tsx scripts/superadmin.ts list",
      "  npx tsx scripts/superadmin.ts promote    <email> [--apply]",
      "  npx tsx scripts/superadmin.ts revoke     <email> [--apply]",
      "  npx tsx scripts/superadmin.ts reset-totp <email> [--apply]",
      "",
      "Sans --apply, le script inspecte sans rien modifier.",
    ].join("\n"),
  );
  process.exit(1);
}

async function lister() {
  const comptes = await prisma.user.findMany({
    where: { role: "SUPERADMIN" },
    select: {
      email: true,
      name: true,
      superadminSince: true,
      totpConfirmedAt: true,
      totpLockedUntil: true,
    },
    orderBy: { superadminSince: "asc" },
  });

  if (comptes.length === 0) {
    console.log("Aucun compte SUPERADMIN.");
    return;
  }

  console.log(`${comptes.length} compte(s) SUPERADMIN :\n`);
  for (const c of comptes) {
    const deuxFa = c.totpConfirmedAt
      ? `2FA active le ${c.totpConfirmedAt.toISOString().slice(0, 10)}`
      : "2FA PAS ENCORE ENROLEE";
    const verrou =
      c.totpLockedUntil && c.totpLockedUntil > new Date()
        ? `  [VERROUILLE jusqu'a ${c.totpLockedUntil.toISOString()}]`
        : "";
    console.log(`  ${c.email}`);
    console.log(`    ${c.name ?? "(sans nom)"} — ${deuxFa}${verrou}`);
  }
}

async function promouvoir(email: string, appliquer: boolean) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, email: true, role: true, name: true },
  });

  if (!user) {
    console.error(`Aucun compte avec l'email ${email}.`);
    console.error("Cree d'abord le compte normalement, puis promeus-le ici.");
    process.exit(1);
  }
  if (user.role === "SUPERADMIN") {
    console.log(`${user.email} est deja SUPERADMIN. Rien a faire.`);
    return;
  }

  console.log(`${user.email} : ${user.role} -> SUPERADMIN`);
  if (user.role === "PROVIDER") {
    // Un salon promu perdrait l'acces a sa propre caisse : le middleware
    // exige PROVIDER pour /prestataire, et la caisse passe par une session
    // PIN distincte. Mieux vaut un compte dedie.
    console.warn(
      "  ATTENTION : ce compte est un SALON. Le promouvoir lui ferait perdre\n" +
        "  l'acces a son espace prestataire. Utilise un compte dedie.",
    );
  }

  if (!appliquer) {
    console.log("\n(inspection — ajoute --apply pour appliquer)");
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      role: "SUPERADMIN",
      superadminSince: new Date(),
      // On remet la 2FA a zero : le compte devra l'enroler au premier acces.
      totpSecret: null,
      totpConfirmedAt: null,
      totpLastUsedStep: null,
      totpFailedAttempts: 0,
      totpLockedUntil: null,
    },
  });
  console.log("\nFait. Prochaine etape : se connecter sur /superadmin pour");
  console.log("enroler la double authentification (QR a scanner).");
}

async function revoquer(email: string, appliquer: boolean) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, email: true, role: true },
  });

  if (!user || user.role !== "SUPERADMIN") {
    console.error(`${email} n'est pas SUPERADMIN.`);
    process.exit(1);
  }

  const restants = await prisma.user.count({ where: { role: "SUPERADMIN" } });
  if (restants <= 1) {
    // Se retirer le dernier acces fondateur demanderait un acces a la base
    // pour revenir. Le script refuse plutot que de laisser l'equipe dehors.
    console.error(
      "REFUSE : c'est le DERNIER compte SUPERADMIN.\n" +
        "Promeus-en un autre avant de revoquer celui-ci.",
    );
    process.exit(1);
  }

  console.log(`${user.email} : SUPERADMIN -> ADMIN`);
  if (!appliquer) {
    console.log("\n(inspection — ajoute --apply pour appliquer)");
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      role: "ADMIN",
      superadminSince: null,
      totpSecret: null,
      totpConfirmedAt: null,
      totpLastUsedStep: null,
      totpFailedAttempts: 0,
      totpLockedUntil: null,
    },
  });
  // Le callback `jwt` relit le role en base a chaque cycle de jeton : la
  // revocation prend effet a la requete suivante, sans deconnexion forcee.
  console.log("\nFait. L'acces est ferme des la prochaine requete.");
  console.log("Le journal d'audit de ce compte est CONSERVE.");
}

async function reinitialiserTotp(email: string, appliquer: boolean) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, email: true, role: true, totpConfirmedAt: true },
  });

  if (!user || user.role !== "SUPERADMIN") {
    console.error(`${email} n'est pas SUPERADMIN.`);
    process.exit(1);
  }

  console.log(`${user.email} : la 2FA sera a re-enroler au prochain acces.`);
  console.log("  (telephone perdu, ou compte verrouille)");
  if (!appliquer) {
    console.log("\n(inspection — ajoute --apply pour appliquer)");
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      totpSecret: null,
      totpConfirmedAt: null,
      totpLastUsedStep: null,
      totpFailedAttempts: 0,
      totpLockedUntil: null,
    },
  });
  console.log("\nFait. Nouveau QR a scanner au prochain acces a /superadmin.");
}

async function main() {
  const [commande, ...reste] = process.argv.slice(2);
  const appliquer = reste.includes("--apply");
  const email = reste.find((a) => !a.startsWith("--"));

  switch (commande) {
    case "list":
      await lister();
      break;
    case "promote":
      if (!email) usage();
      await promouvoir(email, appliquer);
      break;
    case "revoke":
      if (!email) usage();
      await revoquer(email, appliquer);
      break;
    case "reset-totp":
      if (!email) usage();
      await reinitialiserTotp(email, appliquer);
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
