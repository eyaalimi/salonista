import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { regenerateOfferSlots } from "@/lib/slots";

const ALLOWED_DURATIONS = [15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240];

// GET: single offer
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const offer = await prisma.offer.findUnique({
    where: { id },
    include: {
      provider: { select: { salonName: true, city: true, category: true, photos: true } },
      slots: { orderBy: { startTime: "asc" } },
      _count: { select: { bookingItems: true, trackingLinks: true } },
    },
  });

  if (!offer) {
    return NextResponse.json({ error: "Offre introuvable" }, { status: 404 });
  }

  return NextResponse.json(offer);
}

// PUT: update offer (owner only)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "PROVIDER") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const profile = await prisma.providerProfile.findUnique({
    where: { userId: session.user.id },
  });

  const offer = await prisma.offer.findUnique({ where: { id } });
  if (!offer || offer.providerId !== profile?.id) {
    return NextResponse.json({ error: "Offre introuvable" }, { status: 404 });
  }

  const body = await req.json();

  let nextDuration = offer.durationMinutes;
  if (body.durationMinutes !== undefined) {
    const d = Number(body.durationMinutes);
    if (!ALLOWED_DURATIONS.includes(d)) {
      return NextResponse.json(
        { error: `Durée invalide. Valeurs autorisées : ${ALLOWED_DURATIONS.join(", ")} minutes` },
        { status: 400 }
      );
    }
    nextDuration = d;
  }

  const updated = await prisma.offer.update({
    where: { id },
    data: {
      title: body.title ?? offer.title,
      description: body.description ?? offer.description,
      originalPrice: body.originalPrice ?? offer.originalPrice,
      discountPrice: body.discountPrice ?? offer.discountPrice,
      category: body.category ?? offer.category,
      photos: body.photos ?? offer.photos,
      active: body.active ?? offer.active,
      durationMinutes: nextDuration,
    },
  });

  // If duration changed, regenerate the slot grid
  if (nextDuration !== offer.durationMinutes) {
    await regenerateOfferSlots(id);
  }

  return NextResponse.json(updated);
}

// DELETE: delete offer (owner only)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "PROVIDER") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const profile = await prisma.providerProfile.findUnique({
    where: { userId: session.user.id },
  });

  const offer = await prisma.offer.findUnique({ where: { id } });
  if (!offer || offer.providerId !== profile?.id) {
    return NextResponse.json({ error: "Offre introuvable" }, { status: 404 });
  }

  await prisma.offer.delete({ where: { id } });
  return NextResponse.json({ message: "Offre supprimée" });
}
