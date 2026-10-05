/**
 * Lien court d'une campagne : /c/<slug>
 *
 * Compte le clic, pose l'attribution, puis redirige vers la landing avec les
 * parametres UTM.
 *
 * ROUTE PUBLIQUE, hors du middleware : elle est imprimee sur des flyers et
 * dictee au telephone. Le `matcher` du middleware ne couvre que les espaces
 * authentifies — `/c/...` n'y figure pas, et ne doit pas y figurer.
 *
 * ANONYMAT : le visiteur recoit un identifiant tire au hasard (128 bits). On
 * n'enregistre NI son IP, meme hachee, NI empreinte de navigateur. C'est
 * exactement ce qu'annonce /confidentialite.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicOrigin } from "@/lib/public-origin";
import {
  COOKIE_ATTRIBUTION,
  COOKIE_JOURS,
  COOKIE_VISITEUR,
  fusionnerAttribution,
  lireAttribution,
  serialiserAttribution,
  slugValide,
  urlDestination,
  type Attribution,
} from "@/lib/campagne-attribution";
import { enregistrerEvenement, nouvelIdVisiteur } from "@/lib/campagne-suivi";

export async function GET(
  req: NextRequest,
  // En Next 16, `params` est une PROMESSE.
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  // L'origine vient de NEXTAUTH_URL, JAMAIS des en-tetes : Nginx ne les
  // reecrit pas, et quelqu'un pourrait faire rediriger nos liens de campagne
  // vers son propre site (note 16 de CLAUDE.md).
  const origine = publicOrigin();

  // Un slug invalide ne doit pas reveler qu'il est invalide : on renvoie
  // simplement a l'accueil, comme pour une campagne terminee.
  if (!slugValide(slug)) {
    return NextResponse.redirect(new URL("/", origine));
  }

  const campagne = await prisma.campaign
    .findUnique({
      where: { slug },
      select: { id: true, slug: true, utmSource: true, utmMedium: true },
    })
    .catch(() => null);

  // Campagne inconnue : on redirige quand meme vers la landing. Un flyer
  // imprime survit a la campagne qu'il annonce — l'envoyer sur une page
  // d'erreur serait perdre un prospect pour une raison purement interne.
  if (!campagne) {
    return NextResponse.redirect(new URL("/", origine));
  }

  const destination = urlDestination(origine, campagne);
  const reponse = NextResponse.redirect(destination);

  // Identifiant du visiteur : on reutilise le sien s'il en a deja un, sinon
  // on en tire un neuf. C'est ce qui permet de distinguer « 100 clics » de
  // « 60 personnes ».
  const visiteurExistant = req.cookies.get(COOKIE_VISITEUR)?.value ?? null;
  const visitorId = visiteurExistant ?? nouvelIdVisiteur();

  const nouvelle: Attribution = {
    campaignId: campagne.id,
    utmSource: campagne.utmSource,
    utmMedium: campagne.utmMedium,
    utmCampaign: campagne.slug,
  };
  // PREMIERE TOUCHE GAGNE : si ce visiteur porte deja une attribution, elle
  // est conservee. Voir fusionnerAttribution.
  const attribution = fusionnerAttribution(
    lireAttribution(req.cookies.get(COOKIE_ATTRIBUTION)?.value),
    nouvelle,
  );

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: COOKIE_JOURS * 24 * 60 * 60,
    path: "/",
  };
  reponse.cookies.set(COOKIE_VISITEUR, visitorId, options);
  reponse.cookies.set(COOKIE_ATTRIBUTION, serialiserAttribution(attribution), options);

  // Non bloquant : la redirection part meme si l'ecriture rame ou echoue.
  // Perdre une statistique est sans gravite, perdre un prospect ne l'est pas.
  await enregistrerEvenement({
    type: "CLIC",
    visitorId,
    // L'attribution ENREGISTREE est celle de ce clic-ci, pas la fusionnee :
    // on veut savoir quelle campagne a genere CE clic, meme si le visiteur
    // reste attribue a une campagne anterieure.
    attribution: nouvelle,
    userAgent: req.headers.get("user-agent"),
  });

  return reponse;
}
