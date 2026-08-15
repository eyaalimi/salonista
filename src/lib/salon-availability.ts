/**
 * Prochaine disponibilite d'un salon, pour le badge menthe du feed.
 *
 * Pas d'import Prisma ici — le module doit rester chargeable par vitest
 * (cf. src/lib/verify-authz.ts, meme contrainte).
 */

/** Creneau reduit a ce qui sert au calcul. */
export type SlotLike = {
  startTime: Date;
  capacity: number;
  bookedCount: number;
};

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/**
 * Le prochain creneau reellement reservable, ou null.
 *
 * « Reservable » veut dire : dans le futur ET avec de la capacite restante.
 * Un creneau complet n'interesse personne, et un creneau passe non plus.
 */
export function pickNextSlot(slots: SlotLike[], now: Date): Date | null {
  const futurs = slots
    .filter((s) => s.startTime.getTime() > now.getTime())
    .filter((s) => s.bookedCount < s.capacity)
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  return futurs.length > 0 ? futurs[0].startTime : null;
}

/** Meme jour calendaire ? (pas « moins de 24 h ») */
function memeJour(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Libelle du badge : « Libre 14:00 », « Libre demain 9:00 »,
 * « Libre mardi 11:30 ».
 *
 * On compare des jours calendaires, pas des ecarts en heures : un creneau a
 * 23h et un autre a 1h du matin sont a deux heures d'intervalle mais pas le
 * meme jour, et « demain » est ce que la cliente comprend.
 */
export function formatAvailability(slot: Date | null, now: Date): string | null {
  if (!slot) return null;

  const heure = `${slot.getHours()}:${String(slot.getMinutes()).padStart(2, "0")}`;

  if (memeJour(slot, now)) return `Libre ${heure}`;

  const demain = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (memeJour(slot, demain)) return `Libre demain ${heure}`;

  return `Libre ${JOURS[slot.getDay()]} ${heure}`;
}
