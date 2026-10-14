/**
 * Pourquoi aucun creneau n'est proposé ? — decision pure, sans base.
 *
 * LE PROBLEME QU'ELLE REGLE. Un salon qui vient de s'inscrire par
 * /pos-start n'a PAS d'horaires : l'assistant ne les demande pas. Or les
 * creneaux sont generes a partir des horaires. La caissiere voyait donc
 * « Aucun creneau disponible ce jour — choisissez un autre jour » et
 * essayait tous les jours du calendrier, sans succes : il n'y en aurait eu
 * aucun, jamais, quel que soit le jour.
 *
 * Le message envoyait chercher la ou il n'y avait rien. Distinguer les deux
 * causes est tout l'enjeu : « journee complete » invite a changer de jour,
 * « pas d'horaires » invite a aller les remplir.
 */

export type RaisonAbsence = "horaires-absents" | "jour-complet";

/**
 * Les horaires du salon sont-ils renseignes ?
 *
 * MEME REGLE que `horairesRenseignes` dans onboarding-salon.ts : un objet
 * non vide. Repetee ici plutot qu'importee parce que ce module recoit la
 * valeur BRUTE renvoyee par l'API (du JSON), la ou l'autre travaille sur un
 * profil deja charge. Les deux repondent a la meme question et doivent
 * rester d'accord — si vous changez l'une, changez l'autre.
 */
export function horairesRenseignes(openingHours: unknown): boolean {
  if (!openingHours || typeof openingHours !== "object") return false;
  if (Array.isArray(openingHours)) return false;
  return Object.keys(openingHours as Record<string, unknown>).length > 0;
}

/**
 * La raison pour laquelle la liste de creneaux est vide.
 *
 * `null` quand il y a des creneaux : il n'y a rien a expliquer.
 */
export function raisonAbsenceCreneaux(args: {
  nombreCreneaux: number;
  openingHours: unknown;
}): RaisonAbsence | null {
  if (args.nombreCreneaux > 0) return null;
  return horairesRenseignes(args.openingHours) ? "jour-complet" : "horaires-absents";
}

/** Le message a afficher, et s'il faut proposer d'aller remplir les horaires. */
export type MessageAbsence = {
  titre: string;
  detail: string;
  /** Un lien vers les horaires n'a de sens que s'ils manquent. */
  lienHoraires: boolean;
};

/**
 * Ce qu'on dit a la caissiere.
 *
 * Le texte des horaires est VOLONTAIREMENT directif : c'est une consigne, pas
 * un constat. « Aucun creneau » decrit un symptome ; « remplissez d'abord vos
 * horaires d'ouverture » dit quoi faire.
 */
export function messageAbsence(raison: RaisonAbsence): MessageAbsence {
  if (raison === "horaires-absents") {
    return {
      titre: "Veuillez d'abord remplir vos horaires d'ouverture",
      detail:
        "Sans horaires, aucun créneau n'existe — aucun jour ne fonctionnera. Cela prend une minute.",
      lienHoraires: true,
    };
  }
  return {
    titre: "Aucun créneau libre ce jour",
    detail:
      "Les horaires sont bien renseignés : cette journée est complète, ou la combinaison de services ne tient pas. Choisissez un autre jour ou modifiez les services.",
    lienHoraires: false,
  };
}
