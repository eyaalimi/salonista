import { prisma } from "@/lib/prisma";
import { hasModule, requireModule } from "@/lib/modules";
import { requireEmployee, toResponse } from "@/lib/employee-session";
import { getOrCreateProgram } from "@/lib/rewards/program";

/**
 * Single payload primer for the offline POS shell.
 *
 * Returns active offers + active products + own-scope customers for the
 * current salon. The shell calls this on POS load and any time the
 * StaleWhileRevalidate worker invalidates the cache.
 */
export async function GET() {
  let employee;
  try {
    employee = await requireEmployee();
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }

  try {
    await requireModule(employee.providerId, "POS");
  } catch {
    return Response.json({ error: "Module POS non activé" }, { status: 403 });
  }

  const providerId = employee.providerId;

  const [offers, products, customers, employees, provider] = await Promise.all([
    prisma.offer.findMany({
      where: { providerId, active: true },
      orderBy: { title: "asc" },
      select: {
        id: true,
        title: true,
        description: true,
        discountPrice: true,
        durationMinutes: true,
        taxRate: true,
        photos: true,
        category: true,
      },
    }),
    prisma.product.findMany({
      where: { providerId, active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        sku: true,
        barcode: true,
        salePrice: true,
        taxRate: true,
        stockQuantity: true,
        lowStockThreshold: true,
        photo: true,
      },
    }),
    prisma.customer.findMany({
      where: { firstSalonId: providerId },
      orderBy: { firstName: "asc" },
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    }),
    prisma.salonEmployee.findMany({
      where: { providerId, active: true },
      orderBy: { displayName: "asc" },
      select: {
        id: true,
        displayName: true,
        role: true,
      },
    }),
    prisma.providerProfile.findUnique({
      where: { id: providerId },
      select: {
        id: true,
        salonName: true,
        address: true,
        city: true,
        phone: true,
        matriculeFiscal: true,
        receiptFooter: true,
      },
    }),
  ]);

  // Attach wallet summary for own-scope customers when REWARDS is active.
  let customersWithWallets: Array<
    (typeof customers)[number] & {
      wallet?: {
        walletId: string;
        balance: number;
        minPointsToRedeem: number;
        maxRedemptionPctPerSale: number;
        dinarPerPoint: string;
      };
    }
  > = customers;
  if (await hasModule(providerId, "REWARDS")) {
    const program = await getOrCreateProgram(providerId);
    if (program.active && customers.length > 0) {
      const wallets = await prisma.rewardWallet.findMany({
        where: { providerId, customerId: { in: customers.map((c) => c.id) } },
        select: { id: true, customerId: true, balance: true },
      });
      const byCustomer = new Map(wallets.map((w) => [w.customerId, w]));
      customersWithWallets = customers.map((c) => {
        const w = byCustomer.get(c.id);
        return w
          ? {
              ...c,
              wallet: {
                walletId: w.id,
                balance: w.balance,
                minPointsToRedeem: program.minPointsToRedeem,
                maxRedemptionPctPerSale: program.maxRedemptionPctPerSale,
                dinarPerPoint: program.dinarPerPoint.toString(),
              },
            }
          : c;
      });
    }
  }

  return Response.json({
    refreshedAt: new Date().toISOString(),
    provider,
    offers,
    products,
    customers: customersWithWallets,
    employees,
  });
}
