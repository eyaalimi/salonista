/**
 * Qui entre dans /superadmin — la decision, sans la base ni NextAuth.
 *
 * Isole ici pour etre testable sans mock Prisma, comme `pin-lockout.ts` et
 * `rate-limit-decision.ts`. L'adaptateur qui lit la session vit dans
 * `superadmin-session.ts`.
 *
 * TROIS REGLES QUI NE SE NEGOCIENT PAS :
 *
 * 1. SUPERADMIN n'est PAS un ADMIN superieur. Les deux roles sont disjoints :
 *    un ADMIN est refuse dans /superadmin, et un SUPERADMIN n'herite d'aucun
 *    droit sur /admin. Rendre le role hierarchique ferait de chaque compte
 *    admin existant un acces fondateur — exactement ce qu'on veut eviter.
 *
 * 2. Le mot de passe seul ne suffit jamais. Sans TOTP validee, l'acces est
 *    refuse, meme avec le bon role.
 *
 * 3. La validation TOTP PERIME. NextAuth n'a pas de `maxAge` configure dans
 *    ce projet, donc les sessions durent 30 jours par defaut ; raccourcir
 *    `session.maxAge` raccourcirait celle de TOUS les utilisateurs, salons
 *    compris. On porte donc une fraicheur dediee dans le jeton.
 */

/** Role attendu. Ecrit en litteral : ce fichier ne depend pas du client Prisma. */
export const ROLE_SUPERADMIN = "SUPERADMIN";

/**
 * Duree de validite d'une validation TOTP, en millisecondes.
 *
 * 30 minutes : assez pour mener une intervention de support (lire une fiche,
 * envoyer un lien, noter l'appel) sans redemander le code toutes les cinq
 * minutes, assez court pour qu'un poste laisse ouvert ne reste pas une porte
 * d'entree. Au-dela, on ne deconnecte PAS — on redemande seulement le code,
 * ce qui evite de perdre le contexte de l'intervention en cours.
 */
export const FRAICHEUR_TOTP_MS = 30 * 60 * 1000;

/** Echecs TOTP consecutifs avant verrouillage. */
export const TOTP_ECHECS_MAX = 5;

/**
 * Duree du verrouillage TOTP.
 *
 * 15 minutes, soit trois fois le verrou du PIN de caisse (5 min) : un
 * superadmin bloque n'a pas de cliente qui attend devant lui, et le compte
 * protege est bien plus sensible.
 */
export const TOTP_VERROU_MS = 15 * 60 * 1000;

/** Ce que l'appelant sait de la session, reduit au strict necessaire. */
export type EtatSession = {
  /** Y a-t-il une session du tout ? */
  connecte: boolean;
  /** Role porte par le jeton. */
  role?: string | null;
  /** Le compte a-t-il un secret TOTP confirme en base ? */
  totpConfirme: boolean;
  /**
   * Horodatage (ms) de la derniere validation TOTP, porte par le jeton.
   * `null` = jamais validee dans cette session.
   */
  totpValideeA?: number | null;
  /** Fin du verrouillage (ms), si le compte est verrouille. */
  verrouJusqua?: number | null;
};

/** Pourquoi l'acces est refuse — l'appelant choisit quoi en faire. */
export type Verdict =
  | { ok: true }
  | { ok: false; raison: "non-connecte" }
  | { ok: false; raison: "mauvais-role" }
  | { ok: false; raison: "totp-a-enroler" }
  | { ok: false; raison: "totp-a-valider" }
  | { ok: false; raison: "totp-perimee" }
  | { ok: false; raison: "verrouille"; resteMs: number };

/**
 * Decide si une session peut acceder a /superadmin.
 *
 * L'ordre des tests est deliberé : on ne revele jamais a un non-superadmin
 * qu'un compte est verrouille ou qu'il lui manque une 2FA. Le role est donc
 * tranche AVANT tout le reste.
 */
export function verifierAccesSuperadmin(
  etat: EtatSession,
  maintenant: number = Date.now(),
): Verdict {
  if (!etat.connecte) return { ok: false, raison: "non-connecte" };

  // Avant tout : un ADMIN, un PROVIDER ou une cliente sont des « mauvais
  // role » indistinguables. Aucun message ne doit laisser deviner qu'un
  // espace superadmin existe, ni qu'un compte donne en fait partie.
  if (etat.role !== ROLE_SUPERADMIN) return { ok: false, raison: "mauvais-role" };

  if (etat.verrouJusqua && etat.verrouJusqua > maintenant) {
    return { ok: false, raison: "verrouille", resteMs: etat.verrouJusqua - maintenant };
  }

  // Le role est bon mais le compte n'a pas encore de 2FA : il doit l'enroler
  // avant d'acceder a quoi que ce soit. Le script CLI cree le compte sans
  // secret, l'enrolement se fait au premier acces.
  if (!etat.totpConfirme) return { ok: false, raison: "totp-a-enroler" };

  if (!etat.totpValideeA) return { ok: false, raison: "totp-a-valider" };

  if (maintenant - etat.totpValideeA > FRAICHEUR_TOTP_MS) {
    return { ok: false, raison: "totp-perimee" };
  }

  return { ok: true };
}

/**
 * Un motif d'intervention est-il recevable ?
 *
 * Le motif est OBLIGATOIRE sur toute action sensible : c'est ce qui rend le
 * journal relisible six mois plus tard. Une chaine vide, des espaces ou un
 * « ok » ne disent rien de ce qui s'est passe — on exige donc une longueur
 * minimale reelle.
 */
export const MOTIF_MIN = 10;

export function motifRecevable(motif: unknown): motif is string {
  return typeof motif === "string" && motif.trim().length >= MOTIF_MIN;
}

/**
 * Decide de l'etat du compteur d'echecs TOTP apres une tentative.
 *
 * Meme forme que `pin-lockout.ts` : une fonction pure, l'ecriture en base est
 * faite par l'appelant.
 */
export function suiteEchecTotp(
  echecsAvant: number,
  maintenant: number = Date.now(),
): { echecs: number; verrouJusqua: Date | null } {
  const echecs = echecsAvant + 1;
  if (echecs >= TOTP_ECHECS_MAX) {
    return { echecs: 0, verrouJusqua: new Date(maintenant + TOTP_VERROU_MS) };
  }
  return { echecs, verrouJusqua: null };
}
