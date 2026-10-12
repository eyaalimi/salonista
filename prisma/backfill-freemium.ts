/**
 * Rattrapage de l'offre gratuite + Premium.
 *
 * Usage :
 *   npx tsx prisma/backfill-freemium.ts            # inspecte, ne modifie RIEN
 *   npx tsx prisma/backfill-freemium.ts --apply    # applique
 *
 * Regle : UN mois offert par salon, compte depuis son INSCRIPTION.
 *
 * - salon de DEMONSTRATION → Premium actif sans echeance (les demos
 *   montrent tout) ;
 * - tout autre salon sans ligne PREMIUM → essai de 30 jours depuis son
 *   inscription. Un salon inscrit il y a plus d'un mois recoit une ligne
 *   deja echue : il a eu son mois, il passe en version gratuite (fidelite en
 *   pause, une seule employee, commissions verrouillees) jusqu'au paiement ;
 * - lignes REWARDS → listees seulement. Elles gardent la fidelite (voir
 *   `fonctionDisponible`) ; les toucher demande une decision humaine.
 *
 * Meme regle que `getPlan`, qui cree la ligne au premier chargement : ce
 * script sert surtout a LIRE le rapport avant le deploiement.
 *
 * Idempotent : un salon qui a deja une ligne PREMIUM n'est jamais modifie.
 */

// `tsx` ne charge pas `.env` comme Next.js : meme amorce que les autres scripts.
import { config } from "dotenv";
config();

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { finEssaiDepuis, joursRestants, DUREE_ESSAI_JOURS, PRIX_PREMIUM_DT } from "../src/lib/plan";

const apply = process.argv.includes("--apply");

if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL introuvable. Lance le script depuis le dossier qui contient" +
      "\nle fichier .env (/home/ubuntu/salonista en production).",
  );
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL) });

const date = (d: Date) => d.toISOString().slice(0, 10);

async function main() {
  const maintenant = new Date();
  const salons = await prisma.providerProfile.findMany({
    select: {
      id: true,
      salonName: true,
      demo: true,
      createdAt: true,
      subscriptions: { select: { module: true, status: true, expiresAt: true } },
      _count: { select: { employees: { where: { active: true, role: { not: "OWNER" } } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  const demos: string[] = [];
  const enEssai: string[] = [];
  const gratuits: string[] = [];
  const dejaFaits: string[] = [];
  const rewards: string[] = [];

  for (const s of salons) {
    const nom = `${s.salonName} (${s.id})`;
    const r = s.subscriptions.find((x) => x.module === "REWARDS");
    if (r) {
      rewards.push(
        `${nom} — ${r.status}${r.expiresAt ? `, échéance ${date(r.expiresAt)}` : ", sans échéance"}`,
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

    const fin = finEssaiDepuis(s.createdAt);
    const restants = joursRestants(fin, maintenant);
    if (restants > 0) {
      enEssai.push(`${nom} — inscrit le ${date(s.createdAt)}, encore ${restants} jour(s)`);
    } else {
      const enPause = Math.max(0, s._count.employees - 1);
      gratuits.push(
        `${nom} — inscrit le ${date(s.createdAt)}` +
          (enPause > 0 ? `, ${enPause} employée(s) seront mises en pause` : ""),
      );
    }
    if (apply) {
      await prisma.salonSubscription.create({
        data: {
          providerId: s.id,
          module: "PREMIUM",
          status: "TRIAL",
          activatedAt: s.createdAt,
          expiresAt: fin,
          pricingSnapshot: { monthlyPriceDT: PRIX_PREMIUM_DT, freeTrialDays: DUREE_ESSAI_JOURS },
          notes: "Mois offert à l'inscription",
        },
      });
    }
  }

  const bloc = (titre: string, lignes: string[]) => {
    console.log(`\n${titre} : ${lignes.length}`);
    for (const l of lignes) console.log(`  - ${l}`);
  };

  console.log(apply ? "MODE APPLICATION" : "MODE INSPECTION — rien n'est modifié (ajoute --apply)");
  bloc("Salons de démonstration → Premium sans échéance", demos);
  bloc("Mois offert encore en cours", enEssai);
  bloc("Mois offert déjà écoulé → VERSION GRATUITE jusqu'au paiement", gratuits);
  bloc("Déjà une ligne PREMIUM → inchangés", dejaFaits);
  bloc("Lignes REWARDS existantes (gardent la fidélité, non modifiées)", rewards);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
