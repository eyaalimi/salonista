/**
 * Verification du code d'appairage : autorise cet appareil pour ce salon.
 *
 * Sur succes, pose le cookie `salonista-provider` et rend les tuiles. C'est
 * le seul chemin pour appairer un appareil neuf — un POST sur `/resolve` ne
 * rend plus que le nom du salon.
 */

import { NextRequest } from "next/server";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ipDe, reponseLimite, verifierLimite } from "@/lib/rate-limit";
import { LIMITE_RESOLVE } from "@/lib/rate-limit-decision";
import { refusCode } from "@/lib/device-pairing";
import { cookieAppairage, tuilesDuSalon } from "@/lib/salon-pin-pairing";

export async function POST(req: NextRequest) {
  const limite = await verifierLimite(`appairage:ip:${ipDe(req)}`, LIMITE_RESOLVE);
  if (!limite.ok) return reponseLimite(limite);

  const body = await req.json().catch(() => null);
  const providerId = typeof body?.providerId === "string" ? body.providerId : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";

  if (!providerId || !code) {
    return Response.json({ error: "Code requis" }, { status: 400 });
  }

  const maintenant = new Date();

  // Le plus recent d'abord : redemander un code doit invalider l'attente sur
  // le precedent, sans quoi deux codes vivraient en parallele.
  const entree = await prisma.devicePairingCode.findFirst({
    where: { providerId, usedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, codeHash: true, attempts: true, expiresAt: true, usedAt: true },
  });

  const refus = refusCode(entree, code, maintenant);
  if (refus) {
    return Response.json({ error: refus.message }, { status: 400 });
  }
  // `refusCode` a deja garanti que l'entree existe.
  const vivante = entree!;

  const juste = await compare(code, vivante.codeHash);
  if (!juste) {
    await prisma.devicePairingCode.update({
      where: { id: vivante.id },
      data: { attempts: { increment: 1 } },
    });
    return Response.json({ error: "Code incorrect." }, { status: 400 });
  }

  // Brule le code : un code juste ne sert qu'une fois.
  await prisma.devicePairingCode.update({
    where: { id: vivante.id },
    data: { usedAt: maintenant },
  });

  const provider = await prisma.providerProfile.findUnique({
    where: { id: providerId },
    select: { id: true, salonName: true },
  });
  if (!provider) {
    return Response.json({ error: "Salon introuvable" }, { status: 404 });
  }

  const res = Response.json({
    providerId: provider.id,
    salonName: provider.salonName,
    employees: await tuilesDuSalon(provider.id),
  });
  res.headers.append("Set-Cookie", cookieAppairage(provider.id));
  return res;
}
