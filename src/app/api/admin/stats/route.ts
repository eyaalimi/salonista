import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorise" }, { status: 403 });
  }

  const [
    totalUsers,
    totalProviders,
    totalInfluencers,
    totalClients,
    totalOffers,
    activeOffers,
    totalBookings,
    pendingBookings,
    completedBookings,
    commissions,
    recentUsers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "PROVIDER" } }),
    prisma.user.count({ where: { role: "INFLUENCER" } }),
    prisma.user.count({ where: { role: "CLIENT" } }),
    prisma.offer.count(),
    prisma.offer.count({ where: { active: true } }),
    prisma.booking.count(),
    prisma.booking.count({ where: { status: "PENDING" } }),
    prisma.booking.count({ where: { status: "COMPLETED" } }),
    prisma.commission.aggregate({
      _sum: {
        platformAmount: true,
        providerAmount: true,
        influencerAmount: true,
      },
    }),
    prisma.user.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  const platformRevenue = Number(commissions._sum.platformAmount || 0);
  const totalRevenue = Number(commissions._sum.platformAmount || 0)
    + Number(commissions._sum.providerAmount || 0)
    + Number(commissions._sum.influencerAmount || 0);

  return NextResponse.json({
    totalUsers,
    totalProviders,
    totalInfluencers,
    totalClients,
    totalOffers,
    activeOffers,
    totalBookings,
    pendingBookings,
    completedBookings,
    platformRevenue,
    totalRevenue,
    recentUsers,
  });
}
