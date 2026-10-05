/**
 * Les agregats du tableau de bord — decisions pures, sans base.
 *
 * Contient la DEFINITION de « salon actif », qui commande plusieurs chiffres
 * du tableau. Isolee ici expres : la changer est une decision de produit, pas
 * une retouche de requete eparpillee dans des pages.
 */

/**
 * QU'EST-CE QU'UN SALON ACTIF ?
 *
 * Une VENTE enregistree, OU une connexion d'employe, sur la periode.
 *
 * Pourquoi les deux : un salon qui ouvre sa caisse tous les matins pour
 * consulter son agenda est vivant, meme s'il n'a encaisse aucune vente ce
 * jour-la (une journee creuse, un rendez-vous annule). Ne compter que les
 * ventes ferait passer pour perdus des salons parfaitement installes.
 *
 * Pourquoi pas l'inverse non plus : ne compter que les connexions
 * surestimerait l'adoption — ouvrir l'application n'est pas s'en servir.
 *
 * SI TU CHANGES CETTE REGLE, change-la ICI : tout le tableau de bord en
 * depend, ainsi que les etapes ACTIF_7J et ACTIF_30J de l'entonnoir.
 */
export type SignesDeVie = {
  derniereVenteAt: Date | null;
  derniereConnexionAt: Date | null;
};

export function estActif(
  signes: SignesDeVie,
  depuis: Date,
  jusqua: Date = new Date(),
): boolean {
  const dans = (d: Date | null) => d !== null && d >= depuis && d <= jusqua;
  return dans(signes.derniereVenteAt) || dans(signes.derniereConnexionAt);
}

/** Dernier signe de vie, quel qu'il soit. `null` si le salon n'a jamais rien fait. */
export function dernierSigneDeVie(signes: SignesDeVie): Date | null {
  const d = [signes.derniereVenteAt, signes.derniereConnexionAt].filter(
    (x): x is Date => x !== null,
  );
  if (d.length === 0) return null;
  return new Date(Math.max(...d.map((x) => x.getTime())));
}

/** Jours ecoules depuis le dernier signe de vie. `null` si aucun. */
export function joursDInactivite(
  signes: SignesDeVie,
  maintenant: Date = new Date(),
): number | null {
  const dernier = dernierSigneDeVie(signes);
  if (!dernier) return null;
  return Math.floor((maintenant.getTime() - dernier.getTime()) / 86_400_000);
}

/** Etat d'un salon, pour la colonne « statut » de la liste. */
export type StatutSalon =
  | "jamais-vendu"
  | "actif"
  | "inactif";

export function statutSalon(
  signes: SignesDeVie,
  maintenant: Date = new Date(),
  seuilInactifJours = 14,
): StatutSalon {
  // « Jamais vendu » prime : un salon inscrit qui ouvre son agenda sans
  // jamais encaisser n'est pas installe, et c'est exactement celui qu'il
  // faut rappeler. Le ranger parmi les actifs le rendrait invisible.
  if (signes.derniereVenteAt === null) return "jamais-vendu";

  const jours = joursDInactivite(signes, maintenant);
  if (jours === null) return "jamais-vendu";
  return jours <= seuilInactifJours ? "actif" : "inactif";
}

export const LIBELLE_STATUT: Record<StatutSalon, string> = {
  "jamais-vendu": "Jamais vendu",
  actif: "Actif",
  inactif: "Inactif",
};

/**
 * Les jours (UTC) couverts par une periode, bornes incluses.
 *
 * Extrait ici pour etre testable : la version precedente, enfouie dans la
 * requete, OUBLIAIT LE JOUR COURANT. `depuis` etant a minuit heure locale
 * (22h UTC la veille en Tunisie), la boucle s'arretait la veille et les clics
 * du jour n'apparaissaient sur aucune barre de la courbe.
 */
export function joursDeLaPeriode(depuis: Date, jusqua: Date): string[] {
  const jour = (d: Date) => d.toISOString().slice(0, 10);
  const curseur = new Date(
    Date.UTC(depuis.getUTCFullYear(), depuis.getUTCMonth(), depuis.getUTCDate()),
  );
  const fin = jour(jusqua);
  const sortie: string[] = [];
  // Comparaison sur la CHAINE du jour, pas sur l'instant : le dernier jour
  // doit etre inclus meme s'il n'est pas termine.
  while (jour(curseur) <= fin) {
    sortie.push(jour(curseur));
    curseur.setUTCDate(curseur.getUTCDate() + 1);
  }
  return sortie;
}

/**
 * Serialise une valeur pour un fichier CSV.
 *
 * Les champs viennent de saisies libres (nom du salon, nom de campagne) : ils
 * peuvent contenir des points-virgules, des guillemets et des retours a la
 * ligne. On entoure donc TOUT de guillemets et on double ceux de l'interieur.
 *
 * Et surtout : une valeur commencant par `=`, `+`, `-` ou `@` est prefixee
 * d'une apostrophe. Sans cela, Excel l'interprete comme une FORMULE — un nom
 * de salon commencant par `=` deviendrait du code execute a l'ouverture du
 * fichier.
 */
export function champCsv(valeur: unknown): string {
  if (valeur === null || valeur === undefined) return '""';
  let s = String(valeur);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** Assemble un CSV complet. Le separateur `;` est celui qu'attend Excel en francais. */
export function construireCsv(entetes: string[], lignes: unknown[][]): string {
  const tete = entetes.map(champCsv).join(";");
  const corps = lignes.map((l) => l.map(champCsv).join(";"));
  // BOM UTF-8 : sans lui, Excel affiche « Hôtel » au lieu de « Hôtel ».
  return "﻿" + [tete, ...corps].join("\r\n");
}
