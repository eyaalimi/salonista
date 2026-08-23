/**
 * Limite de debit persistee en base.
 *
 * Adaptateur mince autour de `rate-limit-decision.ts`, qui porte la logique
 * et les tests. Ici, seulement la lecture et l'ecriture.
 */

import { prisma } from "@/lib/prisma";
import {
  deciderLimite,
  messageLimite,
  type DecisionLimite,
  type Limite,
} from "@/lib/rate-limit-decision";

/**
 * Incremente le compteur d'une cle et dit si l'appel passe.
 *
 * L'increment est fait par l'`upsert` lui-meme, en une requete atomique :
 * deux appels simultanes ne peuvent pas lire la meme valeur et l'ecraser.
 */
export async function verifierLimite(
  cle: string,
  limite: Limite,
  maintenant: Date = new Date(),
): Promise<DecisionLimite> {
  const entree = await prisma.rateLimitEntry.upsert({
    where: { key: cle },
    create: { key: cle, count: 1, windowStart: maintenant },
    update: { count: { increment: 1 } },
    select: { count: true, windowStart: true },
  });

  const decision = deciderLimite(entree, limite, maintenant);

  if (decision.fenetreAReinitialiser) {
    await prisma.rateLimitEntry.update({
      where: { key: cle },
      data: { count: 1, windowStart: maintenant },
    });
  }

  return decision;
}

/** Reponse 429 prete a renvoyer, message en francais. */
export function reponseLimite(decision: DecisionLimite): Response {
  return Response.json(
    { error: messageLimite(decision.resetDansMs) },
    { status: 429 },
  );
}

/**
 * Supprime les compteurs qui ne servent plus.
 *
 * A appeler depuis une tache planifiee ou une route d'entretien. Volontaire-
 * ment PAS declenche au fil des requetes : un nettoyage opportuniste allonge
 * une requete utilisateur au hasard, et cette table reste petite.
 */
export async function purgerLimites(
  avant: Date = new Date(Date.now() - 24 * 60 * 60 * 1000),
): Promise<number> {
  const { count } = await prisma.rateLimitEntry.deleteMany({
    where: { updatedAt: { lt: avant } },
  });
  return count;
}

/** L'adresse IP de l'appelant, derriere Nginx. */
export function ipDe(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "inconnue"
  );
}
