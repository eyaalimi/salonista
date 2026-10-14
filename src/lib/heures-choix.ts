/**
 * La liste des heures proposees par `<ChoixHeure>` — decision pure.
 *
 * Extraite du composant parce que Vitest tourne SANS DOM dans ce projet :
 * c'est le seul moyen de verifier vraiment la liste, son format et le
 * rattrapage d'une valeur hors pas.
 */

/** Pas de la liste, en minutes. 15 couvre les horaires de salon usuels. */
export const PAS_MINUTES = 15;

/** Toutes les heures de la journee, de « 00:00 » a « 23:45 », sur 24 heures. */
export function heuresPossibles(pas: number = PAS_MINUTES): string[] {
  const sortie: string[] = [];
  for (let m = 0; m < 24 * 60; m += pas) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    sortie.push(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
  }
  return sortie;
}

/**
 * Les options a afficher pour une valeur donnee.
 *
 * Une heure enregistree HORS du pas (« 09:20 », saisie avant ce changement
 * ou posee par un script) est ajoutee a la liste : sans cela le `<select>`
 * afficherait du vide et effacerait l'horaire au premier enregistrement.
 */
export function optionsPour(valeur: string, liste: string[] = heuresPossibles()): string[] {
  if (liste.includes(valeur)) return liste;
  return [valeur, ...liste].sort();
}
