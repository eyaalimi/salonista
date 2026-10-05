/**
 * Validation d'un code TOTP pour ouvrir (ou rouvrir) l'acces superadmin.
 *
 * POST { code } — appelee a la connexion, et toutes les 30 minutes quand la
 * fraicheur expire (voir FRAICHEUR_TOTP_MS).
 *
 * TROIS PROTECTIONS, dans cet ordre :
 *   1. limite de debit par compte, persistee en base ;
 *   2. verrouillage apres 5 echecs, verifie AVANT tout calcul de code ;
 *   3. refus du rejeu : un code consomme ne vaut plus, meme dans ses 30 s.
 */

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validerCodeTotp, pasDuCode, estRejeu } from "@/lib/superadmin-totp";
import { ROLE_SUPERADMIN, suiteEchecTotp } from "@/lib/superadmin-acces";
import { verifierLimite, reponseLimite } from "@/lib/rate-limit";
import { LIMITE_TOTP } from "@/lib/rate-limit-decision";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Non autorisé" }, { status: 403 });
  }

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
      totpLastUsedStep: true,
      totpFailedAttempts: true,
      totpLockedUntil: true,
    },
  });

  // Un seul message pour tous les refus d'identite : ne jamais laisser
  // deviner qu'un compte est superadmin, ni qu'il a une 2FA en cours.
  if (
    !compte ||
    compte.role !== ROLE_SUPERADMIN ||
    !compte.totpSecret ||
    !compte.totpConfirmedAt
  ) {
    return Response.json({ error: "Non autorisé" }, { status: 403 });
  }

  // Le verrou est teste AVANT le calcul du code : inutile d'offrir du temps
  // de calcul a qui est deja bloque (meme raisonnement que le PIN de caisse,
  // ou le verrou precede bcrypt.compare).
  const maintenant = new Date();
  if (compte.totpLockedUntil && compte.totpLockedUntil > maintenant) {
    const resteMin = Math.ceil(
      (compte.totpLockedUntil.getTime() - maintenant.getTime()) / 60_000,
    );
    return Response.json(
      { error: `Compte verrouillé. Réessaie dans ${resteMin} minute(s).` },
      { status: 429 },
    );
  }

  const body = (await req.json().catch(() => null)) as { code?: string } | null;
  const delta = validerCodeTotp(
    compte.totpSecret,
    body?.code ?? "",
    compte.email,
    maintenant,
  );

  const pas = delta === null ? null : pasDuCode(delta, maintenant);
  const rejeu = pas !== null && estRejeu(pas, compte.totpLastUsedStep);

  if (delta === null || rejeu) {
    const suite = suiteEchecTotp(compte.totpFailedAttempts, maintenant.getTime());
    await prisma.user.update({
      where: { id: compte.id },
      data: {
        totpFailedAttempts: suite.echecs,
        totpLockedUntil: suite.verrouJusqua,
      },
    });
    // Le rejeu renvoie le MEME message qu'un code faux : distinguer les deux
    // apprendrait a un attaquant que son code etait bon mais deja utilise.
    return Response.json({ error: "Code incorrect" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: compte.id },
    data: {
      totpLastUsedStep: pas,
      totpFailedAttempts: 0,
      totpLockedUntil: null,
    },
  });

  // Le client appelle ensuite `update({ totpValideeA })` pour datar le jeton.
  return Response.json({ ok: true, totpValideeA: maintenant.getTime() });
}
