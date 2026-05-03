import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorise" }, { status: 403 });
  }

  const commissions = await prisma.commission.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      booking: {
        select: {
          totalPrice: true,
          status: true,
          client: { select: { name: true, email: true } },
          items: {
            select: {
              offer: {
                select: {
                  title: true,
                  provider: { select: { salonName: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  return NextResponse.json(commissions);
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorise" }, { status: 403 });
  }

  const { id, status } = await request.json();

  if (!["PENDING", "PAID"].includes(status)) {
    return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
  }

  const commission = await prisma.commission.update({
    where: { id },
    data: { status },
  });

  return NextResponse.json(commission);
}
