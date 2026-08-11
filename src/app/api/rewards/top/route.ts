/**
 * Top N loyalty customers — used by the loyalty page dashboard widget.
 *
 * Returns up to `limit` customers with the highest current wallet balance
 * for the caller's provider. Default 10, capped at 25 defensively.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee, toResponse } from "@/lib/employee-session";
import { requireModule } from "@/lib/modules";

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

  const limitRaw = Number(req.nextUrl.searchParams.get("limit"));
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(25, Math.floor(limitRaw)) : 10;

  const wallets = await prisma.rewardWallet.findMany({
    where: { providerId: employee.providerId, balance: { gt: 0 } },
    orderBy: { balance: "desc" },
    take: limit,
    select: {
      id: true,
      balance: true,
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
        },
      },
    },
  });

  return Response.json({
    items: wallets.map((w, idx) => ({
      rank: idx + 1,
      walletId: w.id,
      balance: w.balance,
      customer: w.customer,
    })),
  });
}
