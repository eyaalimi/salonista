/**
 * Refund clawback — reverses a proportional share of the original EARN_PURCHASE
 * for the refunded sale. Redeemed points are NOT restored on refund.
 */

import type { Prisma } from "@/generated/prisma/client";
import { toMillimes } from "@/lib/money";

type Tx = Prisma.TransactionClient;

/**
 * Idempotent on refundId — re-running for the same refund is a no-op.
 */
export async function clawbackOnRefund(
  tx: Tx,
  refundId: string,
): Promise<{ clawedBack: number }> {
  // Idempotency: already a REFUND_REVERSAL for this refund?
  const existing = await tx.rewardTransaction.findFirst({
    where: { refundId, reason: "REFUND_REVERSAL" },
    select: { id: true },
  });
  if (existing) return { clawedBack: 0 };

  const refund = await tx.refund.findUnique({
    where: { id: refundId },
    include: {
      sale: {
        select: {
          id: true,
          total: true,
          rewardTransactions: {
            where: { reason: "EARN_PURCHASE" },
            select: { walletId: true, delta: true },
          },
        },
      },
    },
  });
  if (!refund) return { clawedBack: 0 };

  const earnTx = refund.sale.rewardTransactions[0];
  if (!earnTx || earnTx.delta <= 0) return { clawedBack: 0 };

  const saleTotalM = toMillimes(refund.sale.total.toString());
  if (saleTotalM <= 0) return { clawedBack: 0 };
  const refundM = toMillimes(refund.totalAmount.toString());

  // Clawback proportional to refund share of sale total.
  const clawback = Math.floor((earnTx.delta * refundM) / saleTotalM);
  if (clawback <= 0) return { clawedBack: 0 };

  const wallet = await tx.rewardWallet.findUnique({
    where: { id: earnTx.walletId },
  });
  if (!wallet) return { clawedBack: 0 };

  const newBalance = wallet.balance - clawback;
  await tx.rewardTransaction.create({
    data: {
      walletId: earnTx.walletId,
      delta: -clawback,
      balanceAfter: newBalance,
      reason: "REFUND_REVERSAL",
      refundId,
      saleId: refund.sale.id,
    },
  });
  await tx.rewardWallet.update({
    where: { id: earnTx.walletId },
    data: {
      balance: newBalance,
      lastActivityAt: new Date(),
    },
  });

  return { clawedBack: clawback };
}
