import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee, toResponse } from "@/lib/employee-session";
import { requireModule } from "@/lib/modules";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
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

  const { id } = await ctx.params;
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(50, Math.max(5, Number(url.searchParams.get("pageSize")) || 20));

  const wallet = await prisma.rewardWallet.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, phone: true, birthday: true } },
      program: true,
    },
  });
  if (!wallet || wallet.providerId !== employee.providerId) {
    return Response.json({ error: "Portefeuille introuvable" }, { status: 404 });
  }

  const [txTotal, transactions] = await Promise.all([
    prisma.rewardTransaction.count({ where: { walletId: id } }),
    prisma.rewardTransaction.findMany({
      where: { walletId: id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        sale: { select: { id: true, receiptNumber: true } },
        adjustedBy: { select: { id: true, displayName: true } },
      },
    }),
  ]);

  return Response.json({
    id: wallet.id,
    balance: wallet.balance,
    lifetimeEarned: wallet.lifetimeEarned,
    lifetimeRedeemed: wallet.lifetimeRedeemed,
    welcomeBonusApplied: wallet.welcomeBonusApplied,
    lastBirthdayBonusYear: wallet.lastBirthdayBonusYear,
    lastActivityAt: wallet.lastActivityAt,
    customer: wallet.customer,
    program: {
      pointsPerDinar: wallet.program.pointsPerDinar.toString(),
      dinarPerPoint: wallet.program.dinarPerPoint.toString(),
    },
    transactions: {
      page,
      pageSize,
      total: txTotal,
      items: transactions.map((t) => ({
        id: t.id,
        delta: t.delta,
        balanceAfter: t.balanceAfter,
        reason: t.reason,
        createdAt: t.createdAt,
        note: t.note,
        sale: t.sale,
        adjustedBy: t.adjustedBy,
      })),
    },
  });
}
