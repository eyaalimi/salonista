/**
 * Enregistrement des evenements d'acquisition — l'adaptateur.
 *
 * Les decisions vivent dans `campagne-entonnoir.ts` et
 * `campagne-attribution.ts`. Ici on lit les cookies et on ecrit en base.
 */

import { randomBytes } from "crypto";
import { prisma } from "./prisma";
import { estRobot, type Etape } from "./campagne-entonnoir";
import {
  COOKIE_ATTRIBUTION,
  COOKIE_VISITEUR,
  VISITEUR_OCTETS,
  lireAttribution,
  type Attribution,
} from "./campagne-attribution";

/** Un identifiant de visiteur : de l'aleatoire pur, rien d'autre. */
export function nouvelIdVisiteur(): string {
  return randomBytes(VISITEUR_OCTETS).toString("hex");
}

/**
 * Enregistre un evenement, en silence si quoi que ce soit echoue.
 *
 * LA MESURE NE DOIT JAMAIS CASSER LE PRODUIT. Si la base est indisponible ou
 * si la table manque, l'inscription d'un salon doit se poursuivre : perdre
 * une statistique est sans gravite, perdre un client ne l'est pas. D'ou le
 * `catch` qui avale tout.
 */
export async function enregistrerEvenement(params: {
  type: Etape;
  visitorId?: string | null;
  providerId?: string | null;
  attribution?: Attribution | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    // Les robots ne sont pas des prospects. On les ecarte AVANT l'ecriture :
    // les compter fausserait tous les taux de conversion vers le bas.
    if (params.userAgent !== undefined && estRobot(params.userAgent)) return;

    const a = params.attribution;
    await prisma.campaignEvent.create({
      data: {
        type: params.type,
        visitorId: params.visitorId ?? null,
        providerId: params.providerId ?? null,
        campaignId: a?.campaignId ?? null,
        utmSource: a?.utmSource ?? null,
        utmMedium: a?.utmMedium ?? null,
        utmCampaign: a?.utmCampaign ?? null,
        metadata: (params.metadata ?? undefined) as never,
      },
    });
  } catch {
    // Volontairement muet. Voir le commentaire ci-dessus.
  }
}

/**
 * Enregistre un evenement UNE SEULE FOIS par acteur.
 *
 * Pour les etapes qui n'ont de sens qu'une fois : on n'active pas sa caisse
 * deux fois, on n'installe pas l'application deux fois. Sans ce garde-fou,
 * un rechargement de page gonflerait les chiffres.
 *
 * Les CLICS, eux, passent par `enregistrerEvenement` : on veut les compter
 * tous, et la deduplication se fait a la LECTURE (`compterUniques`). C'est ce
 * qui permet de distinguer « 100 clics » de « 60 personnes ».
 */
export async function enregistrerEvenementUnique(params: {
  type: Etape;
  visitorId?: string | null;
  providerId?: string | null;
  attribution?: Attribution | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const cle = params.providerId
      ? { providerId: params.providerId, type: params.type }
      : { visitorId: params.visitorId, type: params.type };
    if (!params.providerId && !params.visitorId) return;

    const deja = await prisma.campaignEvent.findFirst({
      where: cle,
      select: { id: true },
    });
    if (deja) return;

    await enregistrerEvenement(params);
  } catch {
    // Muet, meme raison.
  }
}

/** Lit l'identifiant de visiteur et l'attribution portes par une requete. */
export function contexteVisiteur(req: Request): {
  visitorId: string | null;
  attribution: Attribution;
} {
  const brut = req.headers.get("cookie") ?? "";
  const cookies = Object.fromEntries(
    brut
      .split(";")
      .map((c) => c.trim().split("="))
      .filter((p) => p.length === 2)
      .map(([k, v]) => [k, decodeURIComponent(v)]),
  );

  return {
    visitorId: cookies[COOKIE_VISITEUR] ?? null,
    attribution: lireAttribution(cookies[COOKIE_ATTRIBUTION] ?? null),
  };
}
