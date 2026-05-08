import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee, toResponse } from "@/lib/employee-session";
import { requireModule } from "@/lib/modules";
import { getOrCreateProgram } from "@/lib/rewards/program";

export async function GET(req: NextRequest) {
  let employee;
  try {
    employee = await requireEmployee();
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  try {
    await requireModule(employee.providerId, "REWARDS");
  } catch {
    return Response.json({ error: "Module Fidélité non activé" }, { status: 403 });
  }

  const url = new URL(req.url);
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  const to = toStr ? new Date(toStr) : new Date();
  const from = fromStr ? new Date(fromStr) : new Date(to.getTime() - 30 * 24 * 3600 * 1000);

  const program = await getOrCreateProgram(employee.providerId);
  const dpp = Number(program.dinarPerPoint.toString());

  const wallets = await prisma.rewardWallet.findMany({
    where: { providerId: employee.providerId },
    select: { balance: true, lifetimeEarned: true, lifetimeRedeemed: true },
  });
  const pointsInCirculation = wallets.reduce((s, w) => s + Math.max(0, w.balance), 0);
  const activeCards = wallets.filter((w) => w.balance > 0).length;

  // Engagement window
  const txInRange = await prisma.rewardTransaction.findMany({
    where: {
      wallet: { providerId: employee.providerId },
      createdAt: { gte: from, lte: to },
    },
    select: { delta: true, reason: true },
  });
  const earned = txInRange
    .filter((t) => t.reason === "EARN_PURCHASE")
    .reduce((s, t) => s + t.delta, 0);
  const redeemed = txInRange
    .filter((t) => t.reason === "REDEEM_PURCHASE")
    .reduce((s, t) => s + Math.abs(t.delta), 0);

  // Lifetime bonuses
  const bonusAgg = await prisma.rewardTransaction.groupBy({
    by: ["reason"],
    where: {
      wallet: { providerId: employee.providerId },
      reason: { in: ["WELCOME_BONUS", "BIRTHDAY_BONUS"] },
    },
    _count: { _all: true },
    _sum: { delta: true },
  });
  const welcome = bonusAgg.find((b) => b.reason === "WELCOME_BONUS");
  const birthday = bonusAgg.find((b) => b.reason === "BIRTHDAY_BONUS");

  // Top earners
  const topWallets = await prisma.rewardWallet.findMany({
    where: { providerId: employee.providerId },
    orderBy: { lifetimeEarned: "desc" },
    take: 10,
    include: {
      customer: {
        select: { id: true, firstName: true, lastName: true, phone: true },
      },
    },
  });

  return Response.json({
    range: { from, to },
    liability: {
      pointsInCirculation,
      valueDT: (pointsInCirculation * dpp).toFixed(3),
      activeCards,
    },
    engagement: {
      earned,
      redeemed,
      redemptionRate: earned > 0 ? Number(((redeemed / earned) * 100).toFixed(2)) : 0,
    },
    bonuses: {
      welcome: { count: welcome?._count._all ?? 0, points: welcome?._sum.delta ?? 0 },
      birthday: { count: birthday?._count._all ?? 0, points: birthday?._sum.delta ?? 0 },
    },
    topEarners: topWallets.map((w) => ({
      id: w.id,
      customer: w.customer,
      lifetimeEarned: w.lifetimeEarned,
      lifetimeRedeemed: w.lifetimeRedeemed,
      balance: w.balance,
      lastActivityAt: w.lastActivityAt,
    })),
  });
}
