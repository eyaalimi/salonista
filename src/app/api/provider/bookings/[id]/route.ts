import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendBookingStatusEmail } from "@/lib/mail";

// PUT: update booking status (confirm/complete/cancel)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "PROVIDER") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const profile = await prisma.providerProfile.findUnique({
    where: { userId: session.user.id },
  });

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      items: { include: { offer: { include: { provider: { select: { salonName: true } } } } } },
      client: { select: { name: true, email: true } },
    },
  });

  // Verify at least one item belongs to this provider
  if (!booking || !booking.items.some((it) => it.offer.providerId === profile?.id)) {
    return NextResponse.json({ error: "Réservation introuvable" }, { status: 404 });
  }

  const { status } = await req.json();
  if (!["CONFIRMED", "COMPLETED", "CANCELLED"].includes(status)) {
    return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
  }

  const updated = await prisma.booking.update({
    where: { id },
    data: { status },
  });

  if (status === "COMPLETED") {
    await prisma.commission.updateMany({
      where: { bookingId: id },
      data: { status: "PAID" },
    });
  }

  if (["CONFIRMED", "CANCELLED", "COMPLETED"].includes(status)) {
    const firstItem = booking.items[0];
    sendBookingStatusEmail(booking.client.email, {
      clientName: booking.client.name || "",
      offerTitle: booking.items.map((i) => i.offer.title).join(", "),
      salonName: firstItem.offer.provider.salonName,
      status,
    }).catch(console.error);
  }

  return NextResponse.json(updated);
}
