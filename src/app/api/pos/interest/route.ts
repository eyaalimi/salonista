/**
 * Liste d'attente des fonctionnalites non activees (Collab, Store, Caisse).
 *
 * GET  -> { features: string[] } : ce que ce salon a deja demande, pour que
 *         le bouton s'affiche dans son etat "deja inscrit" apres rechargement.
 * POST -> { ok: true } : enregistre l'interet. Idempotent grace a la
 *         contrainte unique (providerId, feature) : un double clic ne cree
 *         pas de doublon et renvoie 200 dans les deux cas.
 *
 * Cette route N'ACTIVE RIEN : l'activation reste une decision commerciale,
 * prise depuis l'espace admin.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee, toResponse } from "@/lib/employee-session";

const FEATURES = ["COLLAB", "STORE", "POS"] as const;
type Feature = (typeof FEATURES)[number];

function isFeature(v: unknown): v is Feature {
  return typeof v === "string" && (FEATURES as readonly string[]).includes(v);
}

export async function GET() {
  let employee;
  try {
    employee = await requireEmployee();
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }

  // Cast : le client Prisma local ne connait pas encore FeatureInterest.
  const rows = (await (prisma as never as {
    featureInterest: { findMany: (args: unknown) => Promise<Array<{ feature: string }>> };
  }).featureInterest.findMany({
    where: { providerId: employee.providerId },
    select: { feature: true },
  })) as Array<{ feature: string }>;

  return Response.json({ features: rows.map((r) => r.feature) });
}

export async function POST(req: NextRequest) {
  let employee;
  try {
    employee = await requireEmployee();
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }

  const body = (await req.json().catch(() => null)) as { feature?: unknown } | null;
  if (!body || !isFeature(body.feature)) {
    return Response.json(
      { error: "Fonctionnalité inconnue" },
      { status: 400 },
    );
  }

  await (prisma as never as {
    featureInterest: { upsert: (args: unknown) => Promise<unknown> };
  }).featureInterest.upsert({
    where: {
      providerId_feature: { providerId: employee.providerId, feature: body.feature },
    },
    create: { providerId: employee.providerId, feature: body.feature },
    update: {},
  });

  return Response.json({ ok: true });
}
