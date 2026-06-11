import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveVerifier } from "@/lib/verify-authz";

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

  let verifiedByDisplayName: string | undefined;
  const verifiedById = (booking as { qrVerifiedByEmployeeId?: string | null }).qrVerifiedByEmployeeId;
  if (booking.qrVerified && verifiedById) {
    const emp = await prisma.salonEmployee.findUnique({
      where: { id: verifiedById },
      select: { displayName: true },
    });
    verifiedByDisplayName = emp?.displayName;
  }

  return NextResponse.json({
    valid: true,
    verified: booking.qrVerified,
    verifiedAt: booking.qrVerifiedAt,
    verifiedBy: verifiedByDisplayName ? { displayName: verifiedByDisplayName } : undefined,
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

  // PIN-employee permission gate (403 with explicit French message).
  // We check this BEFORE resolveVerifier so a logged-in cashier who is
  // missing the permission gets a clear 403, not the generic 401.
  if (session?.employee) {
    const perms = session.employee.permissions;
    if (!perms || !perms["bookings.edit"]) {
      return NextResponse.json(
        { error: "Vous n'avez pas la permission de valider les arrivées" },
        { status: 403 },
      );
    }
  }

  // Defense in depth: resolveVerifier also enforces "bookings.edit" on
  // PIN sessions. If both gates are ever to disagree, the verifier wins
  // and the caller silently becomes `kind: "none"` → 401.
  const verifier = await resolveVerifier(session, "bookings.edit");

  if (verifier.kind === "none") {
    return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
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

  // Ownership check (admin bypasses)
  if (verifier.kind !== "admin") {
    const owns = booking.items.some((it) => it.offer.providerId === verifier.providerId);
    if (!owns) {
      return NextResponse.json(
        { error: "Cette réservation n'appartient pas à votre salon" },
        { status: 403 },
      );
    }
  }

  if (booking.paymentStatus !== "PAID") {
    return NextResponse.json({ error: "Réservation non payée" }, { status: 400 });
  }

  const firstItem = booking.items[0];
  const offerTitle = booking.items.map((i) => i.offer.title).join(", ");

  let verifiedByDisplayName: string | undefined;

  if (booking.qrVerified) {
    const verifiedById = (booking as { qrVerifiedByEmployeeId?: string | null }).qrVerifiedByEmployeeId;
    if (verifiedById) {
      const emp = await prisma.salonEmployee.findUnique({
        where: { id: verifiedById },
        select: { displayName: true },
      });
      verifiedByDisplayName = emp?.displayName;
    }
    return NextResponse.json({
      valid: true,
      alreadyVerified: true,
      verifiedAt: booking.qrVerifiedAt,
      verifiedBy: verifiedByDisplayName ? { displayName: verifiedByDisplayName } : undefined,
      message: "Ce QR code a déjà été vérifié",
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
      qrVerifiedByEmployeeId: verifier.kind === "employee" ? verifier.employeeId : null,
      status: "COMPLETED",
    } as never, // prisma generate is broken locally; new field
  });

  if (verifier.kind === "employee") {
    const emp = await prisma.salonEmployee.findUnique({
      where: { id: verifier.employeeId },
      select: { displayName: true },
    });
    verifiedByDisplayName = emp?.displayName;
  }

  return NextResponse.json({
    valid: true,
    verified: true,
    verifiedBy: verifiedByDisplayName ? { displayName: verifiedByDisplayName } : undefined,
    message: "Client vérifié avec succès",
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
