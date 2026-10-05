/**
 * Ouvre ou ferme une vue « voir comme le salon », en LECTURE SEULE.
 *
 * POST { motif }  — ouvre la vue pour 15 minutes.
 * DELETE          — la referme tout de suite.
 *
 * La lecture seule n'est PAS garantie par ce fichier : elle l'est dans
 * `requirePermission` (src/lib/employee-session.ts), au point de passage
 * unique de toute la caisse. Ici on ne fait que poser le cookie.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  exigerSuperadmin,
  journaliser,
  reponseRefus,
  reponseMotifManquant,
} from "@/lib/superadmin-session";
import { motifRecevable } from "@/lib/superadmin-acces";
import {
  ACTIONS,
  COOKIE_VUE_LECTURE,
  VUE_LECTURE_MINUTES,
  expirationVueLecture,
} from "@/lib/support-salon";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let moi;
  try {
    moi = await exigerSuperadmin();
  } catch (err) {
    const r = reponseRefus(err);
    if (r) return r;
    throw err;
  }

  const { id } = await params;
  const corps = (await req.json().catch(() => null)) as { motif?: string } | null;
  const motif = corps?.motif ?? "";
  if (!motifRecevable(motif)) {
    return Response.json(
      { error: "Un motif d'au moins 10 caractères est obligatoire" },
      { status: 400 },
    );
  }

  const salon = await prisma.providerProfile.findUnique({
    where: { id },
    select: { id: true, userId: true, salonName: true },
  });
  if (!salon) return Response.json({ error: "Salon introuvable" }, { status: 404 });

  try {
    await journaliser({
      acteur: moi,
      action: ACTIONS.VUE_LECTURE_SEULE,
      motif,
      targetProviderId: salon.id,
      targetUserId: salon.userId,
      req,
      metadata: { dureeMinutes: VUE_LECTURE_MINUTES },
    });
  } catch (err) {
    const r = reponseMotifManquant(err);
    if (r) return r;
    throw err;
  }

  const expire = expirationVueLecture();
  const res = Response.json({
    ok: true,
    expireA: expire.toISOString(),
    message: `Consultation ouverte ${VUE_LECTURE_MINUTES} minutes. Aucune modification ne sera possible.`,
  });
  // Le cookie porte sa propre expiration : la vue se referme d'elle-meme,
  // sans tache de nettoyage.
  res.headers.append(
    "Set-Cookie",
    `${COOKIE_VUE_LECTURE}=${expire.getTime()}; Path=/; Max-Age=${VUE_LECTURE_MINUTES * 60}; HttpOnly; SameSite=Lax${
      process.env.NODE_ENV === "production" ? "; Secure" : ""
    }`,
  );
  return res;
}

export async function DELETE() {
  try {
    await exigerSuperadmin();
  } catch (err) {
    const r = reponseRefus(err);
    if (r) return r;
    throw err;
  }
  const res = Response.json({ ok: true });
  res.headers.append("Set-Cookie", `${COOKIE_VUE_LECTURE}=; Path=/; Max-Age=0; HttpOnly`);
  return res;
}
