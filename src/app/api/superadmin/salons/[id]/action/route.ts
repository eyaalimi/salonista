/**
 * Les actions de support sur un salon.
 *
 * POST { action, motif } — une seule route pour toutes les actions, parce
 * qu'elles partagent exactement le meme preambule : superadmin authentifie,
 * motif recevable, journalisation AVANT d'agir.
 *
 * REGLE CENTRALE : on ne revele JAMAIS un mot de passe ni un PIN existant.
 * Ils sont haches (bcrypt), donc illisibles par construction — y compris
 * pour nous. C'est une protection, pas une limitation a contourner.
 *
 * ORDRE D'EXECUTION : on journalise AVANT d'agir. Si l'ecriture du journal
 * echoue, l'action n'a pas lieu. L'inverse laisserait des interventions sans
 * trace, c'est-a-dire un journal auquel on ne peut pas se fier.
 */

import { NextRequest } from "next/server";
import { randomInt } from "crypto";
import { hash } from "bcryptjs";
import { nanoid } from "nanoid";
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
  expirationLienSupport,
  genererMotDePasseTemporaire,
} from "@/lib/support-salon";
import { sendPasswordResetEmail } from "@/lib/mail";

type Corps = { action?: string; motif?: string };

export async function POST(
  req: NextRequest,
  // En Next 16, `params` est une PROMESSE.
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
  const corps = (await req.json().catch(() => null)) as Corps | null;
  const motif = corps?.motif ?? "";

  if (!motifRecevable(motif)) {
    return Response.json(
      { error: "Un motif d'au moins 10 caractères est obligatoire" },
      { status: 400 },
    );
  }

  const salon = await prisma.providerProfile.findUnique({
    where: { id },
    select: {
      id: true,
      salonName: true,
      userId: true,
      suspendedAt: true,
      user: { select: { id: true, email: true, name: true } },
    },
  });
  if (!salon) {
    return Response.json({ error: "Salon introuvable" }, { status: 404 });
  }

  const commun = {
    acteur: moi,
    motif,
    targetProviderId: salon.id,
    targetUserId: salon.userId,
    req,
  };

  try {
    switch (corps?.action) {
      /* ------------------------------------------------------------------ */
      case "lien-reset": {
        if (!salon.user?.email) {
          return Response.json(
            { error: "Ce compte n'a pas d'adresse e-mail enregistrée." },
            { status: 409 },
          );
        }
        const token = nanoid(32);
        await journaliser({ ...commun, action: ACTIONS.LIEN_RESET });
        await prisma.user.update({
          where: { id: salon.user.id },
          data: {
            passwordResetToken: token,
            // 30 minutes : ce lien est cree PENDANT un appel, le salon clique
            // dans la minute. Plus large laisserait un acces ouvert dans une
            // boite mail longtemps apres.
            passwordResetExpires: expirationLienSupport(),
          },
        });
        // L'envoi est NON BLOQUANT : l'action est deja journalisee et le
        // token pose. Un SMTP lent ne doit pas faire croire a un echec.
        sendPasswordResetEmail(salon.user.email, salon.user.name ?? "", token).catch(
          console.error,
        );
        return Response.json({
          ok: true,
          message: `Lien envoyé à l'adresse enregistrée. Valable 30 minutes.`,
        });
      }

      /* ------------------------------------------------------------------ */
      case "mot-de-passe-temporaire": {
        const temporaire = genererMotDePasseTemporaire();
        await journaliser({ ...commun, action: ACTIONS.MDP_TEMPORAIRE });
        await prisma.user.update({
          where: { id: salon.user!.id },
          data: {
            passwordHash: await hash(temporaire, 12),
            // Le salon DEVRA le changer : un mot de passe dicte au telephone
            // a ete entendu par au moins deux personnes.
            mustChangePassword: true,
            // Les anciens liens de reinitialisation tombent.
            passwordResetToken: null,
            passwordResetExpires: null,
          },
        });
        // AFFICHE UNE SEULE FOIS, et nulle part conserve en clair.
        return Response.json({
          ok: true,
          motDePasseTemporaire: temporaire,
          message:
            "À dicter maintenant. Il ne sera plus jamais affiché. Le salon devra le changer à la connexion.",
        });
      }

      /* ------------------------------------------------------------------ */
      case "reinitialiser-pin": {
        const proprietaire = await prisma.salonEmployee.findFirst({
          where: { providerId: salon.id, role: "OWNER" },
          select: { id: true, displayName: true },
        });
        if (!proprietaire) {
          return Response.json(
            { error: "Aucun propriétaire sur ce salon." },
            { status: 409 },
          );
        }
        // Meme generateur que l'inscription : 4 chiffres, sans suite triviale.
        let pin = "";
        for (let i = 0; i < 20; i++) {
          const n = randomInt(0, 10_000).toString().padStart(4, "0");
          if (/^(\d)\1{3}$/.test(n)) continue;
          if (["1234", "4321", "0123", "9876"].includes(n)) continue;
          pin = n;
          break;
        }
        if (!pin) pin = randomInt(1000, 9999).toString();

        await journaliser({ ...commun, action: ACTIONS.PIN_REINITIALISE });
        await prisma.salonEmployee.update({
          where: { id: proprietaire.id },
          data: {
            pinHash: await hash(pin, 10),
            // Le verrou tombe avec le PIN : garder un compte bloque apres
            // l'avoir reinitialise n'aurait aucun sens.
            pinFailedAttempts: 0,
            pinLockedUntil: null,
          },
        });
        return Response.json({
          ok: true,
          pin,
          message: `Nouveau PIN de ${proprietaire.displayName}. À dicter maintenant, il ne sera plus affiché.`,
        });
      }

      /* ------------------------------------------------------------------ */
      case "debloquer": {
        await journaliser({ ...commun, action: ACTIONS.COMPTE_DEBLOQUE });
        const { count } = await prisma.salonEmployee.updateMany({
          where: { providerId: salon.id },
          data: { pinFailedAttempts: 0, pinLockedUntil: null },
        });
        return Response.json({
          ok: true,
          message: `${count} compte(s) débloqué(s).`,
        });
      }

      /* ------------------------------------------------------------------ */
      case "fermer-sessions": {
        await journaliser({ ...commun, action: ACTIONS.SESSIONS_FERMEES });
        /*
         * Un JWT est SANS ETAT : on ne peut pas le rappeler une fois emis. On
         * date donc la revocation, et le callback `jwt` refuse d'honorer tout
         * jeton anterieur (voir src/lib/auth.ts).
         *
         * L'effet n'est donc pas instantane a la milliseconde : il s'applique
         * au prochain cycle de rafraichissement du jeton. C'est une limite
         * reelle, pas un oubli.
         */
        await prisma.user.update({
          where: { id: salon.user!.id },
          data: { sessionsRevokedAt: new Date() },
        });
        return Response.json({
          ok: true,
          message:
            "Sessions fermées. L'effet s'applique au prochain rafraîchissement du jeton, pas instantanément.",
        });
      }

      /* ------------------------------------------------------------------ */
      case "suspendre": {
        if (salon.suspendedAt) {
          return Response.json({ error: "Déjà suspendu." }, { status: 409 });
        }
        await journaliser({ ...commun, action: ACTIONS.SALON_SUSPENDU });
        await prisma.providerProfile.update({
          where: { id: salon.id },
          // Le motif est copie sur le salon EN PLUS du journal : il doit se
          // lire sur la fiche sans aller fouiller l'historique.
          data: { suspendedAt: new Date(), suspendedReason: motif.trim() },
        });
        return Response.json({
          ok: true,
          message: "Salon suspendu. Il ne peut plus encaisser. Ses données sont conservées.",
        });
      }

      /* ------------------------------------------------------------------ */
      case "reactiver": {
        if (!salon.suspendedAt) {
          return Response.json({ error: "Ce salon n'est pas suspendu." }, { status: 409 });
        }
        await journaliser({ ...commun, action: ACTIONS.SALON_REACTIVE });
        await prisma.providerProfile.update({
          where: { id: salon.id },
          data: { suspendedAt: null, suspendedReason: null },
        });
        return Response.json({ ok: true, message: "Salon réactivé." });
      }

      /* ------------------------------------------------------------------ */
      default:
        return Response.json({ error: "Action inconnue" }, { status: 400 });
    }
  } catch (err) {
    const r = reponseMotifManquant(err);
    if (r) return r;
    console.error("Action de support en echec :", err);
    return Response.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
