import { NextRequest, NextResponse } from "next/server";
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

  return NextResponse.json(profile);
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "INFLUENCER") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { instagramHandle, followersCount, bio, category } = await req.json();

  const profile = await prisma.influencerProfile.upsert({
    where: { userId: session.user.id },
    update: { instagramHandle, followersCount, bio, category },
    create: {
      userId: session.user.id,
      instagramHandle: instagramHandle || "",
      followersCount: followersCount || 0,
      bio,
      category,
    },
  });

  return NextResponse.json(profile);
}
