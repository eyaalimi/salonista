/**
 * Rattrapage de l'offre gratuite + Premium.
 *
 * Usage :
 *   npx tsx prisma/backfill-freemium.ts            # inspecte, ne modifie RIEN
 *   npx tsx prisma/backfill-freemium.ts --apply    # applique
 *
 * Ce qu'il fait, salon par salon :
 *
 * - salon de DEMONSTRATION → Premium actif sans echeance, pour que les
 *   demonstrations montrent tout ;
 * - salon REEL qui a deja vendu, sans ligne PREMIUM → essai de 30 jours a
 *   partir d'AUJOURD'HUI, et non de sa premiere vente : un salon qui vend
 *   depuis trois mois serait sinon passe en gratuit le jour du deploiement,
 *   sans avoir jamais vu l'essai ;
 * - salon sans vente → rien : son essai demarrera a sa premiere vente ;
 * - lignes REWARDS → listees seulement. Elles restent valables (voir
 *   `fonctionDisponible`) ; les toucher demande une decision humaine.
 *
 * Idempotent : un salon qui a deja une ligne PREMIUM n'est jamais modifie.
 */

// `tsx` ne charge pas `.env` comme Next.js : meme amorce que les autres scripts.
import { config } from "dotenv";
config();

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { finEssaiDepuis, DUREE_ESSAI_JOURS, PRIX_PREMIUM_DT } from "../src/lib/plan";

const apply = process.argv.includes("--apply");

if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL introuvable. Lance le script depuis le dossier qui contient" +
      "\nle fichier .env (/home/ubuntu/salonista en production).",
  );
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL) });

const STATUTS_VENDUS = ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] as const;

async function main() {
  const maintenant = new Date();
  const salons = await prisma.providerProfile.findMany({
    select: {
      id: true,
      salonName: true,
      demo: true,
      subscriptions: { select: { module: true, status: true, expiresAt: true } },
      _count: { select: { sales: { where: { status: { in: [...STATUTS_VENDUS] } } } } },
    },
    orderBy: { salonName: "asc" },
  });

  const demos: string[] = [];
  const essais: string[] = [];
  const sansVente: string[] = [];
  const dejaFaits: string[] = [];
  const rewards: string[] = [];

  for (const s of salons) {
    const nom = `${s.salonName} (${s.id})`;
    const r = s.subscriptions.find((x) => x.module === "REWARDS");
    if (r) {
      rewards.push(
        `${nom} — ${r.status}${r.expiresAt ? `, échéance ${r.expiresAt.toISOString().slice(0, 10)}` : ", sans échéance"}`,
      );
    }

    if (s.subscriptions.some((x) => x.module === "PREMIUM")) {
      dejaFaits.push(nom);
      continue;
    }

    if (s.demo) {
      demos.push(nom);
      if (apply) {
        await prisma.salonSubscription.create({
          data: {
            providerId: s.id,
            module: "PREMIUM",
            status: "ACTIVE",
            expiresAt: null,
            pricingSnapshot: { monthlyPriceDT: PRIX_PREMIUM_DT },
            notes: "Salon de démonstration",
          },
        });
      }
      continue;
    }

    if (s._count.sales > 0) {
      essais.push(`${nom} — ${s._count.sales} vente(s)`);
      if (apply) {
        await prisma.salonSubscription.create({
          data: {
            providerId: s.id,
            module: "PREMIUM",
            status: "TRIAL",
            activatedAt: maintenant,
            expiresAt: finEssaiDepuis(maintenant),
            pricingSnapshot: { monthlyPriceDT: PRIX_PREMIUM_DT, freeTrialDays: DUREE_ESSAI_JOURS },
            notes: "Essai offert au lancement du Premium (salon déjà actif)",
          },
        });
      }
      continue;
    }

    sansVente.push(nom);
  }

  const bloc = (titre: string, lignes: string[]) => {
    console.log(`\n${titre} : ${lignes.length}`);
    for (const l of lignes) console.log(`  - ${l}`);
  };

  console.log(apply ? "MODE APPLICATION" : "MODE INSPECTION — rien n'est modifié (ajoute --apply)");
  bloc("Salons de démonstration → Premium sans échéance", demos);
  bloc(
    `Salons réels avec ventes → essai jusqu'au ${finEssaiDepuis(maintenant).toISOString().slice(0, 10)}`,
    essais,
  );
  bloc("Salons sans vente → rien (essai à la première vente)", sansVente);
  bloc("Déjà une ligne PREMIUM → inchangés", dejaFaits);
  bloc("Lignes REWARDS existantes (non modifiées)", rewards);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
