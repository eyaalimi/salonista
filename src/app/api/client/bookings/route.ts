import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  }

  const bookings = await prisma.booking.findMany({
    where: { clientId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        include: {
          offer: { include: { provider: { select: { salonName: true, city: true } } } },
          slot: true,
        },
      },
      review: { select: { id: true } },
    },
  });

  return NextResponse.json(
    bookings.map((b) => ({
      ...b,
      hasReview: !!b.review,
      review: undefined,
    }))
  );
}
