/**
 * Chargeur serveur du plan d'un salon. La decision elle-meme est pure et vit
 * dans `plan.ts` ; ce fichier ne fait que lire la base et creer l'essai.
 */

import { prisma } from "@/lib/prisma";
import {
  calculerPlan,
  finEssaiDepuis,
  fonctionDisponible,
  CODE_PREMIUM_REQUIS,
  DUREE_ESSAI_JOURS,
  PRIX_PREMIUM_DT,
  type ChiffresFinEssai,
  type Fonction,
  type Plan,
} from "@/lib/plan";

/** Statuts d'une vente qui a bel et bien ete encaissee a sa creation. */
const STATUTS_VENDUS = ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] as const;

export async function datePremiereVente(providerId: string): Promise<Date | null> {
  const vente = await prisma.sale.findFirst({
    where: { providerId, status: { in: [...STATUTS_VENDUS] } },
    orderBy: { closedAt: "asc" },
    select: { closedAt: true, createdAt: true },
  });
  if (!vente) return null;
  return vente.closedAt ?? vente.createdAt;
}

/**
 * Pose la ligne PREMIUM d'un salon qui n'en a pas encore. Idempotent : la
 * contrainte unique (providerId, module) refuse le doublon, et une ligne
 * existante n'est JAMAIS deplacee — une vente hors ligne synchronisee plus
 * tard ne repousse pas un essai deja commence.
 *
 * - salon de DEMONSTRATION → Premium actif sans echeance (les demos
 *   montrent tout) ;
 * - salon qui a vendu → le mois offert, compte depuis sa PREMIERE VENTE. Un
 *   salon qui vend depuis plus d'un mois recoit une ligne deja echue : il a
 *   eu son mois, il est en version gratuite ;
 * - salon sans vente → rien : son mois n'a pas commence.
 *
 * Renvoie true si la ligne a ete creee par cet appel.
 */
export async function creerLignePremiumManquante(providerId: string): Promise<boolean> {
  const [salon, premiereVente] = await Promise.all([
    prisma.providerProfile.findUnique({ where: { id: providerId }, select: { demo: true } }),
    datePremiereVente(providerId),
  ]);
  if (!salon) return false;
  if (!salon.demo && !premiereVente) return false;
  try {
    await prisma.salonSubscription.create({
      data: salon.demo
        ? {
            providerId,
            module: "PREMIUM",
            status: "ACTIVE",
            expiresAt: null,
            pricingSnapshot: { monthlyPriceDT: PRIX_PREMIUM_DT },
            notes: "Salon de démonstration",
          }
        : {
            providerId,
            module: "PREMIUM",
            status: "TRIAL",
            activatedAt: premiereVente!,
            expiresAt: finEssaiDepuis(premiereVente!),
            pricingSnapshot: { monthlyPriceDT: PRIX_PREMIUM_DT, freeTrialDays: DUREE_ESSAI_JOURS },
            notes: "Mois offert à la première vente",
          },
    });
    return true;
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") return false;
    throw err;
  }
}

export async function lignePremium(providerId: string) {
  return prisma.salonSubscription.findUnique({
    where: { providerId_module: { providerId, module: "PREMIUM" } },
    select: { id: true, status: true, expiresAt: true, activatedAt: true },
  });
}

/**
 * Le plan du salon, calcule en un seul endroit. Cree la ligne manquante :
 * la premiere vente la pose deja (`pos-sale-create.ts`), ce rattrapage couvre
 * les salons qui vendaient avant le lancement et les salons de demonstration.
 */
export async function getPlan(providerId: string, maintenant = new Date()): Promise<Plan> {
  const [ligne, premiereVenteAt] = await Promise.all([
    lignePremium(providerId),
    datePremiereVente(providerId),
  ]);
  let premium = ligne;
  if (!premium && (await creerLignePremiumManquante(providerId))) {
    premium = await lignePremium(providerId);
  }
  return calculerPlan({ premium, premiereVenteAt, maintenant });
}

export async function hasFeature(providerId: string, fonction: Fonction): Promise<boolean> {
  return fonctionDisponible(await getPlan(providerId), fonction);
}

/** Les trois fonctions d'un coup, pour un layout ou un ecran qui les montre toutes. */
export async function fonctionsDuSalon(providerId: string): Promise<{
  plan: Plan;
  fidelite: boolean;
  equipe: boolean;
  commissions: boolean;
}> {
  const plan = await getPlan(providerId);
  return {
    plan,
    fidelite: fonctionDisponible(plan, "FIDELITE"),
    equipe: fonctionDisponible(plan, "EQUIPE"),
    commissions: fonctionDisponible(plan, "COMMISSIONS"),
  };
}

/** Reponse 403 commune a toutes les routes reservees au Premium. */
export function reponsePremiumRequis(message: string): Response {
  return Response.json({ code: CODE_PREMIUM_REQUIS, error: message }, { status: 403 });
}

/**
 * Les vrais chiffres du salon pour le bandeau de fin d'essai : ce qu'il
 * perdrait sans Premium. Trois agregats, aucune boucle.
 */
export async function chiffresFinEssai(providerId: string): Promise<ChiffresFinEssai> {
  const [portefeuilles, employees, commissions] = await Promise.all([
    prisma.rewardWallet.aggregate({
      where: { providerId, balance: { gt: 0 } },
      _count: { _all: true },
      _sum: { balance: true },
    }),
    prisma.salonEmployee.count({
      where: { providerId, active: true, role: { not: "OWNER" } },
    }),
    prisma.saleItem.aggregate({
      where: {
        commissionAmount: { not: null },
        commissionPaid: false,
        sale: { providerId, status: { in: [...STATUTS_VENDUS] } },
      },
      _sum: { commissionAmount: true },
    }),
  ]);
  return {
    clientesAvecPoints: portefeuilles._count._all,
    totalPoints: portefeuilles._sum.balance ?? 0,
    employeesHorsOwner: employees,
    commissionsNonReglees: commissions._sum.commissionAmount?.toFixed(3) ?? "0.000",
  };
}
