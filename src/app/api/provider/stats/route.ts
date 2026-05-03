import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
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

  const [offers, bookings, revenue] = await Promise.all([
    prisma.offer.findMany({
      where: { providerId: profile.id },
      select: { active: true },
    }),
    prisma.booking.findMany({
      where: { items: { some: { offer: { providerId: profile.id } } } },
      select: { status: true },
    }),
    prisma.commission.aggregate({
      where: {
        booking: { items: { some: { offer: { providerId: profile.id } } } },
        status: "PAID",
      },
      _sum: { providerAmount: true },
    }),
  ]);

  return NextResponse.json({
    totalOffers: offers.length,
    activeOffers: offers.filter((o) => o.active).length,
    totalBookings: bookings.length,
    pendingBookings: bookings.filter((b) => b.status === "PENDING").length,
    totalRevenue: Number(revenue._sum.providerAmount ?? 0),
  });
}
