/**
 * Grille d'un mois pour le mini-calendrier de l'agenda.
 *
 * Le proprietaire qui prend un rendez-vous au telephone devait cliquer « › »
 * autant de fois qu'il y avait de jours a franchir. Une grille mensuelle rend
 * n'importe quelle date atteignable en un clic.
 *
 * Decisions pures, sans React ni `fetch`, pour rester testables sans jsdom
 * (Vitest tourne en environnement node dans ce depot).
 */

/** Lundi en tete : c'est la semaine tunisienne, et francaise. */
export const JOURS_ENTETE = ["L", "M", "M", "J", "V", "S", "D"] as const;

export type CaseMois = {
  date: Date;
  /** Faux pour les jours de debordement des mois voisins. */
  dansLeMois: boolean;
};

/** Minuit local, pour comparer des jours sans se soucier de l'heure. */
export function debutDuJour(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Deux dates tombent-elles le meme jour ? */
export function memeJour(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Position d'un jour dans une semaine commencant le LUNDI.
 *
 * `getDay()` rend 0 pour dimanche : tel quel, il decalerait toute la grille
 * d'un jour.
 */
export function indexLundi(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/**
 * Les 42 cases d'un mois — six semaines pleines.
 *
 * Toujours 42, jamais 35 : un mois de 31 jours commencant un dimanche s'etale
 * sur six semaines. Un nombre fixe evite aussi que la grille change de hauteur
 * d'un mois a l'autre, ce qui ferait sauter le bouton sous la souris.
 */
export function grilleDuMois(annee: number, mois: number): CaseMois[] {
  const premier = new Date(annee, mois, 1);
  const depart = new Date(premier);
  depart.setDate(depart.getDate() - indexLundi(premier));

  const cases: CaseMois[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(depart);
    d.setDate(d.getDate() + i);
    cases.push({ date: d, dansLeMois: d.getMonth() === mois });
  }
  return cases;
}

/** Bornes du mois affiche, debordements compris — la plage a interroger. */
export function plageDeLaGrille(
  annee: number,
  mois: number,
): { debut: Date; fin: Date } {
  const cases = grilleDuMois(annee, mois);
  const debut = debutDuJour(cases[0].date);
  const fin = debutDuJour(cases[cases.length - 1].date);
  fin.setDate(fin.getDate() + 1); // borne haute exclusive
  return { debut, fin };
}

/**
 * Les jours qui portent au moins un rendez-vous, en cles `AAAA-MM-JJ`.
 *
 * Une cle locale, pas un ISO : `toISOString()` bascule en UTC et rangerait un
 * rendez-vous de 00 h 30 la veille — le salon verrait une pastille sur le
 * mauvais jour.
 */
export function cleJour(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const j = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${j}`;
}

export function joursOccupes(datesIso: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const iso of datesIso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) continue;
    out.add(cleJour(d));
  }
  return out;
}

/** Mois precedent ou suivant, sans deborder sur l'annee. */
export function moisDecale(
  annee: number,
  mois: number,
  pas: number,
): { annee: number; mois: number } {
  const d = new Date(annee, mois + pas, 1);
  return { annee: d.getFullYear(), mois: d.getMonth() };
}

/** « août 2026 » — pour l'en-tete du mini-calendrier. */
export function libelleMois(annee: number, mois: number): string {
  return new Date(annee, mois, 1).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
}
