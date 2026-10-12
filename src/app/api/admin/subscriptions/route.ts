import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SubscriptionModule, SubscriptionStatus } from "@/generated/prisma/enums";
import { calculerPlan } from "@/lib/plan";
import { getPlan } from "@/lib/plan-serveur";
import { apresEcriturePremium, etatAvantEcriturePremium } from "@/lib/plan-premium";

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

  // Date de la premiere vente de chaque salon : l'essai Premium en part.
  const premieresVentes = await prisma.sale.groupBy({
    by: ["providerId"],
    where: { status: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] } },
    _min: { closedAt: true },
  });
  const premiereVenteParSalon = new Map(
    premieresVentes.map((v) => [v.providerId, v._min.closedAt]),
  );
  const maintenant = new Date();
  const providersAvecPlan = await Promise.all(
    providers.map(async (p) => {
      const premium = p.subscriptions.find((s) => s.module === "PREMIUM") ?? null;
      const premiereVenteAt = premiereVenteParSalon.get(p.id) ?? null;
      return {
        ...p,
        premiereVenteAt,
        // Sans ligne PREMIUM, getPlan la pose (essai a partir de maintenant
        // pour un salon d'avant le lancement) : l'admin ne doit pas voir
        // « gratuit » un salon qui n'a jamais eu son essai.
        plan: premium
          ? calculerPlan({ premium, premiereVenteAt, maintenant })
          : await getPlan(p.id, maintenant),
      };
    }),
  );

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

  return Response.json({ providers: providersAvecPlan, admins });
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

  const avant =
    body.module === "PREMIUM" ? await etatAvantEcriturePremium(body.providerId) : null;

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

  // Une activation a la main du Premium a les memes effets que l'action
  // rapide : employees en pause reactivees, temps de pause rendu aux points.
  if (avant) await apresEcriturePremium(body.providerId, avant);

  return Response.json(sub);
}
