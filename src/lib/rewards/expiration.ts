/**
 * Activity-based expiration — wallets with no activity for longer than
 * `program.inactivityExpireMonths` get an EXPIRATION transaction zeroing
 * their balance.
 *
 * Cron scheduling is out of scope for Phase 4 — admins trigger it via
 * /api/admin/rewards/expire-inactive.
 */

import { prisma } from "@/lib/prisma";
import { hasFeature } from "@/lib/plan-serveur";
import { decalagePauseMs } from "@/lib/plan";

export async function expireInactiveWallets(
  providerId?: string,
): Promise<{ expired: number; pointsZeroed: number }> {
  const programs = await prisma.rewardProgram.findMany({
    where: {
      active: true,
      inactivityExpireMonths: { not: null },
      ...(providerId ? { providerId } : {}),
    },
  });
  if (programs.length === 0) return { expired: 0, pointsZeroed: 0 };

  let expired = 0;
  let pointsZeroed = 0;

  for (const program of programs) {
    if (!program.inactivityExpireMonths) continue;
    // Fidelite en pause (version gratuite) : la cliente ne peut ni gagner ni
    // utiliser de points, ses mois d'inactivite ne sont pas de son fait. Le
    // temps de pause est rendu au retour en Premium (decalerActiviteApresPause).
    if (!(await hasFeature(program.providerId, "FIDELITE"))) continue;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - program.inactivityExpireMonths);

    const wallets = await prisma.rewardWallet.findMany({
      where: {
        programId: program.id,
        balance: { gt: 0 },
        lastActivityAt: { lt: cutoff },
      },
    });

    for (const wallet of wallets) {
      await prisma.$transaction(async (tx) => {
        const fresh = await tx.rewardWallet.findUnique({ where: { id: wallet.id } });
        if (!fresh || fresh.balance <= 0) return;

        await tx.rewardTransaction.create({
          data: {
            walletId: fresh.id,
            delta: -fresh.balance,
            balanceAfter: 0,
            reason: "EXPIRATION",
            note: `Inactivité ${program.inactivityExpireMonths} mois`,
          },
        });
        await tx.rewardWallet.update({
          where: { id: fresh.id },
          data: { balance: 0 },
        });
        expired += 1;
        pointsZeroed += fresh.balance;
      });
    }
  }

  return { expired, pointsZeroed };
}

/**
 * Retour en Premium : recule `lastActivityAt` de chaque portefeuille du salon
 * de la duree de la pause, pour que les mois passes en version gratuite ne
 * comptent pas dans l'expiration. `debutPause` = echeance de l'ancienne ligne
 * PREMIUM, lue AVANT que l'activation ne l'ecrase.
 *
 * Une seule requete SQL : un salon peut avoir des milliers de portefeuilles,
 * et une boucle de mises a jour tiendrait la requete d'activation.
 */
export async function decalerActiviteApresPause(
  providerId: string,
  debutPause: Date | null,
  maintenant = new Date(),
): Promise<number> {
  const decalage = decalagePauseMs(debutPause, maintenant);
  if (decalage <= 0) return 0;
  // LEAST : une activite posee PENDANT la pause (une reprise de points sur
  // remboursement, par exemple) ne doit pas etre projetee dans le futur.
  const secondes = decalage / 1000;
  return prisma.$executeRaw`
    UPDATE "RewardWallet"
    SET "lastActivityAt" = LEAST(
      "lastActivityAt" + make_interval(secs => ${secondes}::double precision),
      ${maintenant}::timestamp
    )
    WHERE "providerId" = ${providerId}
  `;
}
