/**
 * Sale earning logic.
 *
 * Earnings are computed on the eligible portion of a sale, after sale-level
 * discount, minus any loyalty-redeemed portion (so points don't earn points).
 */

import type { Prisma, RewardProgram } from "@/generated/prisma/client";
import { toMillimes } from "@/lib/money";
import { getOrCreateWallet } from "./wallet";

type Tx = Prisma.TransactionClient;

export type SaleForEarn = {
  id: string;
  customerId: string | null;
  subtotal: { toString(): string };
  discountAmount: { toString(): string };
  total: { toString(): string };
  items: Array<{
    kind: "SERVICE" | "PRODUCT";
    lineTotal: { toString(): string };
  }>;
  payments: Array<{
    method: string;
    amount: { toString(): string };
  }>;
};

/**
 * Pure function — compute earned points for a sale given the program.
 *
 * Steps:
 *   1. Eligible subtotal = sum of lineTotal where kind matches eligibleOn.
 *      lineTotal already reflects line-level discount AND has had its share of
 *      the sale-level discount allocated (see sale-totals.ts), so no further
 *      proportional math is needed here.
 *   2. Subtract the loyalty-paid portion proportional to the eligible share
 *      of the sale total — points don't beget points.
 *   3. points = floor(eligibleBase × pointsPerDinar)  (as DT × pts/DT)
 *
 * Returns 0 if program inactive or eligibleBase ≤ 0.
 */
export function computeEarnedPoints(
  sale: SaleForEarn,
  // `pointsPerDinar` n'est utilise qu'a travers `.toString()` : accepter aussi
  // une chaine evite de fabriquer un `Decimal` dans les tests, alors que la
  // fonction n'en a jamais eu besoin. `Pick<RewardProgram, …>` imposait le
  // type de Prisma sans contrepartie.
  program: Pick<RewardProgram, "eligibleOn" | "active"> & {
    pointsPerDinar: { toString(): string };
  },
): number {
  if (!program.active) return 0;

  let eligibleM = 0;
  for (const line of sale.items) {
    const lineM = toMillimes(line.lineTotal.toString());
    if (
      program.eligibleOn === "BOTH" ||
      (program.eligibleOn === "SERVICES_ONLY" && line.kind === "SERVICE") ||
      (program.eligibleOn === "PRODUCTS_ONLY" && line.kind === "PRODUCT")
    ) {
      eligibleM += lineM;
    }
  }
  if (eligibleM <= 0) return 0;

  const totalM = toMillimes(sale.total.toString());
  if (totalM <= 0) return 0;

  // Loyalty-paid portion attributable to the eligible part:
  //   eligibleAfterLoyalty = eligible - loyaltyPaid × (eligible / total)
  const loyaltyPaidM = sale.payments
    .filter((p) => p.method === "LOYALTY_POINTS")
    .reduce((s, p) => s + toMillimes(p.amount.toString()), 0);

  const loyaltyOnEligibleM = Math.floor((loyaltyPaidM * eligibleM) / totalM);
  const baseM = eligibleM - loyaltyOnEligibleM;
  if (baseM <= 0) return 0;

  // points = floor(baseDT × pointsPerDinar)
  const pointsPerDinar = Number(program.pointsPerDinar.toString());
  const baseDT = baseM / 1000;
  return Math.floor(baseDT * pointsPerDinar);
}

/**
 * Apply EARN_PURCHASE + welcome/birthday bonuses for a freshly-paid sale.
 * Idempotent on saleId — re-running for the same sale is a no-op.
 */
