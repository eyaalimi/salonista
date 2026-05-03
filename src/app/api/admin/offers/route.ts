import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorise" }, { status: 403 });
  }

  const offers = await prisma.offer.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      provider: { select: { salonName: true, city: true } },
      _count: { select: { bookingItems: true, trackingLinks: true } },
    },
  });

  return NextResponse.json(offers);
}
