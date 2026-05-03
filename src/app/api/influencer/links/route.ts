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

  const links = await prisma.trackingLink.findMany({
    where: { influencerId: profile.id },
    orderBy: { createdAt: "desc" },
    include: {
      offer: {
        select: {
          id: true,
          title: true,
          discountPrice: true,
          originalPrice: true,
          category: true,
          active: true,
          provider: { select: { salonName: true, city: true } },
        },
      },
    },
  });

  const result = links.map((link) => ({
    ...link,
    url: `${process.env.NEXTAUTH_URL}/api/tracking/click?ref=${link.token}&offer=${link.offerId}`,
  }));

  return NextResponse.json(result);
}
