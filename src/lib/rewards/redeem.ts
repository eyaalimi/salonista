/**
 * Redemption logic — validate a points-as-payment request, then apply the
 * REDEEM_PURCHASE transaction inside a sale-creation transaction.
 */

import type { Prisma, RewardProgram } from "@/generated/prisma/client";
import { fromMillimes, toMillimes } from "@/lib/money";

type Tx = Prisma.TransactionClient;

export class RedemptionError extends Error {
  constructor(
    public code:
      | "BELOW_MIN"
      | "INSUFFICIENT_BALANCE"
      | "EXCEEDS_MAX_PCT"
      | "PROGRAM_INACTIVE"
      | "INVALID",
    message: string,
  ) {
    super(message);
    this.name = "RedemptionError";
  }
}

/**
 * Validate a redemption request.
 *
 * Returns the equivalent DT value as a 3-decimal string.
 * Throws RedemptionError with a French message on failure.
 */
export function validateRedemption(args: {
  walletBalance: number;
  pointsToRedeem: number;
  saleTotal: { toString(): string };
  // `dinarPerPoint` n'est lu qu'a travers `.toString()` — meme convention que
  // `saleTotal` juste au-dessus. `Pick<RewardProgram, …>` imposait le type
  // Decimal de Prisma sans que la fonction s'en serve.
  program: Pick<
    RewardProgram,
    "active" | "minPointsToRedeem" | "maxRedemptionPctPerSale"
  > & { dinarPerPoint: { toString(): string } };
}): { redemptionValue: string } {
  const { walletBalance, pointsToRedeem, saleTotal, program } = args;

  if (!program.active) {
    throw new RedemptionError("PROGRAM_INACTIVE", "Programme de fidélité inactif");
  }
  if (!Number.isFinite(pointsToRedeem) || pointsToRedeem <= 0) {
    throw new RedemptionError("INVALID", "Nombre de points invalide");
  }
  if (pointsToRedeem < program.minPointsToRedeem) {
    throw new RedemptionError(
      "BELOW_MIN",
      `Minimum ${program.minPointsToRedeem} points requis pour un échange`,
    );
  }
  if (pointsToRedeem > walletBalance) {
    throw new RedemptionError(
      "INSUFFICIENT_BALANCE",
      `Solde insuffisant (disponible: ${walletBalance} pts)`,
    );
  }

  // Cap by maxRedemptionPctPerSale.
  const totalM = toMillimes(saleTotal.toString());
  const dpp = Number(program.dinarPerPoint.toString());
  const valueM = Math.round(pointsToRedeem * dpp * 1000);
  const maxM = Math.floor((totalM * program.maxRedemptionPctPerSale) / 100);
  if (valueM > maxM) {
    throw new RedemptionError(
      "EXCEEDS_MAX_PCT",
      `Maximum ${program.maxRedemptionPctPerSale}% du total payable en points`,
    );
  }

  return { redemptionValue: fromMillimes(valueM) };
}

/**
 * Apply a REDEEM_PURCHASE transaction inside a sale-creation transaction.
 * Caller must have already validated and created the Payment row.
 */
export async function applySaleRedemption(
  tx: Tx,
  saleId: string,
  walletId: string,
  pointsToRedeem: number,
): Promise<{ redemptionValue: string }> {
  const wallet = await tx.rewardWallet.findUnique({ where: { id: walletId } });
  if (!wallet) {
    throw new RedemptionError("INVALID", "Portefeuille introuvable");
  }
  const program = await tx.rewardProgram.findUnique({
    where: { id: wallet.programId },
  });
  if (!program) {
    throw new RedemptionError("INVALID", "Programme introuvable");
  }

  const dpp = Number(program.dinarPerPoint.toString());
  const valueM = Math.round(pointsToRedeem * dpp * 1000);
  const newBalance = wallet.balance - pointsToRedeem;

  await tx.rewardTransaction.create({
    data: {
      walletId,
      delta: -pointsToRedeem,
      balanceAfter: newBalance,
      reason: "REDEEM_PURCHASE",
      saleId,
    },
  });
  await tx.rewardWallet.update({
    where: { id: walletId },
    data: {
      balance: newBalance,
      lifetimeRedeemed: { increment: pointsToRedeem },
      lastActivityAt: new Date(),
    },
  });

  return { redemptionValue: fromMillimes(valueM) };
}
