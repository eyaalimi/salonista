/**
 * Activation du Premium par l'administration, et ce qui doit se passer quand
 * un salon (re)devient Premium.
 *
 * Le paiement se fait hors de l'application (virement, D17, especes) ;
 * l'admin active a la main. Aucun paiement en ligne.
 */

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getPlan, lignePremium } from "@/lib/plan-serveur";
import { reactiverEquipeEnPause } from "@/lib/plan-equipe";
import { decalerActiviteApresPause } from "@/lib/rewards/expiration";
import { nouvelleEcheancePremium, PRIX_PREMIUM_DT, type Plan } from "@/lib/plan";

/**
 * Le salon passe d'un etat non Premium au Premium actif. Une seule fonction,
 * appelee par TOUTES les routes qui peuvent provoquer ce passage :
 *
 * 1. les employees mises en pause par la limite d'equipe reviennent (celles
 *    desactivees a la main restent desactivees) ;
 * 2. `lastActivityAt` des portefeuilles recule de la duree de la pause, pour
 *    que les mois en gratuit ne fassent expirer aucun point.
 *
 * `ancienneEcheance` = debut de la pause, a lire AVANT que l'activation
 * n'ecrase l'echeance.
 *
 * Idempotente : la reactivation l'est par nature ; le decalage, lui, ne
 * l'est pas (deux appels decaleraient deux fois). La pause deja compensee
 * est donc notee dans `pricingSnapshot.pauseCompenseeDepuis`, et un second
 * appel pour la meme pause ne decale rien.
 */
export async function surPassageAuPremium(
  providerId: string,
  ancienneEcheance: Date | null,
): Promise<{ employeesReactivees: number; portefeuillesDecales: number }> {
  const employeesReactivees = await reactiverEquipeEnPause(providerId);

  let portefeuillesDecales = 0;
  const marqueur = ancienneEcheance?.toISOString() ?? null;
  const ligne = await prisma.salonSubscription.findUnique({
    where: { providerId_module: { providerId, module: "PREMIUM" } },
    select: { id: true, pricingSnapshot: true },
  });
  const snapshot = (ligne?.pricingSnapshot ?? {}) as Record<string, unknown>;
  if (marqueur && ligne && snapshot.pauseCompenseeDepuis !== marqueur) {
    portefeuillesDecales = await decalerActiviteApresPause(providerId, ancienneEcheance);
    await prisma.salonSubscription.update({
      where: { id: ligne.id },
      data: {
        pricingSnapshot: { ...snapshot, pauseCompenseeDepuis: marqueur } as Prisma.InputJsonValue,
      },
    });
  }

  return { employeesReactivees, portefeuillesDecales };
}

/**
 * A appeler apres toute ecriture de l'admin sur la ligne PREMIUM : si l'etat
 * vient de passer au Premium, declenche `surPassageAuPremium`.
 */
export async function apresEcriturePremium(
  providerId: string,
  avant: { plan: Plan; echeance: Date | null },
): Promise<void> {
  if (avant.plan.etat === "PREMIUM") return;
  const apres = await getPlan(providerId);
  if (apres.etat !== "PREMIUM") return;
  await surPassageAuPremium(providerId, avant.echeance);
}

/** Etat avant ecriture, a passer a `apresEcriturePremium`. */
export async function etatAvantEcriturePremium(providerId: string) {
  const [plan, ligne] = await Promise.all([getPlan(providerId), lignePremium(providerId)]);
  return { plan, echeance: ligne?.expiresAt ?? null };
}

/**
 * « Activer Premium : N mois ». L'echeance est prolongee depuis l'echeance
 * actuelle si elle est future, sinon depuis maintenant. Le mode de paiement
 * est ajoute aux notes, sans effacer l'historique.
 */
export async function activerPremium(args: {
  providerId: string;
  mois: number;
  notePaiement: string;
  adminId: string;
  maintenant?: Date;
}): Promise<{ jusquAu: Date }> {
  const maintenant = args.maintenant ?? new Date();
  const avant = await etatAvantEcriturePremium(args.providerId);
  const existante = await prisma.salonSubscription.findUnique({
    where: { providerId_module: { providerId: args.providerId, module: "PREMIUM" } },
    select: { notes: true },
  });

  const jusquAu = nouvelleEcheancePremium(avant.echeance, maintenant, args.mois);
  const ligneNote = [
    `${maintenant.toISOString().slice(0, 10)} : Premium ${args.mois} mois`,
    args.notePaiement.trim(),
  ]
    .filter(Boolean)
    .join(" — ");
  const notes = existante?.notes ? `${existante.notes}\n${ligneNote}` : ligneNote;
  const pricingSnapshot = { monthlyPriceDT: PRIX_PREMIUM_DT, months: args.mois };

  await prisma.salonSubscription.upsert({
    where: { providerId_module: { providerId: args.providerId, module: "PREMIUM" } },
    create: {
      providerId: args.providerId,
      module: "PREMIUM",
      status: "ACTIVE",
      activatedAt: maintenant,
      expiresAt: jusquAu,
      pricingSnapshot,
      notes,
      activatedByUserId: args.adminId,
    },
    update: {
      status: "ACTIVE",
      expiresAt: jusquAu,
      pricingSnapshot,
      notes,
      activatedByUserId: args.adminId,
    },
  });

  await apresEcriturePremium(args.providerId, avant);
  return { jusquAu };
}
