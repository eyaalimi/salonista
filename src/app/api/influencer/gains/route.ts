import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "INFLUENCER") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const profile = await prisma.influencerProfile.findUnique({
    where: { userId: session.user.id },
  });

  if (!profile) {
    return NextResponse.json([]);
  }

  // Get all commissions attributed to this influencer's tracking links
  const commissions = await prisma.commission.findMany({
    where: {
      influencerAmount: { not: null },
      booking: {
        items: {
          some: {
            offer: { trackingLinks: { some: { influencerId: profile.id } } },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    include: {
      booking: {
        select: {
          createdAt: true,
          status: true,
          items: {
            select: {
              offer: {
                select: {
                  title: true,
                  provider: { select: { salonName: true } },
                },
              },
              slot: { select: { startTime: true } },
            },
          },
        },
      },
    },
  });

  return NextResponse.json(commissions);
}
