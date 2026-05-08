/**
 * Activity-based expiration — wallets with no activity for longer than
 * `program.inactivityExpireMonths` get an EXPIRATION transaction zeroing
 * their balance.
 *
 * Cron scheduling is out of scope for Phase 4 — admins trigger it via
 * /api/admin/rewards/expire-inactive.
 */

import { prisma } from "@/lib/prisma";

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
