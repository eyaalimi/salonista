/**
 * Mise en forme francaise — pluriels et dates relatives.
 *
 * POURQUOI CE FICHIER. L'interface affichait « 0 jour(s) », « 20 salon(s) »,
 * « 4 panier(s) abandonne(s) ». La parenthese est une facon d'avouer qu'on
 * n'a pas tranche : elle se lit mal, et « inscrit il y a 0 jour(s) » ne veut
 * rien dire pour quelqu'un qui vient de s'inscrire aujourd'hui.
 *
 * Decisions pures, testables sans DOM.
 */

/**
 * Accorde un nom avec son nombre.
 *
 * `pluriel` n'est fourni que pour les mots irreguliers : par defaut on ajoute
 * un « s ». En francais, 0 reste au SINGULIER (« 0 salon »), contrairement a
 * l'anglais — c'est la regle que la parenthese masquait.
 */
export function accord(n: number, singulier: string, pluriel?: string): string {
  const mot = Math.abs(n) >= 2 ? (pluriel ?? `${singulier}s`) : singulier;
  return `${n} ${mot}`;
}

/**
 * Un nom accorde sans son nombre — pour les cas ou le chiffre est affiche
 * separement, en gros.
 */
export function motAccorde(n: number, singulier: string, pluriel?: string): string {
  return Math.abs(n) >= 2 ? (pluriel ?? `${singulier}s`) : singulier;
}

/**
 * Une date, dite comme on la dirait au telephone.
 *
 * « aujourd'hui », « hier », « il y a 3 jours », puis la date complete au-dela
 * d'un mois — a ce stade, « il y a 47 jours » demande un calcul mental que
 * « 27 août » evite.
 *
 * La comparaison porte sur les JOURS CALENDAIRES, pas sur 24 h : une visite a
 * 23 h hier et une a 1 h ce matin sont bien « hier » et « aujourd'hui »,
 * meme si deux heures seulement les separent.
 */
export function dateRelative(d: Date | null, maintenant: Date = new Date()): string {
  if (!d) return "jamais";

  const jour = (x: Date) => {
    const c = new Date(x);
    c.setHours(0, 0, 0, 0);
    return c.getTime();
  };
  const ecart = Math.round((jour(maintenant) - jour(d)) / 86_400_000);

  if (ecart === 0) return "aujourd'hui";
  if (ecart === 1) return "hier";
  if (ecart === -1) return "demain";
  if (ecart < 0) return `dans ${accord(-ecart, "jour")}`;
  if (ecart <= 30) return `il y a ${accord(ecart, "jour")}`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

/** Une date courte : « 2 oct. ». Pour les jalons du parcours. */
export function dateCourte(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/** Date et heure : « Auj. 10:05 », « 7 oct. 09:12 ». Pour l'activite recente. */
export function dateHeure(d: Date, maintenant: Date = new Date()): string {
  const heure = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const rel = dateRelative(d, maintenant);
  if (rel === "aujourd'hui") return `Auj. ${heure}`;
  if (rel === "hier") return `Hier ${heure}`;
  return `${dateCourte(d)} ${heure}`;
}

/** Nombre de jours ecoules, pour les phrases « bloque ici depuis N ». */
export function depuisJours(d: Date | null, maintenant: Date = new Date()): string {
  if (!d) return "—";
  const jour = (x: Date) => {
    const c = new Date(x);
    c.setHours(0, 0, 0, 0);
    return c.getTime();
  };
  const n = Math.max(0, Math.round((jour(maintenant) - jour(d)) / 86_400_000));
  if (n === 0) return "depuis aujourd'hui";
  if (n === 1) return "depuis hier";
  return `depuis ${accord(n, "jour")}`;
}
