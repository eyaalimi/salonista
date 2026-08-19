import type { SubscriptionModule } from "@/generated/prisma/enums";

/**
 * Ou envoyer un salon qui ouvre `/pos` ?
 *
 * Retourne `null` si la caisse est accessible (aucune redirection), sinon le
 * chemin de repli. Le calendrier est le quotidien d'un salon qui ne vend pas
 * au comptoir : il y voit ses rendez-vous du jour.
 *
 * Le blocage des pages de caisse NE passe PAS par ce fichier : chaque page
 * porte son propre <ModuleGate>. Une liste centrale de chemins avait ete
 * tentee ici puis retiree — elle donnait une fausse assurance, en affirmant
 * que « /pos/products » etait protege alors que « /pos/products/new » etait
 * grand ouvert. Un garde sur la page elle-meme ne peut pas mentir ainsi.
 */
export function posLandingPath(activeModules: SubscriptionModule[]): string | null {
  return activeModules.includes("POS") ? null : "/pos/calendar";
}
