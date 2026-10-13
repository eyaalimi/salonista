/**
 * Notes internes de support — l'historique des appels.
 *
 * POST { contenu, resultat?, rappelLe?, blocageLeve? }
 *
 * Pas de motif obligatoire ici, contrairement aux actions : la note EST son
 * propre motif. Exiger les deux ferait saisir deux fois la meme phrase, et
 * la deuxieme serait baclee.
 *
 * Pas de suppression ni de modification : une note de support est une trace
 * d'appel, et un historique qu'on peut reecrire ne vaut rien.
 *
 * LES TROIS CHAMPS DU COMPTE RENDU SONT OPTIONNELS. Une note libre reste une
 * note libre — c'est ce qui permet aux appels de la fiche actuelle de
 * continuer a fonctionner sans rien changer, et aux notes ecrites avant ce
 * lot de rester valides. La validation vit dans `compte-rendu-appel.ts`
 * (pur, 29 tests).
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigerSuperadmin, journaliser, reponseRefus } from "@/lib/superadmin-session";
import { ACTIONS } from "@/lib/support-salon";
import { estErreur, validerCompteRendu } from "@/lib/compte-rendu-appel";

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
  const corps = (await req.json().catch(() => null)) as Record<string, unknown> | null;

  const valide = validerCompteRendu(corps ?? {});
  if (estErreur(valide)) {
    return Response.json({ error: valide.erreur }, { status: 400 });
  }

  const salon = await prisma.providerProfile.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!salon) {
    return Response.json({ error: "Salon introuvable" }, { status: 404 });
  }

  /*
   * Le journal AVANT l'ecriture, comme pour toute action de support : si la
   * journalisation echoue, l'action n'a pas lieu. Un compte rendu d'appel est
   * une consultation doublee d'une ecriture sur un salon — il doit laisser la
   * meme trace que le reste.
   *
   * Le motif reprend le resultat de l'appel plutot qu'une phrase generique :
   * relu six mois plus tard, « Appel : Pas de reponse » dit quelque chose,
   * « note ajoutee » non.
   */
  await journaliser({
    acteur: moi,
    action: ACTIONS.NOTE_AJOUTEE,
    motif: valide.resultat
      ? `Compte rendu d'appel : ${valide.resultat}`
      : "Note de support ajoutée à la fiche",
    targetProviderId: salon.id,
    // `req` fait tracer l'IP (hachee en SHA-256) et l'agent, comme les autres
    // actions de support. Sans lui, un compte rendu serait la seule ecriture
    // du superadmin sans origine dans le journal.
    req,
    metadata: {
      resultat: valide.resultat,
      rappelLe: valide.rappelLe?.toISOString() ?? null,
      blocageLeve: valide.blocageLeve,
    },
  });

  await prisma.supportNote.create({
    data: {
      providerId: salon.id,
      authorId: moi.id,
      // L'e-mail est FIGE en texte : si le compte superadmin disparait, la
      // note doit rester attribuable.
      authorEmail: moi.email,
      contenu: valide.contenu,
      resultat: valide.resultat,
      rappelLe: valide.rappelLe,
      blocageLeve: valide.blocageLeve,
    },
  });

  return Response.json({ ok: true });
}
