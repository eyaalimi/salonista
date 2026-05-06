import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SubscriptionModule, SubscriptionStatus } from "@/generated/prisma/enums";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return null;
  }
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return Response.json({ error: "Accès refusé" }, { status: 403 });

  const providers = await prisma.providerProfile.findMany({
    orderBy: { salonName: "asc" },
    select: {
      id: true,
      salonName: true,
      city: true,
      verified: true,
      user: { select: { email: true, name: true } },
      subscriptions: {
        select: {
          id: true,
          module: true,
          status: true,
          activatedAt: true,
          expiresAt: true,
          activatedByUserId: true,
          pricingSnapshot: true,
          notes: true,
          updatedAt: true,
        },
      },
    },
  });

  const adminIds = Array.from(
    new Set(
      providers.flatMap((p) =>
        p.subscriptions.map((s) => s.activatedByUserId).filter(Boolean) as string[],
      ),
    ),
  );
  const admins = adminIds.length
    ? await prisma.user.findMany({
        where: { id: { in: adminIds } },
        select: { id: true, name: true, email: true },
      })
    : [];

  return Response.json({ providers, admins });
}

type UpsertBody = {
  providerId?: string;
  module?: SubscriptionModule;
  status?: SubscriptionStatus;
  expiresAt?: string | null;
  pricingSnapshot?: { monthlyPrice?: number; currency?: string } | null;
  notes?: string | null;
};

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return Response.json({ error: "Accès refusé" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as UpsertBody | null;
  if (!body?.providerId || !body.module || !body.status) {
    return Response.json({ error: "Champs requis manquants" }, { status: 400 });
  }

  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  if (body.expiresAt && Number.isNaN(expiresAt!.getTime())) {
    return Response.json({ error: "Date d'expiration invalide" }, { status: 400 });
  }

  const sub = await prisma.salonSubscription.upsert({
    where: {
      providerId_module: { providerId: body.providerId, module: body.module },
    },
    create: {
      providerId: body.providerId,
      module: body.module,
      status: body.status,
      expiresAt,
      pricingSnapshot: body.pricingSnapshot ?? undefined,
      notes: body.notes ?? null,
      activatedByUserId: session.user.id,
    },
    update: {
      status: body.status,
      expiresAt,
      pricingSnapshot: body.pricingSnapshot ?? undefined,
      notes: body.notes ?? null,
      activatedByUserId: session.user.id,
    },
  });

  return Response.json(sub);
}
