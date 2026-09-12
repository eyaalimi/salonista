/**
 * Resolution d'un salon pour l'ecran de saisie du PIN.
 *
 * AVANT : un POST anonyme portant l'email ou le telephone d'un salon rendait
 * la liste COMPLETE de ses employes — identifiants, prenoms, roles. Combine a
 * un PIN de 4 chiffres et a l'absence de verrouillage, cela donnait a un
 * inconnu tout ce qu'il fallait pour forcer une caisse.
 *
 * MAINTENANT, deux portes :
 *   - POST : ne rend QUE le nom du salon et declenche l'envoi d'un code a 6
 *     chiffres vers la boite du proprietaire. Aucune liste d'employes.
 *   - POST /verify : le code saisi appaire l'appareil et pose le cookie.
 *   - GET : rend les tuiles, mais seulement a un appareil DEJA appaire.
 *
 * Le cookie `salonista-provider` existait deja pour se souvenir du salon ;
 * il devient la preuve d'appairage.
 */

import { NextRequest } from "next/server";
import { randomInt } from "crypto";
import { hash } from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tryNormalizePhone } from "@/lib/phone";
import { sendDevicePairingCodeEmail } from "@/lib/mail";
import { ipDe, reponseLimite, verifierLimite } from "@/lib/rate-limit";
import { LIMITE_APPAIRAGE, LIMITE_RESOLVE } from "@/lib/rate-limit-decision";
import { expirationCode } from "@/lib/device-pairing";
import {
  REMEMBER_COOKIE,
  cookieEfface,
  tuilesDuSalon,
} from "@/lib/salon-pin-pairing";

/** Trouve le salon depuis un email ou un telephone. */
async function salonDepuis(identifiant: string) {
  if (identifiant.includes("@")) {
    const user = await prisma.user.findUnique({
      where: { email: identifiant.toLowerCase() },
      include: { providerProfile: true },
    });
    return user?.providerProfile ?? null;
  }
  const phone = tryNormalizePhone(identifiant);
  if (!phone) return null;
  const user = await prisma.user.findFirst({
    where: { phone, role: "PROVIDER" },
    include: { providerProfile: true },
  });
  return user?.providerProfile ?? null;
}

export async function POST(req: NextRequest) {
  const limite = await verifierLimite(`resolve:ip:${ipDe(req)}`, LIMITE_RESOLVE);
  if (!limite.ok) return reponseLimite(limite);

  const body = await req.json().catch(() => null);
  const identifiant =
    typeof body?.identifier === "string" ? body.identifier.trim() : "";
  if (!identifiant) {
    return Response.json({ error: "Identifiant requis" }, { status: 400 });
  }

  const provider = await salonDepuis(identifiant);
  if (!provider) {
    return Response.json({ error: "Salon introuvable" }, { status: 404 });
  }

  // Un appareil deja appaire a ce salon n'a pas a redemander un code.
  if (req.cookies.get(REMEMBER_COOKIE)?.value === provider.id) {
    return Response.json({
      providerId: provider.id,
      salonName: provider.salonName,
      appairage: "deja-appaire",
      employees: await tuilesDuSalon(provider.id),
    });
  }

  // Limite par salon : sans elle, on pourrait inonder la boite du
  // proprietaire, et epuiser le quota SMTP au passage.
  const limiteMail = await verifierLimite(
    `appairage:${provider.id}`,
    LIMITE_APPAIRAGE,
  );
  if (!limiteMail.ok) return reponseLimite(limiteMail);

  const proprietaire = await prisma.user.findUnique({
    where: { id: provider.userId },
    select: { email: true },
  });
  if (!proprietaire?.email) {
    return Response.json(
      { error: "Ce salon n'a pas d'adresse email. Contactez-nous." },
      { status: 409 },
    );
  }

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  await prisma.devicePairingCode.create({
    data: {
      providerId: provider.id,
      // Hache : une fuite de la base ne doit pas livrer de codes utilisables.
      codeHash: await hash(code, 10),
      expiresAt: expirationCode(new Date()),
    },
  });

  // Non bloquant : l'ecran doit passer a la saisie du code meme si le SMTP
  // rame. Un echec d'envoi se traduira par un code jamais recu, et le salon
  // en redemandera un.
  sendDevicePairingCodeEmail(proprietaire.email, {
    salonName: provider.salonName,
    code,
  }).catch(console.error);

  // On ne rend NI la liste des employes, NI l'email complet du proprietaire.
  return Response.json({
    providerId: provider.id,
    salonName: provider.salonName,
    appairage: "code-envoye",
    indiceEmail: masquerEmail(proprietaire.email),
  });
}

/** `a****@gmail.com` — assez pour reconnaitre sa boite, pas pour la deviner. */
function masquerEmail(email: string): string {
  const [locale, domaine] = email.split("@");
  if (!domaine) return "***";
  const tete = locale.slice(0, 1);
  return `${tete}${"*".repeat(Math.max(3, locale.length - 1))}@${domaine}`;
}

export async function GET(req: NextRequest) {
  /*
   * UNE SESSION VAUT L'APPAIRAGE. Le cookie prouve qu'un appareil a recu le
   * code envoye au proprietaire ; une session authentifiee prouve davantage,
   * puisqu'elle a demande l'email ET le mot de passe. Exiger les deux n'ajoute
   * aucune securite, et le cookie expire au bout de 30 jours : passe ce delai,
   * un proprietaire connecte qui cliquait sur « basculer vers un autre
   * membre » devait resaisir l'email de son propre salon.
   *
   * La porte anonyme reste fermee : sans session ET sans cookie, on retombe
   * sur le 404 qui renvoie vers l'envoi d'un code.
   */
  const session = await getServerSession(authOptions);
  let providerId: string | null = null;
  if (session?.user) {
    /*
     * `session.employee` d'abord : une session ouverte par PIN porte
     * directement son `providerId`. On ne peut PAS deduire le salon de
     * `user.id` dans ce cas — un employe sans compte a un identifiant de la
     * forme `pin:<id>`, qui ne correspond a aucun `ProviderProfile.userId`.
     */
    if (session.employee) {
      providerId = session.employee.providerId;
    } else if (session.user.role === "PROVIDER") {
      const sien = await prisma.providerProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });
      providerId = sien?.id ?? null;
    }
  }

  const cookie = req.cookies.get(REMEMBER_COOKIE)?.value;
  providerId = providerId ?? cookie ?? null;

  if (!providerId) {
    return Response.json({ error: "Aucun salon mémorisé" }, { status: 404 });
  }
  const provider = await prisma.providerProfile.findUnique({
    where: { id: providerId },
    select: { id: true, salonName: true },
  });
  if (!provider) {
    const res = Response.json({ error: "Salon introuvable" }, { status: 404 });
    res.headers.append("Set-Cookie", cookieEfface());
    return res;
  }
  return Response.json({
    providerId: provider.id,
    salonName: provider.salonName,
    employees: await tuilesDuSalon(provider.id),
  });
}

export async function DELETE() {
  const res = Response.json({ ok: true });
  res.headers.append("Set-Cookie", cookieEfface());
  return res;
}
