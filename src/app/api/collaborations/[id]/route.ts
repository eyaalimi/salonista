import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

function genToken(size = 12) {
  return randomBytes(size).toString("base64url").slice(0, size);
}

// PATCH: influencer accepts or rejects the collab as a whole
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "INFLUENCER") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const profile = await prisma.influencerProfile.findUnique({
    where: { userId: session.user.id },
  });
  if (!profile) {
    return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
  }

  const collab = await prisma.collaborationRequest.findUnique({
    where: { id },
    include: { offers: true },
  });
  if (!collab || collab.influencerId !== profile.id) {
    return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
  }
  if (collab.status !== "PENDING") {
    return NextResponse.json({ error: "Déjà traitée" }, { status: 400 });
  }

  const { status } = await req.json();
  if (status !== "ACCEPTED" && status !== "REJECTED") {
    return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
  }

  if (status === "REJECTED") {
    const updated = await prisma.collaborationRequest.update({
      where: { id },
      data: { status: "REJECTED", respondedAt: new Date() },
    });
    return NextResponse.json(updated);
  }

  // ACCEPTED: create one tracking link per offer in the collab
  const result = await prisma.$transaction(async (tx) => {
    for (const co of collab.offers) {
      const link = await tx.trackingLink.create({
        data: {
          influencerId: collab.influencerId,
          offerId: co.offerId,
          token: genToken(),
        },
      });
      await tx.collaborationOffer.update({
        where: { id: co.id },
        data: { trackingLinkId: link.id },
      });
    }
    const updated = await tx.collaborationRequest.update({
      where: { id },
      data: { status: "ACCEPTED", respondedAt: new Date() },
      include: {
        offers: {
          include: {
            offer: { select: { id: true, title: true } },
            trackingLink: { select: { token: true } },
          },
        },
      },
    });
    return updated;
  });

  return NextResponse.json(result);
}
