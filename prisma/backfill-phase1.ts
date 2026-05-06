/**
 * Phase 1 backfill — idempotent, safe to re-run.
 *
 * Steps:
 *   1. For each User with role=CLIENT and a non-null phone, upsert a Customer
 *      keyed on the normalized phone, linked back to the user.
 *   2. For each existing Booking, set customerId from the linked client's phone
 *      (if a Customer with that phone exists and customerId isn't already set).
 *   3. For each ProviderProfile, ensure an OWNER SalonEmployee row exists.
 *
 * Run order:
 *   npx prisma migrate deploy
 *   npx tsx prisma/backfill-phase1.ts
 */

import { prisma } from "../src/lib/prisma";
import { tryNormalizePhone } from "../src/lib/phone";

let added = 0;
let skipped = 0;
let warnings = 0;

async function backfillCustomersFromClients() {
  const clients = await prisma.user.findMany({
    where: { role: "CLIENT", phone: { not: null } },
    select: { id: true, phone: true, name: true, email: true },
  });
  console.log(`[customers] ${clients.length} client(s) with phone`);

  for (const c of clients) {
    if (!c.phone) continue;
    const normalized = tryNormalizePhone(c.phone);
    if (!normalized) {
      console.warn(`[customers] skipping user ${c.id}: invalid phone "${c.phone}"`);
      warnings++;
      continue;
    }

    const existing = await prisma.customer.findUnique({
      where: { phone: normalized },
    });

    if (existing) {
      if (existing.userId && existing.userId !== c.id) {
        console.warn(
          `[customers] phone ${normalized}: existing customer ${existing.id} is linked to a different user — leaving as-is`,
        );
        warnings++;
        skipped++;
        continue;
      }
      if (!existing.userId) {
        await prisma.customer.update({
          where: { id: existing.id },
          data: { userId: c.id },
        });
      }
      skipped++;
      continue;
    }

    const [firstName, ...rest] = (c.name ?? "").trim().split(/\s+/);
    const lastName = rest.join(" ") || null;

    await prisma.customer.create({
      data: {
        phone: normalized,
        firstName: firstName || null,
        lastName,
        email: c.email,
        userId: c.id,
      },
    });
    added++;
  }
}

async function backfillBookingCustomerIds() {
  const bookings = await prisma.booking.findMany({
    where: { customerId: null },
    select: { id: true, client: { select: { phone: true } } },
  });
  console.log(`[bookings] ${bookings.length} booking(s) without customerId`);

  let linked = 0;
  for (const b of bookings) {
    if (!b.client.phone) continue;
    const normalized = tryNormalizePhone(b.client.phone);
    if (!normalized) continue;
    const customer = await prisma.customer.findUnique({
      where: { phone: normalized },
      select: { id: true },
    });
    if (!customer) continue;
    await prisma.booking.update({
      where: { id: b.id },
      data: { customerId: customer.id },
    });
    linked++;
  }
  console.log(`[bookings] linked ${linked} booking(s) to customers`);
}

async function backfillProviderOwners() {
  const providers = await prisma.providerProfile.findMany({
    select: {
      id: true,
      userId: true,
      salonName: true,
      user: { select: { name: true } },
      employees: { where: { role: "OWNER" }, select: { id: true } },
    },
  });
  console.log(`[employees] ${providers.length} provider(s)`);

  let created = 0;
  for (const p of providers) {
    if (p.employees.length > 0) continue;
    await prisma.salonEmployee.create({
      data: {
        providerId: p.id,
        userId: p.userId,
        displayName: p.user?.name ?? p.salonName,
        role: "OWNER",
      },
    });
    created++;
  }
  console.log(`[employees] created ${created} OWNER row(s)`);
}

async function main() {
  await backfillCustomersFromClients();
  console.log(`[customers] added ${added}, skipped ${skipped}, warnings ${warnings}`);
  await backfillBookingCustomerIds();
  await backfillProviderOwners();
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
