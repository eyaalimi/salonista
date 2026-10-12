/**
 * « Activer Premium : 1 mois / 3 mois / 12 mois » — action rapide de
 * l'administration apres un paiement recu hors de l'application.
 */

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { activerPremium } from "@/lib/plan-premium";
import { DUREES_ACTIVATION_MOIS } from "@/lib/plan";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return Response.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | { providerId?: string; mois?: number; notePaiement?: string }
    | null;
  if (!body?.providerId) {
    return Response.json({ error: "Salon requis." }, { status: 400 });
  }
  if (!DUREES_ACTIVATION_MOIS.includes(body.mois as (typeof DUREES_ACTIVATION_MOIS)[number])) {
    return Response.json({ error: "Durée invalide : 1, 3 ou 12 mois." }, { status: 400 });
  }
  const salon = await prisma.providerProfile.findUnique({
    where: { id: body.providerId },
    select: { id: true },
  });
  if (!salon) return Response.json({ error: "Salon introuvable." }, { status: 404 });

  const { jusquAu } = await activerPremium({
    providerId: body.providerId,
    mois: body.mois!,
    notePaiement: (body.notePaiement ?? "").slice(0, 200),
    adminId: session.user.id,
  });
  return Response.json({ ok: true, jusquAu });
}
