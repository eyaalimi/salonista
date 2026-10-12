import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee, toResponse } from "@/lib/employee-session";
import { hasFeature, reponsePremiumRequis } from "@/lib/plan-serveur";
import { MESSAGES_PREMIUM } from "@/lib/plan";

export async function GET(req: NextRequest) {
  let employee;
  try {
    employee = await requireEmployee();
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  if (!(await hasFeature(employee.providerId, "FIDELITE"))) {
    return reponsePremiumRequis(MESSAGES_PREMIUM.fidelite);
  }

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(50, Math.max(5, Number(url.searchParams.get("pageSize")) || 20));
  const search = (url.searchParams.get("search") ?? "").trim();
  const sort = url.searchParams.get("sort") ?? "balance";

  const where = {
    providerId: employee.providerId,
    ...(search
      ? {
          customer: {
            OR: [
              { phone: { contains: search } },
              { firstName: { contains: search, mode: "insensitive" as const } },
              { lastName: { contains: search, mode: "insensitive" as const } },
            ],
          },
        }
      : {}),
  };

  const orderBy =
    sort === "lifetimeEarned"
      ? { lifetimeEarned: "desc" as const }
      : sort === "lastActivity"
        ? { lastActivityAt: "desc" as const }
        : { balance: "desc" as const };

  const [total, wallets] = await Promise.all([
    prisma.rewardWallet.count({ where }),
    prisma.rewardWallet.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
      },
    }),
  ]);

  return Response.json({
    page,
    pageSize,
    total,
    items: wallets.map((w) => ({
      id: w.id,
      balance: w.balance,
      lifetimeEarned: w.lifetimeEarned,
      lifetimeRedeemed: w.lifetimeRedeemed,
      lastActivityAt: w.lastActivityAt,
      customer: w.customer,
    })),
  });
}