export async function applySaleEarnings(
  tx: Tx,
  saleId: string,
): Promise<{ earned: number; welcomeBonus: number; birthdayBonus: number }> {
  // Idempotency check: any existing EARN_PURCHASE transaction for this sale?
  const existing = await tx.rewardTransaction.findFirst({
    where: { saleId, reason: "EARN_PURCHASE" },
    select: { id: true },
  });
  if (existing) return { earned: 0, welcomeBonus: 0, birthdayBonus: 0 };

  const sale = await tx.sale.findUnique({
    where: { id: saleId },
    include: {
      items: {
        select: { kind: true, lineTotal: true },
      },
      payments: { select: { method: true, amount: true } },
      customer: { select: { id: true, birthday: true } },
    },
  });
  if (!sale || !sale.customer) {
    return { earned: 0, welcomeBonus: 0, birthdayBonus: 0 };
  }

  const program = await tx.rewardProgram.findUnique({
    where: { providerId: sale.providerId },
  });
  if (!program || !program.active) {
    return { earned: 0, welcomeBonus: 0, birthdayBonus: 0 };
  }

  const earned = computeEarnedPoints(sale as unknown as SaleForEarn, program);

  const wallet = await getOrCreateWallet(tx, program.id, sale.providerId, sale.customer.id);

  // Bonuses.
  let welcomeBonus = 0;
  if (!wallet.welcomeBonusApplied && program.welcomeBonusPoints > 0) {
    welcomeBonus = program.welcomeBonusPoints;
  }

  let birthdayBonus = 0;
  if (program.birthdayBonusPoints > 0 && sale.customer.birthday) {
    const today = new Date();
    const bday = new Date(sale.customer.birthday);
    const sameMonth = today.getMonth() === bday.getMonth();
    const yearAlreadyApplied = wallet.lastBirthdayBonusYear === today.getFullYear();
    if (sameMonth && !yearAlreadyApplied) {
      birthdayBonus = program.birthdayBonusPoints;
    }
  }

  // Atomic claim of the welcome / birthday flags so concurrent first sales can't
  // double-apply. updateMany returns the row count; if it's 0, another tx
  // already won the race — skip that bonus.
  if (welcomeBonus > 0) {
    const claimed = await tx.rewardWallet.updateMany({
      where: { id: wallet.id, welcomeBonusApplied: false },
      data: { welcomeBonusApplied: true },
    });
    if (claimed.count === 0) welcomeBonus = 0;
  }

  if (birthdayBonus > 0) {
    const thisYear = new Date().getFullYear();
    const claimed = await tx.rewardWallet.updateMany({
      where: {
        id: wallet.id,
        OR: [{ lastBirthdayBonusYear: null }, { lastBirthdayBonusYear: { not: thisYear } }],
      },
      data: { lastBirthdayBonusYear: thisYear },
    });
    if (claimed.count === 0) birthdayBonus = 0;
  }

  // Apply transactions sequentially so balanceAfter snapshots are accurate.
  let runningBalance = wallet.balance;

  if (earned > 0) {
    runningBalance += earned;
    await tx.rewardTransaction.create({
      data: {
        walletId: wallet.id,
        delta: earned,
        balanceAfter: runningBalance,
        reason: "EARN_PURCHASE",
        saleId,
      },
    });
  }

  if (welcomeBonus > 0) {
    runningBalance += welcomeBonus;
    await tx.rewardTransaction.create({
      data: {
        walletId: wallet.id,
        delta: welcomeBonus,
        balanceAfter: runningBalance,
        reason: "WELCOME_BONUS",
        saleId,
      },
    });
  }

  if (birthdayBonus > 0) {
    runningBalance += birthdayBonus;
    await tx.rewardTransaction.create({
      data: {
        walletId: wallet.id,
        delta: birthdayBonus,
        balanceAfter: runningBalance,
        reason: "BIRTHDAY_BONUS",
        saleId,
      },
    });
  }

  if (earned > 0 || welcomeBonus > 0 || birthdayBonus > 0) {
    await tx.rewardWallet.update({
      where: { id: wallet.id },
      data: {
        balance: runningBalance,
        lifetimeEarned: { increment: earned + welcomeBonus + birthdayBonus },
        lastActivityAt: new Date(),
      },
    });
  }

  return { earned, welcomeBonus, birthdayBonus };
}
