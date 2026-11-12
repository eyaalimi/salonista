/**
 * Chiffrement des secrets stockes en base (jeton WhatsApp Cloud d'un salon).
 *
 * AES-256-GCM : chiffrement AUTHENTIFIE. Un blob modifie en base (ou chiffre
 * avec une autre cle) est refuse au dechiffrement au lieu de rendre un jeton
 * corrompu qu'on enverrait a Meta.
 *
 * Cle : 32 octets en base64 dans `CLE_CHIFFREMENT_SECRETS`, generee une fois
 * avec `openssl rand -base64 32`. LA PERDRE REND LES JETONS ILLISIBLES : il
 * faudrait les ressaisir tous dans /superadmin. Elle vit dans le .env du
 * serveur, jamais dans le depot.
 *
 * Format stocke : `iv:tag:donnees`, chacun en base64. IV aleatoire de 12
 * octets a CHAQUE chiffrement — reutiliser un IV avec GCM casse le secret.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export class CleChiffrementManquante extends Error {
  constructor() {
    super("CLE_CHIFFREMENT_SECRETS absente ou invalide (32 octets en base64 attendus).");
    this.name = "CleChiffrementManquante";
  }
}

/** La cle, ou une erreur explicite. `cleBase64` est injectable pour les tests. */
export function lireCle(cleBase64: string | undefined = process.env.CLE_CHIFFREMENT_SECRETS): Buffer {
  if (!cleBase64) throw new CleChiffrementManquante();
  const cle = Buffer.from(cleBase64, "base64");
  if (cle.length !== 32) throw new CleChiffrementManquante();
  return cle;
}

/** La cle est-elle configuree ? Pour refuser un envoi AVANT de commencer. */
export function cleChiffrementPresente(cleBase64: string | undefined = process.env.CLE_CHIFFREMENT_SECRETS): boolean {
  try {
    lireCle(cleBase64);
    return true;
  } catch {
    return false;
  }
}

export function chiffrer(texte: string, cle: Buffer = lireCle()): string {
  const iv = randomBytes(12);
  const chiffreur = createCipheriv("aes-256-gcm", cle, iv);
  const donnees = Buffer.concat([chiffreur.update(texte, "utf8"), chiffreur.final()]);
  const tag = chiffreur.getAuthTag();
  return [iv, tag, donnees].map((b) => b.toString("base64")).join(":");
}

export function dechiffrer(blob: string, cle: Buffer = lireCle()): string {
  const parties = blob.split(":");
  if (parties.length !== 3) throw new Error("Secret chiffré illisible.");
  const [iv, tag, donnees] = parties.map((p) => Buffer.from(p, "base64"));
  if (iv.length !== 12 || tag.length !== 16) throw new Error("Secret chiffré illisible.");
  const dechiffreur = createDecipheriv("aes-256-gcm", cle, iv);
  dechiffreur.setAuthTag(tag);
  // `final()` leve si le tag ne correspond pas : blob altere ou mauvaise cle.
  return Buffer.concat([dechiffreur.update(donnees), dechiffreur.final()]).toString("utf8");
}
