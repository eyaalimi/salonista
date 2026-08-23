/**
 * Verrouillage du PIN apres echecs repetes — la decision, sans la base.
 *
 * Trois faiblesses se combinaient pour rendre la caisse forcable :
 *   - le PIN fait 4 chiffres, soit 10 000 possibilites ;
 *   - `/api/salon-pin/resolve` livrait a un inconnu la liste des employes du
 *     salon, donc les identifiants a mitrailler ;
 *   - rien ne comptait les echecs cote fournisseur NextAuth `salon-pin`, qui
 *     valide reellement le PIN. La limite de debit existante portait sur
 *     `/resolve`, pas sur la validation.
 *
 * Un script pouvait donc essayer les 10 000 combinaisons sans etre inquiete.
 *
 * Ce fichier ne contient que des decisions pures — pas de Prisma, pas de
 * bcrypt — pour rester testable sans mock, conformement a la convention du
 * depot. L'adaptateur qui lit et ecrit en base est `verify-employee-pin.ts`.
 */

/** Echecs consecutifs avant verrouillage. */
export const PIN_ECHECS_MAX = 5;

/**
 * Duree du verrouillage.
 *
 * Cinq minutes : assez pour rendre une attaque par force brute inutilisable
 * (10 000 combinaisons demanderaient des annees a ce rythme), assez court
 * pour qu'une caissiere qui s'est trompee ne reste pas plantee devant sa
 * cliente. Une duree croissante serait plus sure mais bloquerait un salon
 * entier sur une simple mauvaise journee.
 */
export const PIN_VERROU_MS = 5 * 60 * 1000;

/** Inactivite avant que la caisse ne se reverrouille d'elle-meme. */
export const POS_INACTIVITE_MS = 4 * 60 * 1000;

/** Etat du compteur d'echecs, tel qu'il est stocke sur l'employe. */
export type EtatPin = {
  pinFailedAttempts: number;
  pinLockedUntil: Date | null;
};

/** Ce que la base doit ecrire apres une tentative. */
export type EcritureVerrou = {
  pinFailedAttempts: number;
  pinLockedUntil: Date | null;
};

/**
 * Le compte est-il verrouille a cet instant ?
 *
 * Un verrou expire est traite comme absent : inutile de nettoyer la colonne,
 * la comparaison suffit.
 */
export function estVerrouille(etat: EtatPin, maintenant: Date): boolean {
  return etat.pinLockedUntil !== null && etat.pinLockedUntil > maintenant;
}

/** Secondes restantes avant deverrouillage, arrondies au superieur. */
export function secondesRestantes(etat: EtatPin, maintenant: Date): number {
  if (!estVerrouille(etat, maintenant)) return 0;
  const ms = etat.pinLockedUntil!.getTime() - maintenant.getTime();
  return Math.ceil(ms / 1000);
}

/**
 * Message affiche a une caissiere devant un compte verrouille.
 *
 * On annonce le delai : « reessayez plus tard » laisse taper indefiniment,
 * alors qu'une minute annoncee fait patienter.
 */
export function messageVerrou(secondes: number): string {
  const minutes = Math.ceil(secondes / 60);
  if (minutes <= 1) {
    return "Trop d'essais. Réessayez dans une minute.";
  }
  return `Trop d'essais. Réessayez dans ${minutes} minutes.`;
}

/**
 * Que devient le compteur apres un ECHEC ?
 *
 * Au seuil, on pose le verrou et on remet le compteur a zero : il repart
 * proprement apres expiration, sans reverrouiller au premier faux pas
 * suivant.
 */
export function apresEchec(etat: EtatPin, maintenant: Date): EcritureVerrou {
  const compte = etat.pinFailedAttempts + 1;
  if (compte >= PIN_ECHECS_MAX) {
    return {
      pinFailedAttempts: 0,
      pinLockedUntil: new Date(maintenant.getTime() + PIN_VERROU_MS),
    };
  }
  return { pinFailedAttempts: compte, pinLockedUntil: null };
}

/** Que devient le compteur apres un SUCCES ? Tout repart de zero. */
export function apresSucces(): EcritureVerrou {
  return { pinFailedAttempts: 0, pinLockedUntil: null };
}

/** Essais restants avant verrouillage, pour prevenir avant qu'il ne tombe. */
export function essaisRestants(etat: EtatPin): number {
  return Math.max(0, PIN_ECHECS_MAX - etat.pinFailedAttempts);
}
