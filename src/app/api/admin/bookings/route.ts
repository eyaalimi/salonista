import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorise" }, { status: 403 });
  }

  const bookings = await prisma.booking.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { name: true, email: true } },
      items: {
        include: {
          offer: {
            select: {
              title: true,
              provider: { select: { salonName: true } },
            },
          },
          slot: true,
        },
      },
      commission: {
        select: {
          providerAmount: true,
          influencerAmount: true,
          platformAmount: true,
          status: true,
        },
      },
    },
  });

  return NextResponse.json(bookings);
}
