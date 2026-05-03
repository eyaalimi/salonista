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
    return NextResponse.json({
      totalLinks: 0, totalClicks: 0, totalConversions: 0,
      conversionRate: "0", totalEarnings: 0, paidEarnings: 0, pendingBalance: 0,
    });
  }

  const links = await prisma.trackingLink.findMany({
    where: { influencerId: profile.id },
    select: { clicksCount: true, conversionsCount: true },
  });

  const totalClicks = links.reduce((sum, l) => sum + l.clicksCount, 0);
  const totalConversions = links.reduce((sum, l) => sum + l.conversionsCount, 0);

  const commissions = await prisma.commission.findMany({
    where: {
      booking: {
        items: {
          some: { offer: { trackingLinks: { some: { influencerId: profile.id } } } },
        },
      },
      influencerAmount: { not: null },
    },
    select: { influencerAmount: true, status: true },
  });

  const totalEarnings = commissions.reduce(
    (sum, c) => sum + Number(c.influencerAmount || 0),
    0
  );
  const paidEarnings = commissions
    .filter((c) => c.status === "PAID")
    .reduce((sum, c) => sum + Number(c.influencerAmount || 0), 0);

  return NextResponse.json({
    totalLinks: links.length,
    totalClicks,
    totalConversions,
    conversionRate: totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(1) : "0",
    totalEarnings,
    paidEarnings,
    pendingBalance: Number(profile.pendingBalance),
  });
}
