import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: list all influencers (provider only — for collab selection)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "PROVIDER") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const influencers = await prisma.influencerProfile.findMany({
    orderBy: { followersCount: "desc" },
    include: {
      user: { select: { name: true, email: true, avatar: true } },
    },
  });

  return NextResponse.json(influencers);
}
