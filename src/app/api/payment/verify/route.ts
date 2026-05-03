import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.json({ error: "Code requis" }, { status: 400 });

  const booking = await prisma.booking.findUnique({
    where: { qrCode: code },
    include: {
      items: {
        include: {
          offer: { include: { provider: { select: { salonName: true } } } },
          slot: true,
        },
      },
      client: { select: { name: true, email: true } },
    },
  });

  if (!booking) {
    return NextResponse.json({ valid: false, error: "Code invalide" }, { status: 404 });
  }

  const firstItem = booking.items[0];
  return NextResponse.json({
    valid: true,
    verified: booking.qrVerified,
    verifiedAt: booking.qrVerifiedAt,
    booking: {
      id: booking.id,
      offerTitle: booking.items.map((i) => i.offer.title).join(", "),
      salonName: firstItem?.offer.provider.salonName,
      clientName: booking.client.name,
      clientEmail: booking.client.email,
      totalPrice: booking.totalPrice,
      bookedFor: firstItem?.slot.startTime,
      paymentStatus: booking.paymentStatus,
      status: booking.status,
      paidAt: booking.paidAt,
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  }

  if (session.user.role !== "PROVIDER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorise" }, { status: 403 });
  }

  const { code } = await req.json();
  if (!code) return NextResponse.json({ error: "Code requis" }, { status: 400 });

  const booking = await prisma.booking.findUnique({
    where: { qrCode: code },
    include: {
      items: { include: { offer: { select: { title: true, providerId: true } }, slot: true } },
      client: { select: { name: true, email: true } },
    },
  });

  if (!booking) {
    return NextResponse.json({ valid: false, error: "Code invalide" }, { status: 404 });
  }

  if (session.user.role === "PROVIDER") {
    const providerProfile = await prisma.providerProfile.findUnique({
      where: { userId: session.user.id },
    });
    const owns = booking.items.some((it) => it.offer.providerId === providerProfile?.id);
    if (!providerProfile || !owns) {
      return NextResponse.json(
        { error: "Cette reservation ne vous appartient pas" },
        { status: 403 }
      );
    }
  }

  if (booking.paymentStatus !== "PAID")
    return NextResponse.json({ error: "Reservation non payee" }, { status: 400 });

  const firstItem = booking.items[0];
  const offerTitle = booking.items.map((i) => i.offer.title).join(", ");

  if (booking.qrVerified) {
    return NextResponse.json({
      valid: true,
      alreadyVerified: true,
      verifiedAt: booking.qrVerifiedAt,
      message: "Ce QR code a deja ete verifie",
      booking: {
        id: booking.id,
        offerTitle,
        clientName: booking.client.name,
        clientEmail: booking.client.email,
        totalPrice: booking.totalPrice,
        bookedFor: firstItem?.slot.startTime,
      },
    });
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      qrVerified: true,
      qrVerifiedAt: new Date(),
      status: "COMPLETED",
    },
  });

  return NextResponse.json({
    valid: true,
    verified: true,
    message: "Client verifie avec succes",
    booking: {
      id: updated.id,
      offerTitle,
      clientName: booking.client.name,
      clientEmail: booking.client.email,
      totalPrice: booking.totalPrice,
      bookedFor: firstItem?.slot.startTime,
    },
  });
}
