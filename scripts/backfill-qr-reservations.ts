/**
 * Donne un QR code aux reservations qui n'en ont pas.
 *
 * Contexte : jusqu'au lot A, le QR n'etait emis qu'au « paiement » — un
 * paiement fictif que la plupart des clientes n'ont jamais lance. Ces
 * reservations sont donc en base sans `qrCode` : leur page QR repond 404 et
 * le salon ne peut pas valider l'arrivee. Le QR nait desormais avec la
 * reservation ; ce script rattrape celles d'avant.
 *
 * Usage :
 *   npx tsx scripts/backfill-qr-reservations.ts            # inspecte, ne modifie RIEN
 *   npx tsx scripts/backfill-qr-reservations.ts --apply    # applique
 *
 * Idempotent : ne touche qu'aux reservations sans `qrCode`, et peut donc etre
 * relance sans risque. Les reservations annulees sont ignorees — un QR ne leur
 * servirait a rien.
 *
 * Le statut est passe a CONFIRMED pour les reservations PENDING : c'est l'etat
 * qu'elles auraient eu si elles avaient ete creees apres le lot A. Une
 * reservation COMPLETED ou CANCELLED garde le sien.
 */

// `tsx` ne charge pas `.env` comme le fait Next.js : sans ces deux lignes,
// DATABASE_URL est absente et pg echoue sur « client password must be a
// string ». Meme amorce que `scripts/create-admin.ts`.
import { config } from "dotenv";
config();

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { nanoid } from "nanoid";

const apply = process.argv.includes("--apply");

// Verifie AVANT de construire le client : sinon pg echoue plus loin sur un
// « client password must be a string » qui n'apprend rien.
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
  const aRattraper = await prisma.booking.findMany({
    where: {
      qrCode: null,
      status: { not: "CANCELLED" },
      // Les reservations fantomes viennent de la caisse : la cliente etait
      // devant le comptoir, elle n'a aucun QR a presenter.
      phantom: false,
    },
    select: { id: true, status: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  if (aRattraper.length === 0) {
    console.log("Aucune reservation a rattraper — toutes ont deja un QR code.");
    return;
  }

  const parStatut = aRattraper.reduce<Record<string, number>>((acc, b) => {
    acc[b.status] = (acc[b.status] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`${aRattraper.length} reservation(s) sans QR code :`);
  for (const [statut, n] of Object.entries(parStatut)) {
    console.log(`  ${statut.padEnd(10)} ${n}`);
  }

  if (!apply) {
    console.log(
      "\nInspection seule — rien n'a ete modifie." +
        "\nRelance avec --apply pour ecrire.",
    );
    return;
  }

  let faits = 0;
  for (const b of aRattraper) {
    await prisma.booking.update({
      where: { id: b.id },
      data: {
        qrCode: `BT-${nanoid(16)}`,
        // PENDING n'a plus de sens sans paiement en ligne a attendre.
        ...(b.status === "PENDING" ? { status: "CONFIRMED" as const } : {}),
      },
    });
    faits += 1;
  }

  console.log(`\n${faits} reservation(s) mise(s) a jour.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
