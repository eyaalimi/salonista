/**
 * Appairage d'un appareil a un salon — la decision, sans la base.
 *
 * `/api/salon-pin/resolve` rendait a un appelant ANONYME la liste complete
 * des employes d'un salon, a partir de son seul email ou telephone. Un
 * inconnu obtenait donc les identifiants a mitrailler, puis n'avait qu'a
 * essayer 10 000 PIN.
 *
 * Deux portes desormais :
 *   - l'appareil porte deja le cookie `salonista-provider` : il a ete
 *     appaire, on lui rend les tuiles ;
 *   - sinon, un code a 6 chiffres part vers la boite du proprietaire. Sans
 *     acces a cette boite, on n'obtient rien.
 *
 * Ce fichier ne contient que des decisions pures — pas de Prisma, pas de
 * bcrypt, pas d'envoi de mail — pour rester testable sans mock.
 */

/** Duree de validite d'un code d'appairage. */
export const CODE_VALIDITE_MS = 15 * 60 * 1000;

/**
 * Essais autorises sur un meme code.
 *
 * Cinq essais sur un code a 6 chiffres laissent une chance sur 200 000 de
 * tomber juste. Au-dela, le code est brule et il faut en redemander un.
 */
export const CODE_ESSAIS_MAX = 5;

/** Format d'un code : exactement six chiffres. */
const FORMAT_CODE = /^\d{6}$/;

export type EtatCode = {
  attempts: number;
  expiresAt: Date;
  usedAt: Date | null;
};

export type RefusCode =
  | { raison: "format"; message: string }
  | { raison: "expire"; message: string }
  | { raison: "deja-utilise"; message: string }
  | { raison: "trop-d-essais"; message: string };

/** Le code saisi a-t-il la bonne forme ? */
export function formatCodeValide(code: string): boolean {
  return FORMAT_CODE.test(code.trim());
}

/**
 * Ce code peut-il encore etre tente ?
 *
 * Ne dit RIEN de sa justesse — cela demande de comparer un hash, ce qui n'est
 * pas le role de ce fichier. On verifie seulement qu'il est vivant.
 */
export function refusCode(
  etat: EtatCode | null,
  saisi: string,
  maintenant: Date,
): RefusCode | null {
  if (!formatCodeValide(saisi)) {
    return { raison: "format", message: "Le code doit contenir 6 chiffres." };
  }
  if (!etat) {
    return {
      raison: "expire",
      message: "Code expiré ou introuvable. Demandez-en un nouveau.",
    };
  }
  if (etat.usedAt !== null) {
    return {
      raison: "deja-utilise",
      message: "Ce code a déjà été utilisé. Demandez-en un nouveau.",
    };
  }
  if (etat.expiresAt <= maintenant) {
    return {
      raison: "expire",
      message: "Code expiré ou introuvable. Demandez-en un nouveau.",
    };
  }
  if (etat.attempts >= CODE_ESSAIS_MAX) {
    return {
      raison: "trop-d-essais",
      message: "Trop d'essais sur ce code. Demandez-en un nouveau.",
    };
  }
  return null;
}

/** Instant d'expiration d'un code cree maintenant. */
export function expirationCode(maintenant: Date): Date {
  return new Date(maintenant.getTime() + CODE_VALIDITE_MS);
}

/**
 * Ce qu'on rend d'un employe pour afficher sa tuile.
 *
 * Strictement le necessaire : un identifiant, un prenom, un role et une
 * couleur. Ni email, ni telephone, ni date de derniere connexion — autant
 * d'informations qui n'ont rien a faire sur un ecran de saisie de PIN.
 */
export type TuileEmploye = {
  id: string;
  displayName: string;
  role: string;
  hasPin: boolean;
  avatarColor: string;
};

/** Les couleurs des pastilles, dans la charte actuelle. */
const COULEURS_TUILES = [
  "#FF5C8A",
  "#3A1024",
  "#A8E6CF",
  "#1F7A5A",
  "#835F71",
  "#4E1832",
];

/** Couleur stable pour un identifiant donne. */
export function couleurTuile(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return COULEURS_TUILES[Math.abs(hash) % COULEURS_TUILES.length];
}
