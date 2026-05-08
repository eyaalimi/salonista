import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, ctx: { params: Promise<{ walletId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ error: "Non authentifié" }, { status: 401 });

  const { walletId } = await ctx.params;
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(50, Math.max(5, Number(url.searchParams.get("pageSize")) || 20));

  const wallet = await prisma.rewardWallet.findUnique({
    where: { id: walletId },
    include: {
      customer: { select: { userId: true } },
      provider: { select: { id: true, salonName: true, city: true, photos: true } },
      program: true,
    },
  });
  if (!wallet || wallet.customer.userId !== session.user.id) {
    return Response.json({ error: "Portefeuille introuvable" }, { status: 404 });
  }

  const [total, transactions] = await Promise.all([
    prisma.rewardTransaction.count({ where: { walletId } }),
    prisma.rewardTransaction.findMany({
      where: { walletId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { sale: { select: { receiptNumber: true } } },
    }),
  ]);

  return Response.json({
    id: wallet.id,
    balance: wallet.balance,
    lifetimeEarned: wallet.lifetimeEarned,
    lifetimeRedeemed: wallet.lifetimeRedeemed,
    lastActivityAt: wallet.lastActivityAt,
    provider: {
      id: wallet.provider.id,
      salonName: wallet.provider.salonName,
      city: wallet.provider.city,
      photo: wallet.provider.photos[0] ?? null,
    },
    program: {
      pointsPerDinar: wallet.program.pointsPerDinar.toString(),
      dinarPerPoint: wallet.program.dinarPerPoint.toString(),
      minPointsToRedeem: wallet.program.minPointsToRedeem,
      maxRedemptionPctPerSale: wallet.program.maxRedemptionPctPerSale,
      inactivityExpireMonths: wallet.program.inactivityExpireMonths,
    },
    transactions: {
      page,
      pageSize,
      total,
      items: transactions.map((t) => ({
        id: t.id,
        delta: t.delta,
        balanceAfter: t.balanceAfter,
        reason: t.reason,
        createdAt: t.createdAt,
        note: t.note,
        sale: t.sale,
      })),
    },
  });
}
