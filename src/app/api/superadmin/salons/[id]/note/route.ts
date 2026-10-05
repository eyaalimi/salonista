/**
 * Notes internes de support — l'historique des appels.
 *
 * POST { contenu } — ajoute une note a la fiche d'un salon.
 *
 * Pas de motif obligatoire ici, contrairement aux actions : la note EST son
 * propre motif. Exiger les deux ferait saisir deux fois la meme phrase, et
 * la deuxieme serait baclee.
 *
 * Pas de suppression ni de modification : une note de support est une trace
 * d'appel, et un historique qu'on peut reecrire ne vaut rien.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigerSuperadmin, reponseRefus } from "@/lib/superadmin-session";

/** Assez pour un compte rendu d'appel, pas assez pour y coller un roman. */
const CONTENU_MAX = 2000;
const CONTENU_MIN = 3;

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
  const corps = (await req.json().catch(() => null)) as { contenu?: string } | null;
  const contenu = (corps?.contenu ?? "").trim().slice(0, CONTENU_MAX);

  if (contenu.length < CONTENU_MIN) {
    return Response.json({ error: "Note trop courte" }, { status: 400 });
  }

  const salon = await prisma.providerProfile.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!salon) {
    return Response.json({ error: "Salon introuvable" }, { status: 404 });
  }

  await prisma.supportNote.create({
    data: {
      providerId: salon.id,
      authorId: moi.id,
      // L'e-mail est FIGE en texte : si le compte superadmin disparait, la
      // note doit rester attribuable.
      authorEmail: moi.email,
      contenu,
    },
  });

  return Response.json({ ok: true });
}
