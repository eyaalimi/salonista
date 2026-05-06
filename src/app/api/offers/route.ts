import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { regenerateOfferSlots } from "@/lib/slots";

const ALLOWED_DURATIONS = [15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240];

// GET: list offers (for provider: their own, for others: all active)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");

  if (session?.user?.role === "PROVIDER") {
    let profile = await prisma.providerProfile.findUnique({
      where: { userId: session.user.id },
    });
    if (!profile) {
      // Auto-create profile for existing providers without one
      profile = await prisma.providerProfile.create({
        data: { userId: session.user.id, salonName: session.user.name || "Mon Salon", category: "AUTRE" },
      });
    }
    const offers = await prisma.offer.findMany({
      where: { providerId: profile.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { bookingItems: true, trackingLinks: true, slots: true } },
      },
    });
    return NextResponse.json(offers);
  }

  // Public: active offers
  const where: Record<string, unknown> = { active: true };
  if (category) where.category = category;

  const offers = await prisma.offer.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      provider: { select: { salonName: true, city: true, category: true } },
    },
  });
  return NextResponse.json(offers);
}

// POST: create offer (provider only)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "PROVIDER") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  let profile = await prisma.providerProfile.findUnique({
    where: { userId: session.user.id },
  });
  if (!profile) {
    profile = await prisma.providerProfile.create({
      data: { userId: session.user.id, salonName: session.user.name || "Mon Salon", category: "AUTRE" },
    });
  }

  const body = await req.json();
  const { title, description, originalPrice, discountPrice, category, photos, durationMinutes, taxRate } = body;

  if (!title || !originalPrice || !discountPrice || !category) {
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
  }

  const duration = Number(durationMinutes);
  if (!ALLOWED_DURATIONS.includes(duration)) {
    return NextResponse.json(
      { error: `Durée invalide. Valeurs autorisées : ${ALLOWED_DURATIONS.join(", ")} minutes` },
      { status: 400 }
    );
  }

  const tax = taxRate === undefined ? 19 : Number(taxRate);
  if (Number.isNaN(tax) || tax < 0 || tax > 100) {
    return NextResponse.json({ error: "Taux de TVA invalide (0–100)" }, { status: 400 });
  }

  const offer = await prisma.offer.create({
    data: {
      providerId: profile.id,
      title,
      description: description || null,
      originalPrice,
      discountPrice,
      category,
      photos: photos || [],
      durationMinutes: duration,
      taxRate: tax,
    },
  });

  // Auto-generate slots based on opening hours and duration
  await regenerateOfferSlots(offer.id);

  return NextResponse.json(offer, { status: 201 });
}
