import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SubscriptionStatus } from "@/generated/prisma/enums";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return null;
  }
  return session;
}

type UpdateBody = {
  status?: SubscriptionStatus;
  expiresAt?: string | null;
  pricingSnapshot?: { monthlyPrice?: number; currency?: string } | null;
  notes?: string | null;
};

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return Response.json({ error: "Accès refusé" }, { status: 403 });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as UpdateBody | null;
  if (!body) return Response.json({ error: "Corps requis" }, { status: 400 });

  const data: Record<string, unknown> = { activatedByUserId: session.user.id };
  if (body.status !== undefined) data.status = body.status;
  if (body.expiresAt !== undefined) {
    if (body.expiresAt === null || body.expiresAt === "") {
      data.expiresAt = null;
    } else {
      const parsed = new Date(body.expiresAt);
      if (Number.isNaN(parsed.getTime())) {
        return Response.json({ error: "Date d'expiration invalide" }, { status: 400 });
      }
      data.expiresAt = parsed;
    }
  }
  if (body.pricingSnapshot !== undefined) {
    data.pricingSnapshot = body.pricingSnapshot ?? null;
  }
  if (body.notes !== undefined) data.notes = body.notes;

  const updated = await prisma.salonSubscription.update({ where: { id }, data });
  return Response.json(updated);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return Response.json({ error: "Accès refusé" }, { status: 403 });

  const { id } = await ctx.params;
  const updated = await prisma.salonSubscription.update({
    where: { id },
    data: { status: "SUSPENDED", activatedByUserId: session.user.id },
  });
  return Response.json(updated);
}
