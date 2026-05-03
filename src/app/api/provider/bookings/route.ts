import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
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

  const limit = Number(req.nextUrl.searchParams.get("limit")) || 50;

  const bookings = await prisma.booking.findMany({
    where: { items: { some: { offer: { providerId: profile.id } } } },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      client: { select: { name: true, email: true } },
      items: {
        include: {
          offer: { select: { title: true, providerId: true } },
          slot: true,
        },
      },
      commission: { select: { providerAmount: true, status: true } },
    },
  });

  return NextResponse.json(bookings);
}
