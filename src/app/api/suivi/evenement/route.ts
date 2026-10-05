/**
 * Enregistrement d'un evenement d'entonnoir depuis le navigateur.
 *
 * POST { type } — pour les etapes que seul le client peut constater : la
 * VISITE de la landing, le DEBUT d'inscription, et l'installation de la PWA
 * (evenement `appinstalled`).
 *
 * POURQUOI UNE ROUTE ET PAS UN COMPTAGE COTE SERVEUR : la landing est une
 * page STATIQUE, prerendue au build. Y ajouter une ecriture la rendrait
 * dynamique a chaque visite — on perdrait le cache sur la page la plus vue du
 * site, pour une statistique.
 *
 * ROUTE PUBLIQUE ET ANONYME. Elle n'accepte qu'une liste FERMEE de types et
 * n'ecrit aucune donnee personnelle : le visiteur n'est qu'un nombre tire au
 * hasard, porte par son cookie.
 */

import { NextRequest } from "next/server";
import { type Etape } from "@/lib/campagne-entonnoir";
import {
  contexteVisiteur,
  enregistrerEvenement,
  enregistrerEvenementUnique,
  nouvelIdVisiteur,
} from "@/lib/campagne-suivi";
import { COOKIE_JOURS, COOKIE_VISITEUR } from "@/lib/campagne-attribution";
import { ipDe, verifierLimite } from "@/lib/rate-limit";
import type { Limite } from "@/lib/rate-limit-decision";

/**
 * Seules ces etapes sont declarables par le navigateur.
 *
 * Les autres (PREMIERE_VENTE, ACTIF_7J...) se DEDUISENT des donnees reelles
 * cote serveur. Les laisser declarer ici permettrait a n'importe qui de
 * fabriquer des statistiques de toutes pieces.
 */
const TYPES_AUTORISES: Etape[] = ["VISITE", "INSCRIPTION_DEBUT", "APP_INSTALLEE"];

/**
 * Limite genereuse : cette route est appelee a chaque visite, et plusieurs
 * personnes partagent souvent une meme IP publique (un salon, un cybercafe).
 * Elle n'arrete que l'inondation manifeste.
 */
const LIMITE_SUIVI: Limite = { max: 60, fenetreMs: 10 * 60 * 1000 };

export async function POST(req: NextRequest) {
  const limite = await verifierLimite(`suivi:ip:${ipDe(req)}`, LIMITE_SUIVI);
  // On repond 204 meme si la limite est atteinte : le navigateur n'a rien a
  // faire de cette information, et un 429 n'apporterait qu'une erreur dans
  // sa console.
  if (!limite.ok) return new Response(null, { status: 204 });

  const body = (await req.json().catch(() => null)) as { type?: string } | null;
  const type = body?.type;
  if (!type || !TYPES_AUTORISES.includes(type as Etape)) {
    return new Response(null, { status: 204 });
  }

  const { visitorId: existant, attribution } = contexteVisiteur(req);
  const visitorId = existant ?? nouvelIdVisiteur();

  // VISITE est enregistree a chaque fois (la deduplication se fait a la
  // lecture, pour distinguer visites et visiteurs) ; les deux autres n'ont
  // de sens qu'une fois par personne.
  if (type === "VISITE") {
    await enregistrerEvenement({
      type: "VISITE",
      visitorId,
      attribution,
      userAgent: req.headers.get("user-agent"),
    });
  } else {
    await enregistrerEvenementUnique({
      type: type as Etape,
      visitorId,
      attribution,
    });
  }

  const reponse = new Response(null, { status: 204 });
  // Un visiteur arrive sans lien de campagne (bouche-a-oreille, recherche)
  // n'a pas encore de cookie : on lui en pose un pour pouvoir le suivre dans
  // l'entonnoir. Il reste anonyme — c'est un nombre au hasard.
  if (!existant) {
    reponse.headers.append(
      "Set-Cookie",
      `${COOKIE_VISITEUR}=${visitorId}; Path=/; Max-Age=${COOKIE_JOURS * 24 * 60 * 60}; HttpOnly; SameSite=Lax${
        process.env.NODE_ENV === "production" ? "; Secure" : ""
      }`,
    );
  }
  return reponse;
}
