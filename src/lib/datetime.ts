/**
 * Formatage des dates et heures pour la Tunisie.
 *
 * Piege : la locale `fr-TN` affiche les heures sur 12 heures. Un creneau de
 * 18h30 s'affichait « 06:30 PM » — un format que personne n'emploie ici, et
 * qui invite a la confusion sur un ecran de reservation.
 *
 *   new Date(...).toLocaleTimeString("fr-TN", { hour: "2-digit", ... })
 *   → "06:30 PM"
 *
 * On garde donc le francais mais on impose explicitement le cycle sur 24
 * heures. Ces fonctions sont le seul endroit ou ce choix est fait : passer
 * par elles evite que la prochaine date ecrite dans le code reintroduise
 * l'anglais par accident.
 */

/** Locale d'affichage. `fr-FR` et `hourCycle` donnent bien « 18:30 ». */
const LOCALE = "fr-FR";

/** 18:30 */
export function formatHeure(date: Date | string): string {
  return new Date(date).toLocaleTimeString(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

/** jeudi 20 août */
export function formatDateLongue(date: Date | string): string {
  return new Date(date).toLocaleDateString(LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** jeu. 20 août, 18:30 */
export function formatDateHeure(date: Date | string): string {
  return new Date(date).toLocaleString(LOCALE, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

/** 20 août 2026 à 18:30 — pour les emails et les recapitulatifs. */
export function formatDateHeureComplete(date: Date | string): string {
  return new Date(date).toLocaleString(LOCALE, {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}
