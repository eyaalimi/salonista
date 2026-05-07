/**
 * Phase 3 backfill — idempotent, safe to re-run.
 *
 * For every Phase 2 sale that pre-dates the auto-phantom-booking logic
 * (`bookingId IS NULL`, status PAID/PARTIALLY_REFUNDED/REFUNDED), create
 * a phantom Booking and link it back via Sale.bookingId.
 *
 * Run order on the server:
 *   npx prisma migrate deploy
 *   npx tsx prisma/backfill-phase3.ts
 */

import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const PAID_STATUSES = ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] as const;

async function main() {
  const sales = await prisma.sale.findMany({
    where: {
      bookingId: null,
      status: { in: PAID_STATUSES as unknown as ("PAID" | "PARTIALLY_REFUNDED" | "REFUNDED")[] },
    },
    select: {
      id: true,
      providerId: true,
      customerId: true,
      employeeId: true,
      total: true,
      createdAt: true,
      items: {
        select: {
          assignedEmployeeId: true,
          quantity: true,
          offer: { select: { durationMinutes: true } },
        },
      },
    },
  });

  console.log(`[phase3] ${sales.length} sale(s) without a booking`);

  let created = 0;
  for (const sale of sales) {
    // Resolve a clientId for the phantom Booking (schema requires it).
    let clientUserId: string | null = null;
    if (sale.customerId) {
      const customer = await prisma.customer.findUnique({
        where: { id: sale.customerId },
        select: { userId: true },
      });
      clientUserId = customer?.userId ?? null;
    }
    if (!clientUserId) {
      const provider = await prisma.providerProfile.findUnique({
        where: { id: sale.providerId },
        select: { userId: true },
      });
      clientUserId = provider?.userId ?? null;
    }
    if (!clientUserId) {
      console.warn(`  skipping sale ${sale.id}: no clientId resolvable`);
      continue;
    }

    // Most-common assigned employee on the lines.
    const assignmentCounts = new Map<string, number>();
    for (const item of sale.items) {
      if (!item.assignedEmployeeId) continue;
      assignmentCounts.set(
        item.assignedEmployeeId,
        (assignmentCounts.get(item.assignedEmployeeId) ?? 0) + item.quantity,
      );
    }
    let assignedEmpId: string | null = null;
    for (const [eid, cnt] of assignmentCounts) {
      if (!assignedEmpId || cnt > (assignmentCounts.get(assignedEmpId) ?? 0)) {
        assignedEmpId = eid;
      }
    }

    await prisma.$transaction(async (tx) => {
      const phantom = await tx.booking.create({
        data: {
          clientId: clientUserId!,
          customerId: sale.customerId,
          walkIn: true,
          createdViaPos: true,
          phantom: true,
          assignedEmployeeId: assignedEmpId,
          status: "COMPLETED",
          totalPrice: sale.total,
          createdAt: sale.createdAt,
        },
      });
      await tx.sale.update({
        where: { id: sale.id },
        data: { bookingId: phantom.id },
      });
    });
    created += 1;
  }

  console.log(`[phase3] created ${created} phantom booking(s)`);
  console.log("Backfill complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
