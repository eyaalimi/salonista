/**
 * Le POST est retire : Salonista n'encaisse pas.
 *
 * Il posait `paymentStatus: "PAID"` et envoyait « Paiement effectue avec
 * succes » sans qu'aucun prestataire de paiement ne soit branche. Une cliente
 * connectee obtenait donc gratuitement un QR valide et une reservation
 * « payee ». Le QR est desormais emis a la creation de la reservation
 * (voir POST /api/bookings) et la cliente regle au salon.
 *
 * Le GET reste : il sert a reafficher le QR d'une reservation.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publicOrigin } from "@/lib/public-origin";

async function generateQR(text: string): Promise<string> {
  const QRCode = (await import("qrcode")).default;
  return QRCode.toDataURL(text, {
    width: 400,
    margin: 2,
    color: { dark: "#2D0A0A", light: "#FBF8F4" },
  });
}

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Le paiement en ligne n'est pas disponible. Votre réservation est déjà confirmée : présentez votre QR code au salon et réglez sur place.",
    },
    { status: 410 },
  );
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

  const verificationUrl = `${publicOrigin(req)}/verification?code=${booking.qrCode}`;
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
