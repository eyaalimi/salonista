import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";
import { sendPaymentConfirmationEmail } from "@/lib/mail";

async function generateQR(text: string): Promise<string> {
  const QRCode = (await import("qrcode")).default;
  return QRCode.toDataURL(text, {
    width: 400,
    margin: 2,
    color: { dark: "#2D0A0A", light: "#FBF8F4" },
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  }

  const { bookingId } = await req.json();
  if (!bookingId) {
    return NextResponse.json({ error: "ID de reservation requis" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      items: {
        include: {
          offer: {
            include: { provider: { select: { salonName: true, address: true, city: true } } },
          },
          slot: true,
        },
      },
      client: { select: { name: true, email: true } },
    },
  });

  if (!booking) return NextResponse.json({ error: "Reservation introuvable" }, { status: 404 });
  if (booking.clientId !== session.user.id)
    return NextResponse.json({ error: "Non autorise" }, { status: 403 });
  if (booking.paymentStatus === "PAID")
    return NextResponse.json({ error: "Deja payee" }, { status: 400 });
  if (booking.status === "CANCELLED")
    return NextResponse.json({ error: "Reservation annulee" }, { status: 400 });

  const qrToken = `BT-${nanoid(16)}`;
  const verificationUrl = `${req.nextUrl.origin}/api/payment/verify?code=${qrToken}`;
  const qrDataUrl = await generateQR(verificationUrl);

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      paymentStatus: "PAID",
      qrCode: qrToken,
      paidAt: new Date(),
      status: "CONFIRMED",
    },
  });

  const firstItem = booking.items[0];
  if (firstItem) {
    sendPaymentConfirmationEmail(booking.client.email, {
      clientName: booking.client.name || "",
      offerTitle: booking.items.map((i) => i.offer.title).join(", "),
      salonName: firstItem.offer.provider.salonName,
      date: new Date(firstItem.slot.startTime).toLocaleDateString("fr-TN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      price: Number(booking.totalPrice).toFixed(0),
      qrCode: qrDataUrl,
      qrToken,
    }).catch(console.error);
  }

  return NextResponse.json({
    success: true,
    booking: updated,
    qrCode: qrDataUrl,
    qrToken,
    message: "Paiement effectue avec succes",
  });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  }

  const bookingId = req.nextUrl.searchParams.get("bookingId");
  if (!bookingId) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      items: {
        include: {
          offer: {
            include: { provider: { select: { salonName: true, address: true, city: true } } },
          },
          slot: true,
        },
      },
      client: { select: { name: true, email: true } },
    },
  });

  if (!booking || booking.clientId !== session.user.id)
    return NextResponse.json({ error: "Non autorise" }, { status: 403 });
  if (!booking.qrCode) return NextResponse.json({ error: "Pas de QR code" }, { status: 404 });

  const verificationUrl = `${req.nextUrl.origin}/api/payment/verify?code=${booking.qrCode}`;
  const qrDataUrl = await generateQR(verificationUrl);

  const firstItem = booking.items[0];
  return NextResponse.json({
    qrCode: qrDataUrl,
    qrToken: booking.qrCode,
    verified: booking.qrVerified,
    verifiedAt: booking.qrVerifiedAt,
    booking: {
      id: booking.id,
      offerTitle: booking.items.map((i) => i.offer.title).join(", "),
      salonName: firstItem?.offer.provider.salonName,
      address: firstItem?.offer.provider.address,
      city: firstItem?.offer.provider.city,
      totalPrice: booking.totalPrice,
      bookedFor: firstItem?.slot.startTime,
      clientName: booking.client.name,
      clientEmail: booking.client.email,
      paidAt: booking.paidAt,
    },
  });
}
