import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/modules";
import { requireEmployee, toResponse } from "@/lib/employee-session";

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

  return Response.json({
    refreshedAt: new Date().toISOString(),
    provider,
    offers,
    products,
    customers,
    employees,
  });
}
