import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: list collab requests for current user (provider or influencer)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  if (session.user.role === "PROVIDER") {
    const profile = await prisma.providerProfile.findUnique({
      where: { userId: session.user.id },
    });
    if (!profile) return NextResponse.json([]);
    const list = await prisma.collaborationRequest.findMany({
      where: { providerId: profile.id },
      orderBy: { createdAt: "desc" },
      include: {
        influencer: {
          include: { user: { select: { name: true, email: true } } },
        },
        offers: {
          include: {
            offer: { select: { id: true, title: true, discountPrice: true } },
            trackingLink: { select: { token: true, clicksCount: true, conversionsCount: true } },
          },
        },
      },
    });
    return NextResponse.json(list);
  }

  if (session.user.role === "INFLUENCER") {
    const profile = await prisma.influencerProfile.findUnique({
      where: { userId: session.user.id },
    });
    if (!profile) return NextResponse.json([]);
    const list = await prisma.collaborationRequest.findMany({
      where: { influencerId: profile.id },
      orderBy: { createdAt: "desc" },
      include: {
        provider: { select: { id: true, salonName: true, city: true } },
        offers: {
          include: {
            offer: {
              select: {
                id: true,
                title: true,
                discountPrice: true,
                photos: true,
                durationMinutes: true,
              },
            },
            trackingLink: { select: { token: true, clicksCount: true, conversionsCount: true } },
          },
        },
      },
    });
    return NextResponse.json(list);
  }

  return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
}

// POST: provider creates a collab request with multiple offers
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "PROVIDER") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const profile = await prisma.providerProfile.findUnique({
    where: { userId: session.user.id },
  });
  if (!profile) {
    return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
  }

  const { influencerId, offerIds, commissionPct, durationDays, message } = await req.json();

  if (!influencerId || !Array.isArray(offerIds) || offerIds.length === 0) {
    return NextResponse.json(
      { error: "Influenceuse et au moins une offre requises" },
      { status: 400 }
    );
  }
  if (commissionPct == null || isNaN(Number(commissionPct))) {
    return NextResponse.json({ error: "Commission requise" }, { status: 400 });
  }
  const pct = Number(commissionPct);
  if (pct < 0 || pct > 100) {
    return NextResponse.json({ error: "Commission entre 0 et 100" }, { status: 400 });
  }
  if (!durationDays || isNaN(Number(durationDays)) || Number(durationDays) < 1) {
    return NextResponse.json({ error: "Durée invalide" }, { status: 400 });
  }

  // Validate that all offers belong to this provider
  const offers = await prisma.offer.findMany({
    where: { id: { in: offerIds }, providerId: profile.id },
  });
  if (offers.length !== offerIds.length) {
    return NextResponse.json(
      { error: "Une ou plusieurs offres ne vous appartiennent pas ou n'existent pas" },
      { status: 400 }
    );
  }

  const influencer = await prisma.influencerProfile.findUnique({ where: { id: influencerId } });
  if (!influencer) {
    return NextResponse.json({ error: "Influenceuse introuvable" }, { status: 404 });
  }

  const collab = await prisma.collaborationRequest.create({
    data: {
      providerId: profile.id,
      influencerId,
      commissionPct: pct,
      durationDays: Number(durationDays),
      message: message || null,
      offers: {
        create: offerIds.map((offerId: string) => ({ offerId })),
      },
    },
    include: { offers: true },
  });

  return NextResponse.json(collab, { status: 201 });
}
