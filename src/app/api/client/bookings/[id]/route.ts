import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// DELETE: cancel a booking (client only, only if PENDING)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  }

  const { id } = await params;

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking || booking.clientId !== session.user.id) {
    return NextResponse.json({ error: "Réservation introuvable" }, { status: 404 });
  }

  if (booking.status !== "PENDING") {
    return NextResponse.json(
      { error: "Seules les réservations en attente peuvent être annulées" },
      { status: 400 }
    );
  }

  await prisma.$transaction(async (tx) => {
    // Free up slots
    const items = await tx.bookingItem.findMany({ where: { bookingId: id } });
    for (const it of items) {
      await tx.timeSlot.update({
        where: { id: it.slotId },
        data: { bookedCount: { decrement: 1 } },
      });
    }
    await tx.booking.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
    await tx.commission.deleteMany({ where: { bookingId: id } });
  });

  return NextResponse.json({ success: true });
}
