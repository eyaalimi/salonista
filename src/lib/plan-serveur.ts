/**
 * Chargeur serveur du plan d'un salon. La decision elle-meme est pure et vit
 * dans `plan.ts` ; ce fichier ne fait que lire la base et creer l'essai.
 */

import { prisma } from "@/lib/prisma";
import { hasModule } from "@/lib/modules";
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
 * Cree la ligne PREMIUM en essai si elle n'existe pas. Idempotent : la
 * contrainte unique (providerId, module) refuse le doublon, et une ligne
 * existante n'est JAMAIS deplacee — une vente hors ligne synchronisee plus
 * tard ne repousse pas un essai deja commence.
 *
 * Renvoie true si la ligne a ete creee par cet appel.
 */
export async function creerEssaiSiAbsent(
  providerId: string,
  debut: Date,
  notes = "Essai démarré à la première vente",
): Promise<boolean> {
  try {
    await prisma.salonSubscription.create({
      data: {
        providerId,
        module: "PREMIUM",
        status: "TRIAL",
        activatedAt: debut,
        expiresAt: finEssaiDepuis(debut),
        pricingSnapshot: { monthlyPriceDT: PRIX_PREMIUM_DT, freeTrialDays: DUREE_ESSAI_JOURS },
        notes,
      },
    });
    return true;
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") return false;
    throw err;
  }
}

/**
 * Pose la ligne PREMIUM d'un salon qui n'en a pas encore :
 * - salon de DEMONSTRATION → Premium actif sans echeance (les demos
 *   montrent tout) ;
 * - sinon → essai de 30 jours a partir de `debutEssai`.
 *
 * Idempotent (contrainte unique). Renvoie true si une ligne a ete creee.
 */
export async function creerLignePremiumManquante(
  providerId: string,
  debutEssai: Date,
  notes?: string,
): Promise<boolean> {
  const salon = await prisma.providerProfile.findUnique({
    where: { id: providerId },
    select: { demo: true },
  });
  if (!salon?.demo) return creerEssaiSiAbsent(providerId, debutEssai, notes);
  try {
    await prisma.salonSubscription.create({
      data: {
        providerId,
        module: "PREMIUM",
        status: "ACTIVE",
        expiresAt: null,
        pricingSnapshot: { monthlyPriceDT: PRIX_PREMIUM_DT },
        notes: "Salon de démonstration",
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
 * Le plan du salon, calcule en un seul endroit. Cree la ligne manquante.
 *
 * POURQUOI L'ESSAI MANQUANT PART DE MAINTENANT, ET NON DE LA PREMIERE VENTE.
 * Depuis le lancement, chaque premiere vente pose sa ligne (pos-sale-create),
 * avant meme de repondre a la caisse. Une ligne absente alors que le salon a
 * deja vendu designe donc un salon d'AVANT le lancement : partir de sa
 * premiere vente — vieille de plusieurs mois — le ferait passer en gratuit a
 * la premiere page ouverte apres le deploiement, employees mises en pause
 * comprises, avant meme que le rattrapage ait pu tourner. Partir de
 * maintenant lui donne le meme mois que `prisma/backfill-freemium.ts`.
 */
export async function getPlan(providerId: string, maintenant = new Date()): Promise<Plan> {
  const [ligne, premiereVenteAt] = await Promise.all([
    lignePremium(providerId),
    datePremiereVente(providerId),
  ]);
  let premium = ligne;
  if (!premium) {
    const creee = premiereVenteAt
      ? await creerLignePremiumManquante(
          providerId,
          maintenant,
          "Essai offert au lancement du Premium (salon déjà actif)",
        )
      : await creerLignePremiumManquanteSiDemo(providerId);
    if (creee) premium = await lignePremium(providerId);
  }
  return calculerPlan({ premium, premiereVenteAt, maintenant });
}

/** Un salon de demonstration sans vente doit aussi tout montrer. */
async function creerLignePremiumManquanteSiDemo(providerId: string): Promise<boolean> {
  const salon = await prisma.providerProfile.findUnique({
    where: { id: providerId },
    select: { demo: true },
  });
  if (!salon?.demo) return false;
  return creerLignePremiumManquante(providerId, new Date());
}

export async function hasFeature(providerId: string, fonction: Fonction): Promise<boolean> {
  const plan = await getPlan(providerId);
  if (plan.etat !== "GRATUIT") return true;
  if (fonction !== "FIDELITE") return false;
  return fonctionDisponible(plan, fonction, await hasModule(providerId, "REWARDS"));
}

/** Les trois fonctions d'un coup, pour un layout ou un ecran qui les montre toutes. */
export async function fonctionsDuSalon(providerId: string): Promise<{
  plan: Plan;
  fidelite: boolean;
  equipe: boolean;
  commissions: boolean;
}> {
  const plan = await getPlan(providerId);
  const rewards = plan.etat === "GRATUIT" ? await hasModule(providerId, "REWARDS") : false;
  return {
    plan,
    fidelite: fonctionDisponible(plan, "FIDELITE", rewards),
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
