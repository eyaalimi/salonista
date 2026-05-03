import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: public salon page data
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const provider = await prisma.providerProfile.findUnique({
    where: { id },
    include: {
      offers: {
        where: { active: true },
        orderBy: { createdAt: "desc" },
        include: {
          slots: {
            where: { startTime: { gte: new Date() } },
            orderBy: { startTime: "asc" },
          },
        },
      },
    },
  });

  if (!provider) {
    return NextResponse.json({ error: "Salon introuvable" }, { status: 404 });
  }

  return NextResponse.json(provider);
}
