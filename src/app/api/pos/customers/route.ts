import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, toResponse } from "@/lib/employee-session";

/**
 * Phase 2 — POS-scoped customer list with per-customer aggregates.
 *
 * Returns own-scope customers (firstSalonId = provider) plus walk-ins,
 * with totalVisits (count of completed sales) and totalSpent (sum of sale
 * totals). Ordered alpha by lastName then firstName. No pagination yet —
 * we cap at 500 rows defensively.
 */
export async function GET(_req: NextRequest) {
  let employee;
  try {
    employee = await requirePermission("customers.view");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  const providerId = employee.providerId;

  type CustomerRow = {
    id: string;
    phone: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    createdAt: Date;
  };
  const customers = (await prisma.customer.findMany({
    where: { firstSalonId: providerId },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 500,
    select: {
      id: true,
      phone: true,
      firstName: true,
      lastName: true,
      email: true,
      createdAt: true,
    },
  })) as CustomerRow[];

  if (customers.length === 0) {
    return Response.json({ customers: [] });
  }

  // Per-customer aggregate of completed sales (PAID / PARTIALLY_REFUNDED / REFUNDED).
  const aggregates = await (prisma as never as {
    sale: {
      groupBy: (args: unknown) => Promise<Array<{ customerId: string | null; _count: { _all: number }; _sum: { total: unknown } }>>;
    };
  }).sale.groupBy({
    by: ["customerId"],
    where: {
      providerId,
      customerId: { in: customers.map((c) => c.id) },
      status: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] },
    },
    _count: { _all: true },
    _sum: { total: true },
  });

  const byCustomer = new Map(
    aggregates.map((a) => [a.customerId, { count: a._count._all, sum: a._sum.total }]),
  );

  // Loyalty wallets keyed by customerId
  const wallets = (await (prisma as never as {
    rewardWallet: { findMany: (args: unknown) => Promise<unknown[]> };
  }).rewardWallet.findMany({
    where: { providerId, customerId: { in: customers.map((c) => c.id) } },
    select: { customerId: true, balance: true },
  })) as Array<{ customerId: string; balance: number }>;
  const walletBy = new Map(wallets.map((w) => [w.customerId, w.balance]));

  return Response.json({
    customers: customers.map((c) => {
      const agg = byCustomer.get(c.id);
      return {
        id: c.id,
        phone: c.phone.startsWith("walk-in-") ? null : c.phone,
        isWalkIn: c.phone.startsWith("walk-in-"),
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        totalVisits: agg?.count ?? 0,
        totalSpent: agg?.sum ? String(agg.sum) : "0",
        loyaltyPoints: walletBy.get(c.id) ?? 0,
      };
    }),
  });
}
