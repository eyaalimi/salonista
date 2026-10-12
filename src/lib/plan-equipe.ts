/**
 * La limite d'equipe de la version gratuite : la gerante + 1 employee active.
 *
 * Rien n'est jamais supprime. Les employees au-dela de la limite passent en
 * `active: false` avec `suspendueParPlanAt` ; ce champ les distingue d'une
 * desactivation manuelle, et seules elles reviennent au retour en Premium.
 * Ventes, rendez-vous et commissions gardent leur employee.
 */

import { prisma } from "@/lib/prisma";
import { getPlan, reponsePremiumRequis } from "@/lib/plan-serveur";
import {
  compterDansLimite,
  fonctionDisponible,
  MESSAGES_PREMIUM,
  peutAjouterEmployee,
  repartirEquipe,
} from "@/lib/plan";

const SELECT_EQUIPE = {
  id: true,
  displayName: true,
  role: true,
  active: true,
  lastLoginAt: true,
  createdAt: true,
  suspendueParPlanAt: true,
} as const;

async function equipeDisponible(providerId: string): Promise<boolean> {
  return fonctionDisponible(await getPlan(providerId), "EQUIPE");
}

/**
 * Refus a renvoyer tel quel si l'ajout d'une employee qui compte depasserait
 * la limite, sinon null. `exclureId` : l'employee qu'on reactive ou dont on
 * change le role, pour ne pas la compter deux fois.
 */
export async function refusAjoutEmployee(
  providerId: string,
  exclureId?: string,
): Promise<Response | null> {
  if (await equipeDisponible(providerId)) return null;
  const actives = await prisma.salonEmployee.count({
    where: {
      providerId,
      active: true,
      role: { not: "OWNER" },
      ...(exclureId ? { id: { not: exclureId } } : {}),
    },
  });
  if (peutAjouterEmployee(false, actives)) return null;
  return reponsePremiumRequis(MESSAGES_PREMIUM.equipe);
}

/**
 * En version gratuite, une gerante de plus est une employee de plus.
 *
 * La regle « la gerante ne compte jamais » laissait sinon une porte ouverte :
 * nommer chaque employee OWNER suffisait a contourner la limite.
 */
export async function refusNouvelleGerante(providerId: string): Promise<Response | null> {
  if (await equipeDisponible(providerId)) return null;
  return reponsePremiumRequis(MESSAGES_PREMIUM.equipe);
}

/**
 * Ramene l'equipe active dans la limite si le salon est en version gratuite.
 * Idempotent : sans effet si la limite est deja respectee ou si le Premium
 * est actif. Appelee a la connexion PIN et a l'ouverture de la caisse, pour
 * que la caisse ne s'arrete jamais : la gerante et une employee continuent
 * d'encaisser.
 */
export async function appliquerLimiteEquipe(providerId: string): Promise<{ suspendues: number }> {
  if (await equipeDisponible(providerId)) return { suspendues: 0 };

  const equipe = await prisma.salonEmployee.findMany({
    where: { providerId, active: true, role: { not: "OWNER" } },
    select: SELECT_EQUIPE,
  });
  const { suspendre } = repartirEquipe(equipe);
  if (suspendre.length === 0) return { suspendues: 0 };

  const { count } = await prisma.salonEmployee.updateMany({
    // `active: true` dans le filtre : deux appels simultanes ne suspendent
    // pas deux fois, et une employee deja desactivee a la main n'est pas
    // marquee « en pause ».
    where: { id: { in: suspendre.map((e) => e.id) }, active: true },
    data: { active: false, suspendueParPlanAt: new Date() },
  });
  return { suspendues: count };
}

export type ChoixEquipe = {
  gardee: { id: string; displayName: string } | null;
  enPause: Array<{ id: string; displayName: string }>;
};

/**
 * Faut-il demander a la gerante de confirmer qui garde son acces ? Oui tant
 * qu'il existe des employees en pause plus recentes que sa derniere reponse.
 */
export async function choixEquipeAConfirmer(providerId: string): Promise<ChoixEquipe | null> {
  const [salon, equipe] = await Promise.all([
    prisma.providerProfile.findUnique({
      where: { id: providerId },
      select: { choixEquipeConfirmeAt: true },
    }),
    prisma.salonEmployee.findMany({
      where: { providerId, role: { not: "OWNER" } },
      select: SELECT_EQUIPE,
      orderBy: { displayName: "asc" },
    }),
  ]);
  const enPause = equipe.filter((e) => e.suspendueParPlanAt !== null);
  if (enPause.length === 0) return null;
  const dernierePause = Math.max(...enPause.map((e) => e.suspendueParPlanAt!.getTime()));
  const confirme = salon?.choixEquipeConfirmeAt?.getTime() ?? 0;
  if (confirme >= dernierePause) return null;

  const gardee = compterDansLimite(equipe)[0] ?? null;
  return {
    gardee: gardee ? { id: gardee.id, displayName: gardee.displayName } : null,
    enPause: enPause.map((e) => ({ id: e.id, displayName: e.displayName })),
  };
}

export async function confirmerChoixEquipe(providerId: string): Promise<void> {
  await prisma.providerProfile.update({
    where: { id: providerId },
    data: { choixEquipeConfirmeAt: new Date() },
  });
}

/**
 * Echange : l'employee en pause `nouvelleId` reprend sa place, celles qui
 * comptent aujourd'hui passent en pause. Refuse si `nouvelleId` n'a pas ete
 * mise en pause par le plan — une employee desactivee a la main le reste.
 */
export async function echangerEmployeeGardee(
  providerId: string,
  nouvelleId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const nouvelle = await prisma.salonEmployee.findFirst({
    where: { id: nouvelleId, providerId, role: { not: "OWNER" } },
    select: { id: true, suspendueParPlanAt: true },
  });
  if (!nouvelle?.suspendueParPlanAt) {
    return { ok: false, error: "Cette employée n'est pas en pause." };
  }
  const maintenant = new Date();
  await prisma.$transaction([
    prisma.salonEmployee.updateMany({
      where: { providerId, active: true, role: { not: "OWNER" } },
      data: { active: false, suspendueParPlanAt: maintenant },
    }),
    prisma.salonEmployee.update({
      where: { id: nouvelle.id },
      data: { active: true, suspendueParPlanAt: null },
    }),
    prisma.providerProfile.update({
      where: { id: providerId },
      data: { choixEquipeConfirmeAt: maintenant },
    }),
  ]);
  return { ok: true };
}

/** Retour en Premium : toutes les employees en pause reviennent. */
export async function reactiverEquipeEnPause(providerId: string): Promise<number> {
  const { count } = await prisma.salonEmployee.updateMany({
    where: { providerId, suspendueParPlanAt: { not: null } },
    data: { active: true, suspendueParPlanAt: null },
  });
  return count;
}
