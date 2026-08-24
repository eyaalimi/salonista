/**
 * Limite de debit : la decision, sans la base.
 *
 * L'ancien compteur vivait dans une `Map` en memoire. Or PM2 recharge le
 * processus a chaque deploiement : les compteurs repartaient de zero, et il
 * suffisait d'attendre une mise en production pour effacer ses traces. Le
 * compteur est desormais persiste (`RateLimitEntry`).
 *
 * Ce fichier ne contient que le calcul de fenetre glissante — testable sans
 * Prisma. L'adaptateur qui lit et ecrit est `rate-limit.ts`.
 */

/** Reglages d'une dimension limitee. */
export type Limite = {
  /** Nombre d'appels autorises dans la fenetre. */
  max: number;
  /** Duree de la fenetre, en millisecondes. */
  fenetreMs: number;
};

/**
 * Tentatives de PIN par employe.
 *
 * Le verrouillage (`pin-lockout.ts`) bloque deja apres 5 echecs, mais il ne
 * compte QUE les echecs. Cette limite-ci compte toutes les tentatives, ce qui
 * arrete aussi un script qui aurait devine le PIN et le rejouerait en boucle.
 */
export const LIMITE_PIN: Limite = { max: 10, fenetreMs: 5 * 60 * 1000 };

/** Resolutions de salon par adresse IP. */
export const LIMITE_RESOLVE: Limite = { max: 10, fenetreMs: 10 * 60 * 1000 };

/** Demandes de code d'appairage, par salon. */
export const LIMITE_APPAIRAGE: Limite = { max: 3, fenetreMs: 60 * 60 * 1000 };

/** Etat d'un compteur, tel qu'il est stocke. */
export type Compteur = {
  count: number;
  windowStart: Date;
};

export type DecisionLimite = {
  /** `false` quand l'appel doit etre refuse en 429. */
  ok: boolean;
  /** Millisecondes avant que la fenetre ne reparte. */
  resetDansMs: number;
  /** `true` si la fenetre a expire et doit etre reinitialisee en base. */
  fenetreAReinitialiser: boolean;
};

/**
 * Cet appel passe-t-il ?
 *
 * @param compteur l'etat lu en base APRES increment, ou `null` si la cle
 *   vient d'etre creee.
 *
 * La fenetre est glissante par blocs : une fois `fenetreMs` ecoulee depuis
 * `windowStart`, le compteur repart a 1. Plus simple qu'une vraie fenetre
 * glissante — qui demanderait de stocker chaque horodatage — et suffisant
 * ici : on veut ralentir une attaque, pas mesurer un debit au plus juste.
 */
export function deciderLimite(
  compteur: Compteur | null,
  limite: Limite,
  maintenant: Date,
): DecisionLimite {
  if (!compteur) {
    return { ok: true, resetDansMs: limite.fenetreMs, fenetreAReinitialiser: false };
  }

  const finFenetre = compteur.windowStart.getTime() + limite.fenetreMs;
  if (finFenetre <= maintenant.getTime()) {
    // La fenetre est expiree : cet appel ouvre la suivante.
    return { ok: true, resetDansMs: limite.fenetreMs, fenetreAReinitialiser: true };
  }

  return {
    ok: compteur.count <= limite.max,
    resetDansMs: finFenetre - maintenant.getTime(),
    fenetreAReinitialiser: false,
  };
}

/** Message francais accompagnant un refus 429. */
export function messageLimite(resetDansMs: number): string {
  const minutes = Math.ceil(resetDansMs / 60_000);
  if (minutes <= 1) {
    return "Trop de tentatives. Réessayez dans une minute.";
  }
  return `Trop de tentatives. Réessayez dans ${minutes} minutes.`;
}
