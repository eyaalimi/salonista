/**
 * TOTP des comptes superadmin — enrolement et verification.
 *
 * S'appuie sur `otpauth` (9.5.2, aucune dependance transitive). Le QR
 * d'enrolement est produit par `qrcode`, deja present dans le projet pour les
 * QR de reservation : aucune dependance supplementaire de ce cote.
 *
 * REGLES :
 *
 * - `window: 1` autorise le pas de 30 s precedent et le suivant. C'est le
 *   reglage usuel : sans lui, une horloge de telephone decalee de quelques
 *   secondes rend l'application inutilisable. Au-dela, la fenetre d'attaque
 *   s'elargit sans benefice.
 *
 * - Le secret est stocke en base en clair (`User.totpSecret`). C'est inherent
 *   au TOTP : le serveur doit recalculer le code, il ne peut donc pas le
 *   hacher comme un mot de passe. La protection repose sur l'acces a la base,
 *   et c'est pourquoi le secret n'est JAMAIS renvoye par une route API apres
 *   l'enrolement.
 *
 * - Le rejeu est refuse : un code deja consomme ne vaut plus, meme dans sa
 *   fenetre de 30 s. Sans cela, un code lu par-dessus l'epaule reste
 *   utilisable une demi-minute.
 */

import { Secret, TOTP } from "otpauth";

/** Nom affiche dans l'application d'authentification. */
const EMETTEUR = "Salonista";

/** Parametres figes : changer l'un d'eux invaliderait les secrets existants. */
const ALGO = "SHA1";
const CHIFFRES = 6;
const PAS_SECONDES = 30;

/** Tolerance, en nombre de pas de 30 s, de part et d'autre de l'instant. */
const FENETRE = 1;

function construireTotp(secretBase32: string, libelle: string): TOTP {
  return new TOTP({
    issuer: EMETTEUR,
    label: libelle,
    algorithm: ALGO,
    digits: CHIFFRES,
    period: PAS_SECONDES,
    secret: Secret.fromBase32(secretBase32),
  });
}

/**
 * Cree un secret neuf et l'URI a encoder dans le QR.
 *
 * Le secret n'est PAS encore confirme a ce stade : on attend que le compte
 * prouve qu'il a bien enregistre le QR en saisissant un premier code valide
 * (voir `confirmerEnrolement` cote route). Sans cette etape, un enrolement
 * interrompu laisserait un compte verrouille hors de son propre espace.
 */
export function creerSecretTotp(email: string): { secret: string; uri: string } {
  const secret = new Secret({ size: 20 }); // 160 bits, la taille recommandee
  const totp = construireTotp(secret.base32, email);
  return { secret: secret.base32, uri: totp.toString() };
}

/**
 * Le code saisi est-il valide pour ce secret ?
 *
 * Renvoie le DELTA (en pas de 30 s) plutot qu'un booleen : l'appelant en a
 * besoin pour refuser un rejeu. `null` = code invalide.
 */
export function validerCodeTotp(
  secretBase32: string,
  code: string,
  email: string,
  maintenant: Date = new Date(),
): number | null {
  const propre = code.replace(/\s/g, "");
  // Garde avant tout calcul : `otpauth` accepterait une chaine vide et ferait
  // du travail pour rien.
  if (!/^\d{6}$/.test(propre)) return null;

  const totp = construireTotp(secretBase32, email);
  const delta = totp.validate({
    token: propre,
    window: FENETRE,
    timestamp: maintenant.getTime(),
  });
  return delta === null ? null : delta;
}

/**
 * Identifie de maniere stable le pas de temps consomme par un code.
 *
 * Stocke sur le compte (`totpLastUsedStep`), il permet de refuser le rejeu du
 * MEME code : deux validations ne peuvent pas partager un pas.
 */
export function pasDuCode(delta: number, maintenant: Date = new Date()): number {
  return Math.floor(maintenant.getTime() / 1000 / PAS_SECONDES) + delta;
}

/**
 * Un pas deja consomme est-il rejoue ?
 *
 * On refuse aussi les pas ANTERIEURS au dernier consomme : accepter un code
 * plus vieux que le dernier utilise rouvrirait la fenetre qu'on vient de
 * fermer.
 */
export function estRejeu(pas: number, dernierPasUtilise: number | null): boolean {
  if (dernierPasUtilise === null) return false;
  return pas <= dernierPasUtilise;
}
