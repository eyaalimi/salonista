/**
 * Confirme l'enrolement : le compte prouve qu'il a bien enregistre le QR.
 *
 * POST { code } — un premier code valide pose `totpConfirmedAt` et rend la
 * 2FA active. C'est le second temps de l'enrolement : /enroll a cree le
 * secret, ici on verifie que le telephone le porte vraiment.
 */

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validerCodeTotp, pasDuCode } from "@/lib/superadmin-totp";
import { ROLE_SUPERADMIN, suiteEchecTotp } from "@/lib/superadmin-acces";
import { verifierLimite, reponseLimite } from "@/lib/rate-limit";
import { LIMITE_TOTP } from "@/lib/rate-limit-decision";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Non autorisé" }, { status: 403 });
  }

  // La limite porte sur le COMPTE et non sur l'IP : un fondateur en
  // deplacement change d'IP, et l'attaque qu'on arrete ici vise un compte
  // precis dont on connaitrait le mot de passe.
  const limite = await verifierLimite(`totp:${session.user.id}`, LIMITE_TOTP);
  if (!limite.ok) return reponseLimite(limite);

  const compte = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      role: true,
      totpSecret: true,
      totpConfirmedAt: true,
      totpFailedAttempts: true,
      totpLockedUntil: true,
    },
  });
  if (!compte || compte.role !== ROLE_SUPERADMIN || !compte.totpSecret) {
    return Response.json({ error: "Non autorisé" }, { status: 403 });
  }
  if (compte.totpConfirmedAt) {
    return Response.json(
      { error: "Double authentification déjà active" },
      { status: 409 },
    );
  }
  if (compte.totpLockedUntil && compte.totpLockedUntil > new Date()) {
    return Response.json(
      { error: "Compte temporairement verrouillé. Réessaie dans quelques minutes." },
      { status: 429 },
    );
  }

  const body = (await req.json().catch(() => null)) as { code?: string } | null;
  const maintenant = new Date();
  const delta = validerCodeTotp(
    compte.totpSecret,
    body?.code ?? "",
    compte.email,
    maintenant,
  );

  if (delta === null) {
    const suite = suiteEchecTotp(compte.totpFailedAttempts, maintenant.getTime());
    await prisma.user.update({
      where: { id: compte.id },
      data: {
        totpFailedAttempts: suite.echecs,
        totpLockedUntil: suite.verrouJusqua,
      },
    });
    return Response.json({ error: "Code incorrect" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: compte.id },
    data: {
      totpConfirmedAt: maintenant,
      // Le pas consomme est enregistre : le MEME code ne pourra pas servir a
      // ouvrir la session juste apres l'enrolement.
      totpLastUsedStep: pasDuCode(delta, maintenant),
      totpFailedAttempts: 0,
      totpLockedUntil: null,
    },
  });

  /*
   * On rend l'horodatage pour que le client appelle `update({ totpValideeA })`
   * et date sa session : sans cela, le fondateur devrait saisir un SECOND
   * code juste apres l'enrolement.
   */
  return Response.json({ ok: true, totpValideeA: maintenant.getTime() });
}
