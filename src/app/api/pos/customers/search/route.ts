import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { tryNormalizePhone } from "@/lib/phone";
import { requirePermission, toResponse } from "@/lib/employee-session";
import { hasModule } from "@/lib/modules";
import { getOrCreateProgram } from "@/lib/rewards/program";

/**
 * Universal customer search for the POS side panel.
 *
 * Accepts ?q=... and returns up to 8 candidates, matched on:
 *   - normalized phone (if q starts with digits or +)
 *   - firstName / lastName (case-insensitive, accent-insensitive via DB collation)
 *
 * Scoped to the current provider's own customers (firstSalonId).
 */
export async function GET(req: NextRequest) {
  let employee;
  try {
    employee = await requirePermission("customers.view");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return Response.json({ customers: [] });
  }

  const providerId = employee.providerId;
  const looksLikePhone = /^[\d+\s().-]+$/.test(q);

  type Row = {
    id: string;
    phone: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  };

  let customers: Row[] = [];

  if (looksLikePhone) {
    const norm = tryNormalizePhone(q);
    // Try exact normalized lookup first
    if (norm) {
      const exact = (await (prisma as never as {
        customer: { findUnique: (args: unknown) => Promise<Row | null> };
      }).customer.findUnique({
        where: { phone: norm },
        select: { id: true, phone: true, firstName: true, lastName: true, email: true },
      })) as Row | null;
      if (exact) customers = [exact];
    }
    // Also try partial match (numbers only)
    if (customers.length === 0) {
      const digits = q.replace(/\D/g, "");
      if (digits.length >= 4) {
        customers = (await (prisma as never as {
          customer: { findMany: (args: unknown) => Promise<Row[]> };
        }).customer.findMany({
          where: {
            firstSalonId: providerId,
            phone: { contains: digits },
            NOT: { phone: { startsWith: "walk-in-" } },
          },
          take: 8,
          select: { id: true, phone: true, firstName: true, lastName: true, email: true },
        })) as Row[];
      }
    }
  } else {
    // Name search
    customers = (await (prisma as never as {
      customer: { findMany: (args: unknown) => Promise<Row[]> };
    }).customer.findMany({
      where: {
        firstSalonId: providerId,
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 8,
      select: { id: true, phone: true, firstName: true, lastName: true, email: true },
    })) as Row[];
  }

  // Attach reward wallet summary so the ChargeModal can offer the loyalty
  // tile immediately after the cashier picks a customer via search — without
  // this, `customer.wallet` stayed undefined and the modal showed
  // "Aucun point disponible sur ce compte" even for customers who had points.
  const walletByCustomer = new Map<
    string,
    { walletId: string; balance: number; minPointsToRedeem: number; maxRedemptionPctPerSale: number; dinarPerPoint: string }
  >();
  if (customers.length > 0 && (await hasModule(providerId, "REWARDS"))) {
    const program = await getOrCreateProgram(providerId);
    if (program.active) {
      const wallets = await prisma.rewardWallet.findMany({
        where: { providerId, customerId: { in: customers.map((c) => c.id) } },
        select: { id: true, customerId: true, balance: true },
      });
      for (const w of wallets) {
        walletByCustomer.set(w.customerId, {
          walletId: w.id,
          balance: w.balance,
          minPointsToRedeem: program.minPointsToRedeem,
          maxRedemptionPctPerSale: program.maxRedemptionPctPerSale,
          dinarPerPoint: program.dinarPerPoint.toString(),
        });
      }
    }
  }

  return Response.json({
    customers: customers.map((c) => {
      const wallet = walletByCustomer.get(c.id);
      return {
        id: c.id,
        phone: c.phone.startsWith("walk-in-") ? null : c.phone,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        ...(wallet ? { wallet } : {}),
      };
    }),
  });
}
