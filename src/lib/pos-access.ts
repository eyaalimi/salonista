import type { SubscriptionModule } from "@/generated/prisma/enums";

/**
 * Les sections reservees au module caisse.
 *
 * `/pos` lui-meme en fait partie : la racine de la PWA n'est pas un tableau
 * de bord, c'est l'ecran d'encaissement.
 *
 * Volontairement absentes : calendar, customers, services, settings (metier),
 * loyalty (module REWARDS, distinct), analytics (lit aussi les reservations
 * en ligne), collab et store (argumentaires commerciaux montres a tous).
 */
const CASH_SECTIONS = [
  "/pos/cash-drawer",
  "/pos/sales",
  "/pos/products",
  "/pos/employees",
  "/pos/commissions",
  "/pos/sync-issues",
] as const;

/**
 * Ou envoyer un salon qui ouvre `/pos` ?
 *
 * Retourne `null` si la caisse est accessible (aucune redirection), sinon le
 * chemin de repli. Le calendrier est le quotidien d'un salon qui ne vend pas
 * au comptoir : il y voit ses rendez-vous du jour.
 */
export function posLandingPath(activeModules: SubscriptionModule[]): string | null {
  return activeModules.includes("POS") ? null : "/pos/calendar";
}

/** Ce chemin releve-t-il du module caisse ? */
export function isCashSection(pathname: string): boolean {
  if (pathname === "/pos") return true;
  return CASH_SECTIONS.some(
    (s) => pathname === s || pathname.startsWith(s + "/"),
  );
}
