/**
 * Ecriture des evenements de salon — le SEUL fichier de ce lot qui touche
 * Prisma. Les decisions (types, deduplication, abandon) vivent dans
 * `evenement-salon.ts`, pur et teste.
 *
 * LA REGLE QUI COMMANDE TOUT CE FICHIER : un evenement ne doit JAMAIS faire
 * echouer l'action qu'il decrit. Une connexion, une vente ou un PIN ne
 * peuvent pas tomber parce que la table d'observation est indisponible, pleine
 * ou lente. D'ou, partout :
 *
 *  - aucune erreur ne remonte — tout est avale ;
 *  - l'appelant n'attend pas (`void`, pas `await`) sur les chemins critiques ;
 *  - aucune lecture prealable sur ces chemins, sauf la deduplication des
 *    visites d'ecran, qui n'est jamais sur le chemin d'une vente.
 *
 * C'est le meme parti pris que `enregistrerEvenement` du suivi marketing et
 * que l'envoi Meta : observer ne doit jamais couter le service.
 */

import { prisma } from "@/lib/prisma";
import {
  EVENEMENTS,
  doitEnregistrerVisite,
  type EcranSuivi,
  type TypeEvenement,
} from "@/lib/evenement-salon";

type Contexte = {
  providerId: string;
  employeeId?: string | null;
  userId?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Enregistre un evenement. Ne jette jamais, ne fait jamais attendre.
 *
 * A appeler SANS `await` depuis un chemin critique :
 *     void enregistrerEvenementSalon(EVENEMENTS.PIN_INCORRECT, { ... });
 */
export async function enregistrerEvenementSalon(
  type: TypeEvenement,
  ctx: Contexte,
): Promise<void> {
  try {
    if (!ctx.providerId) return;
    await prisma.evenementSalon.create({
      data: {
        providerId: ctx.providerId,
        employeeId: ctx.employeeId ?? null,
        userId: ctx.userId ?? null,
        type,
        metadata: (ctx.metadata ?? undefined) as never,
      },
    });
  } catch {
    // Volontairement muet. Voir l'en-tete : observer ne doit jamais couter
    // le service. Une erreur ici ne regarde pas l'utilisatrice.
  }
}

/**
 * Le salon d'un compte utilisateur, ou `null`.
 *
 * Sert aux evenements de connexion : on n'enregistre un echec QUE s'il
 * concerne un compte existant qui tient un salon. Enregistrer les autres
 * remplirait la table d'adresses tapees au hasard par des robots, sans jamais
 * servir a un appel — et ferait de cette table un inventaire des comptes qui
 * n'existent pas.
 */
export async function salonDuCompte(
  email: string,
): Promise<{ providerId: string; userId: string } | null> {
  try {
    const u = await prisma.user.findUnique({
      where: { email },
      select: { id: true, providerProfile: { select: { id: true } } },
    });
    if (!u?.providerProfile) return null;
    return { providerId: u.providerProfile.id, userId: u.id };
  } catch {
    return null;
  }
}

/**
 * Le salon d'une employee, ou `null`.
 *
 * `verifierPinEmploye` ne connait que l'identifiant de l'employee : il faut
 * remonter au salon pour ranger l'evenement. La lecture est hors du chemin
 * critique (elle suit l'echec, qui est deja decide).
 */
export async function salonDeLEmployee(
  employeeId: string,
): Promise<string | null> {
  try {
    const e = await prisma.salonEmployee.findUnique({
      where: { id: employeeId },
      select: { providerId: true },
    });
    return e?.providerId ?? null;
  } catch {
    return null;
  }
}

/**
 * Enregistre la visite d'un ecran, au plus une fois par employee et par
 * fenetre.
 *
 * SEUL cas de ce fichier ou l'on LIT avant d'ecrire : sans cette lecture, une
 * caissiere qui navigue entre la grille et le panier ecrirait des centaines
 * de lignes par heure. Ce chemin n'est jamais celui d'une vente — au pire,
 * une visite n'est pas comptee.
 */
export async function enregistrerVisiteEcran(
  ecran: EcranSuivi,
  ctx: Contexte & { employeeId: string },
  maintenant: Date = new Date(),
): Promise<void> {
  try {
    if (!ctx.providerId || !ctx.employeeId) return;

    const dernier = await prisma.evenementSalon.findFirst({
      where: {
        providerId: ctx.providerId,
        employeeId: ctx.employeeId,
        type: EVENEMENTS.ECRAN_VISITE,
        // `equals` sur un champ Json : Prisma compare la valeur exacte, ce qui
        // suffit pour un objet a une seule cle ecrit par nous.
        metadata: { equals: { ecran } },
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    if (!doitEnregistrerVisite(dernier?.createdAt ?? null, maintenant)) return;

    await prisma.evenementSalon.create({
      data: {
        providerId: ctx.providerId,
        employeeId: ctx.employeeId,
        userId: ctx.userId ?? null,
        type: EVENEMENTS.ECRAN_VISITE,
        metadata: { ecran } as never,
      },
    });
  } catch {
    // Muet, comme au-dessus.
  }
}
