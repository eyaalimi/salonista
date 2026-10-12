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

export async function lignePremium(providerId: string) {
  return prisma.salonSubscription.findUnique({
    where: { providerId_module: { providerId, module: "PREMIUM" } },
    select: { id: true, status: true, expiresAt: true, activatedAt: true },
  });
}

/** Le plan du salon, calcule en un seul endroit. Cree l'essai manquant. */
export async function getPlan(providerId: string, maintenant = new Date()): Promise<Plan> {
  const [premium, premiereVenteAt] = await Promise.all([
    lignePremium(providerId),
    datePremiereVente(providerId),
  ]);
  if (!premium && premiereVenteAt) {
    await creerEssaiSiAbsent(providerId, premiereVenteAt);
  }
  return calculerPlan({ premium, premiereVenteAt, maintenant });
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
