import { dayKeyFromDate, toMinutes, type OpeningHours } from "@/lib/opening-hours";

/** Un creneau reserve, reduit a ce qui sert au calcul et a l'affichage. */
export type BookedSlot = {
  startTime: Date;
  offerTitle: string;
};

/**
 * Le debut de ce creneau tombe-t-il en dehors des plages d'ouverture ?
 *
 * On teste le DEBUT seulement, pas la duree complete : un rendez-vous qui
 * commence dans les horaires et deborde de dix minutes n'est pas un probleme
 * pour le salon. Un rendez-vous qui commence un jour ferme, si.
 *
 * L'heure de fermeture exacte compte comme un conflit : un service qui
 * commencerait pile a la fermeture ne peut pas etre honore.
 *
 * Pas d'import Prisma ici — le module doit rester chargeable par vitest
 * (cf. src/lib/verify-authz.ts, meme contrainte).
 */
export function isOutsideOpeningHours(startTime: Date, hours: OpeningHours): boolean {
  const ranges = hours[dayKeyFromDate(startTime)] ?? [];
  if (ranges.length === 0) return true;

  const minutes = startTime.getHours() * 60 + startTime.getMinutes();
  return !ranges.some((r) => toMinutes(r.start) <= minutes && minutes < toMinutes(r.end));
}

/**
 * Parmi des creneaux deja reserves, ceux qui tomberaient hors des nouveaux
 * horaires. Tries par date croissante pour l'affichage.
 *
 * Ces rendez-vous ne sont PAS supprimes par la regeneration des creneaux
 * (regenerateOfferSlots epargne tout creneau dont bookedCount > 0) : ils
 * seront honores. Le but est que le salon le sache avant de valider.
 */
export function findConflicts(slots: BookedSlot[], hours: OpeningHours): BookedSlot[] {
  return slots
    .filter((s) => isOutsideOpeningHours(s.startTime, hours))
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}
