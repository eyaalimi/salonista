import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL!),
});

async function main() {
  const bookings = await prisma.booking.findMany({
    select: { id: true, status: true, paymentStatus: true },
  });

  if (bookings.length === 0) {
    console.log("Aucune réservation trouvée.");
    return;
  }

  console.log("Réservations trouvées :");
  bookings.forEach((b, i) => console.log(`  ${i + 1}. [${b.status}] [${b.paymentStatus}] (${b.id})`));

  // Force ALL non-cancelled bookings to COMPLETED + PAID
  const updated = await prisma.booking.updateMany({
    where: { status: { not: "CANCELLED" } },
    data: { status: "COMPLETED", paymentStatus: "PAID" },
  });

  console.log(`\n✓ ${updated.count} réservation(s) passée(s) en COMPLETED + PAID`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
