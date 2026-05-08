/**
 * RewardWallet helpers — lazy creation, balance reads, POS bundles.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma, RewardWallet, RewardTransaction } from "@/generated/prisma/client";
import { hasModule } from "@/lib/modules";
import { getOrCreateProgram, programToCashbackPct } from "./program";

type Tx = Prisma.TransactionClient;

/**
 * Get or create a wallet. Idempotent — concurrent calls collapse to a single
 * row via the `(providerId, customerId)` unique constraint.
 *
 * Caller is responsible for verifying that REWARDS is active for the salon.
 */
export async function getOrCreateWallet(
  client: Tx | typeof prisma,
  programId: string,
  providerId: string,
  customerId: string,
): Promise<RewardWallet> {
  const existing = await client.rewardWallet.findUnique({
    where: { providerId_customerId: { providerId, customerId } },
  });
  if (existing) return existing;

  try {
    return await client.rewardWallet.create({
      data: { programId, providerId, customerId },
    });
  } catch {
    // Race: another caller just created it.
    const refetch = await client.rewardWallet.findUnique({
      where: { providerId_customerId: { providerId, customerId } },
    });
    if (refetch) return refetch;
    throw new Error("Impossible de créer le portefeuille fidélité");
  }
}

export async function getWalletBalance(walletId: string): Promise<number> {
  const wallet = await prisma.rewardWallet.findUnique({
    where: { id: walletId },
    select: { balance: true },
  });
  return wallet?.balance ?? 0;
}

export type PosWalletBundle = {
  walletId: string;
  balance: number;
  cashbackPct: string;
  minPointsToRedeem: number;
  maxRedemptionPctPerSale: number;
  dinarPerPoint: string;
  active: boolean;
  recentTransactions: Pick<
    RewardTransaction,
    "id" | "delta" | "balanceAfter" | "reason" | "createdAt" | "note"
  >[];
};

/**
 * Bundle for the POS charge modal. Returns null if REWARDS isn't active for
 * the salon, the customer has no wallet yet AND the program isn't active
 * (so we don't lazy-create wallets just to show a 0 balance for paused programs).
 *
 * If REWARDS is active but the wallet doesn't exist yet, this returns a synthetic
 * 0-balance bundle so the cashier can still see the program rules.
 */
export async function getWalletForPos(
  providerId: string,
  customerId: string,
): Promise<PosWalletBundle | null> {
  if (!(await hasModule(providerId, "REWARDS"))) return null;

  const program = await getOrCreateProgram(providerId);
  if (!program.active) return null;

  const wallet = await prisma.rewardWallet.findUnique({
    where: { providerId_customerId: { providerId, customerId } },
    include: {
      transactions: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          delta: true,
          balanceAfter: true,
          reason: true,
          createdAt: true,
          note: true,
        },
      },
    },
  });

  return {
    walletId: wallet?.id ?? "",
    balance: wallet?.balance ?? 0,
    cashbackPct: programToCashbackPct(program),
    minPointsToRedeem: program.minPointsToRedeem,
    maxRedemptionPctPerSale: program.maxRedemptionPctPerSale,
    dinarPerPoint: program.dinarPerPoint.toString(),
    active: program.active,
    recentTransactions: wallet?.transactions ?? [],
  };
}
