import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorise" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { role, verifiedInfluencer, verifiedProvider } = body;

  if (role && !["CLIENT", "PROVIDER", "INFLUENCER", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Role invalide" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id },
    data: { ...(role && { role }) },
    select: { id: true, name: true, email: true, role: true },
  });

  if (typeof verifiedInfluencer === "boolean") {
    await prisma.influencerProfile.update({
      where: { userId: id },
      data: { verified: verifiedInfluencer },
    });
  }

  if (typeof verifiedProvider === "boolean") {
    await prisma.providerProfile.update({
      where: { userId: id },
      data: { verified: verifiedProvider },
    });
  }

  return NextResponse.json(user);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorise" }, { status: 403 });
  }

  const { id } = await params;

  if (id === session.user.id) {
    return NextResponse.json({ error: "Impossible de supprimer votre propre compte" }, { status: 400 });
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
