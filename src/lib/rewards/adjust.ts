/**
 * Manual wallet adjustments by owners/managers (rewards.adjust).
 */

import { prisma } from "@/lib/prisma";
import type { RewardTransaction } from "@/generated/prisma/client";

export class AdjustmentError extends Error {
  constructor(public code: "INVALID" | "NOT_FOUND" | "EMPTY_NOTE", message: string) {
    super(message);
    this.name = "AdjustmentError";
  }
}

export async function adjustWallet(
  walletId: string,
  delta: number,
  employeeId: string,
  note: string,
): Promise<RewardTransaction> {
  if (!Number.isFinite(delta) || delta === 0) {
    throw new AdjustmentError("INVALID", "Variation de points invalide");
  }
  if (!Number.isInteger(delta)) {
    throw new AdjustmentError("INVALID", "La variation doit être un entier");
  }
  if (!note || !note.trim()) {
    throw new AdjustmentError("EMPTY_NOTE", "Une note explicative est requise");
  }

  return prisma.$transaction(async (tx) => {
    const wallet = await tx.rewardWallet.findUnique({ where: { id: walletId } });
    if (!wallet) {
      throw new AdjustmentError("NOT_FOUND", "Portefeuille introuvable");
    }
    const newBalance = wallet.balance + delta;

    const txn = await tx.rewardTransaction.create({
      data: {
        walletId,
        delta,
        balanceAfter: newBalance,
        reason: "MANUAL_ADJUSTMENT",
        adjustedByEmployeeId: employeeId,
        note: note.trim(),
      },
    });
    await tx.rewardWallet.update({
      where: { id: walletId },
      data: {
        balance: newBalance,
        lifetimeEarned: delta > 0 ? { increment: delta } : undefined,
        lifetimeRedeemed: delta < 0 ? { increment: -delta } : undefined,
        lastActivityAt: new Date(),
      },
    });
    return txn;
  });
}
