import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/reviews?offerId=xxx — get reviews for an offer
export async function GET(req: NextRequest) {
  const offerId = req.nextUrl.searchParams.get("offerId");
  if (!offerId) {
    return NextResponse.json({ error: "offerId requis" }, { status: 400 });
  }

  const reviews = await prisma.review.findMany({
    where: { offerId },
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { name: true } },
    },
  });

  const avg =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

  return NextResponse.json({ reviews, average: Math.round(avg * 10) / 10, count: reviews.length });
}

// POST /api/reviews — create a review
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { bookingId, rating, comment } = await req.json();

  if (!bookingId || !rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }

  // Check booking belongs to user and is COMPLETED
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { review: true, items: { select: { offerId: true } } },
  });

  if (!booking || booking.clientId !== session.user.id) {
    return NextResponse.json({ error: "Réservation introuvable" }, { status: 404 });
  }

  if (booking.status !== "COMPLETED") {
    return NextResponse.json({ error: "La réservation doit être terminée pour laisser un avis" }, { status: 400 });
  }

  if (booking.review) {
    return NextResponse.json({ error: "Vous avez déjà laissé un avis pour cette réservation" }, { status: 409 });
  }

  if (booking.items.length === 0) {
    return NextResponse.json({ error: "Réservation vide" }, { status: 400 });
  }

  const review = await prisma.review.create({
    data: {
      rating: Math.round(rating),
      comment: comment?.trim() || null,
      clientId: session.user.id,
      offerId: booking.items[0].offerId,
      bookingId,
    },
  });

  return NextResponse.json(review, { status: 201 });
}
