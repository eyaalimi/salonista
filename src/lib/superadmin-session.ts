/**
 * La porte d'entree de /superadmin — l'adaptateur qui lit la session.
 *
 * La DECISION vit dans `superadmin-acces.ts` (pure, testee sans Prisma). Ce
 * fichier ne fait que fournir les faits : session NextAuth, etat du compte en
 * base, et l'ecriture du journal d'audit.
 *
 * TROIS NIVEAUX DE GARDE, conformement a la demande :
 *   1. `middleware.ts` ecarte les mauvais roles avant meme d'atteindre la page ;
 *   2. `exigerSuperadmin()` est appele dans CHAQUE page et CHAQUE route API ;
 *   3. les ecritures passent par `journaliser()`, qui refuse un motif vide.
 *
 * Le niveau 1 seul ne suffit pas : le `matcher` du middleware est une liste
 * blanche de prefixes, et une route oubliee y echappe silencieusement. C'est
 * exactement le piege deja rencontre dans ce projet — un garde derive de la
 * navigation laisse les sous-routes ouvertes.
 */

import { createHash } from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { prisma } from "./prisma";
import {
  verifierAccesSuperadmin,
  motifRecevable,
  type Verdict,
} from "./superadmin-acces";

/** Le superadmin authentifie, tel que le reste du code le consomme. */
export type Superadmin = {
  id: string;
  email: string;
  name: string | null;
};

export class AccesSuperadminRefuse extends Error {
  constructor(readonly verdict: Extract<Verdict, { ok: false }>) {
    super(`Acces superadmin refuse : ${verdict.raison}`);
    this.name = "AccesSuperadminRefuse";
  }
}

/**
 * Rend le superadmin courant, ou jette `AccesSuperadminRefuse`.
 *
 * A appeler au debut de chaque page et chaque route API de /superadmin —
 * jamais se reposer sur le middleware seul.
 */
export async function exigerSuperadmin(): Promise<Superadmin> {
  const session = await getServerSession(authOptions);

  // On lit l'etat du compte en BASE, pas dans le jeton : un secret TOTP
  // revoque par le script CLI doit fermer l'acces au prochain appel, sans
  // attendre l'expiration du jeton.
  let compte: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    totpConfirmedAt: Date | null;
    totpLockedUntil: Date | null;
  } | null = null;

  if (session?.user?.id) {
    compte = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        totpConfirmedAt: true,
        totpLockedUntil: true,
      },
    });
  }

  const verdict = verifierAccesSuperadmin({
    connecte: !!session?.user && !!compte,
    // Le role vient de la BASE et non du jeton : c'est la source de verite.
    role: compte?.role ?? null,
    totpConfirme: !!compte?.totpConfirmedAt,
    totpValideeA: session?.totpValideeA ?? null,
    verrouJusqua: compte?.totpLockedUntil?.getTime() ?? null,
  });

  if (!verdict.ok) throw new AccesSuperadminRefuse(verdict);

  // `compte` est non nul : `connecte` l'exigeait pour que le verdict passe.
  return { id: compte!.id, email: compte!.email, name: compte!.name };
}

/**
 * Traduit un refus en reponse HTTP, pour les routes API.
 *
 * Renvoie TOUJOURS 403 avec le meme corps, quelle que soit la raison : un
 * appelant non autorise ne doit pas apprendre qu'un espace superadmin existe,
 * ni qu'un compte y est verrouille. Les raisons detaillees ne servent qu'aux
 * PAGES, pour orienter un vrai superadmin vers l'enrolement ou la
 * re-validation.
 */
export function reponseRefus(err: unknown): Response | null {
  if (!(err instanceof AccesSuperadminRefuse)) return null;
  return Response.json({ error: "Non autorisé" }, { status: 403 });
}

/** SHA-256 de l'IP. Jamais l'IP en clair — voir le modele d'audit. */
export function hacherIp(ip: string | null): string | null {
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex");
}

/** Extrait l'IP d'une requete, derriere Nginx. */
export function ipDeRequete(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

export class MotifManquant extends Error {
  constructor() {
    super("Un motif d'au moins 10 caracteres est obligatoire");
    this.name = "MotifManquant";
  }
}

/**
 * Enregistre une action sensible. REFUSE si le motif est creux.
 *
 * Le refus est volontairement une exception et non un silence : une action
 * journalisee sans motif recevable ne doit pas avoir lieu du tout. L'appelant
 * journalise AVANT d'agir, de sorte qu'une action ne puisse jamais s'executer
 * sans sa trace.
 */
export async function journaliser(params: {
  acteur: Superadmin;
  action: string;
  motif: string;
  targetProviderId?: string | null;
  targetUserId?: string | null;
  req?: Request;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!motifRecevable(params.motif)) throw new MotifManquant();

  await prisma.superadminAuditLog.create({
    data: {
      actorId: params.acteur.id,
      actorEmail: params.acteur.email,
      action: params.action,
      motif: params.motif.trim(),
      targetProviderId: params.targetProviderId ?? null,
      targetUserId: params.targetUserId ?? null,
      ipHash: params.req ? hacherIp(ipDeRequete(params.req)) : null,
      userAgent: params.req?.headers.get("user-agent")?.slice(0, 500) ?? null,
      metadata: (params.metadata ?? undefined) as never,
    },
  });
}

export function reponseMotifManquant(err: unknown): Response | null {
  if (!(err instanceof MotifManquant)) return null;
  return Response.json({ error: err.message }, { status: 400 });
}
