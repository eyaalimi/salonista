/**
 * API Conversions de Meta — preparation des donnees, sans le reseau.
 *
 * Meta veut savoir quelles publicites amenent de vraies inscriptions. Le
 * pixel navigateur ne suffit plus : bloqueurs, ITP de Safari, refus de
 * cookies en font rater une grande part. L'API Conversions envoie donc
 * l'evenement depuis NOTRE serveur, ou rien ne le bloque.
 *
 * CE FICHIER NE FAIT AUCUN APPEL RESEAU. Il prepare et hache, c'est tout —
 * donc entierement testable sans mock HTTP, conformement a la convention du
 * depot. L'envoi vit dans `meta-conversions-envoi.ts`.
 *
 * LE HACHAGE N'EST PAS UNE FORMALITE. Meta exige SHA-256 sur toute donnee
 * personnelle, et refuse l'evenement sinon. Surtout : une adresse hachee ne
 * peut pas etre relue. Meta s'en sert pour comparer avec ses propres hachages
 * et reconnaitre un compte Facebook existant — il n'apprend jamais l'adresse
 * de quelqu'un qu'il ne connaissait pas deja.
 *
 * La normalisation AVANT hachage est obligatoire : « Eya@Gmail.com » et
 * « eya@gmail.com » doivent produire le MEME hachage, sinon la
 * correspondance echoue silencieusement et la conversion n'est jamais
 * attribuee.
 */

import { createHash } from "crypto";

/** Nom de l'evenement d'inscription d'un salon, cote Meta. */
export const EVENEMENT_INSCRIPTION = "CompleteRegistration";

/**
 * Normalise puis hache une donnee personnelle pour Meta.
 *
 * Minuscules et espaces retires : c'est la regle de Meta, et deux ecritures
 * differentes de la meme adresse doivent donner un hachage identique.
 *
 * Rend `undefined` pour une valeur vide plutot qu'un hachage de chaine vide
 * — envoyer le hachage de "" ferait croire a Meta qu'on transmet une donnee
 * reelle, et polluerait sa correspondance.
 */
export function hacher(valeur: string | null | undefined): string | undefined {
  if (!valeur) return undefined;
  const propre = valeur.trim().toLowerCase();
  if (propre.length === 0) return undefined;
  return createHash("sha256").update(propre).digest("hex");
}

/**
 * Normalise un telephone au format attendu par Meta : chiffres uniquement,
 * indicatif pays compris, sans « + » ni espaces.
 *
 * `+216 20 123 456` devient `21620123456`. Sans cette normalisation, le
 * hachage ne correspondrait jamais a celui que Meta calcule de son cote.
 */
export function normaliserTelephone(phone: string | null | undefined): string | undefined {
  if (!phone) return undefined;
  // Un numero de client passager n'est pas un vrai numero : ne jamais
  // l'envoyer, il ne correspondrait a personne et fausserait la mesure.
  if (phone.startsWith("walk-in-")) return undefined;
  const chiffres = phone.replace(/\D/g, "");
  return chiffres.length >= 8 ? chiffres : undefined;
}

/** Ce qu'on sait de la personne qui vient de s'inscrire. */
export type DonneesInscription = {
  email?: string | null;
  phone?: string | null;
  /** Adresse IP, telle que vue par le serveur. */
  ip?: string | null;
  userAgent?: string | null;
  /**
   * Le cookie `_fbc` : il porte l'identifiant du clic publicitaire Facebook.
   * C'est LA donnee la plus utile de toutes — avec elle, Meta attribue la
   * conversion a la publicite exacte, sans deviner.
   */
  fbc?: string | null;
  /** Le cookie `_fbp`, identifiant de navigateur pose par le pixel. */
  fbp?: string | null;
};

/** Un evenement pret a partir chez Meta. */
export type EvenementMeta = {
  event_name: string;
  event_time: number;
  event_id: string;
  action_source: "website";
  event_source_url?: string;
  user_data: Record<string, string>;
};

/**
 * Construit l'evenement.
 *
 * `event_id` sert a DEDUPLIQUER : si un pixel navigateur envoyait un jour le
 * meme evenement, Meta reconnaitrait le doublon grace a cet identifiant et ne
 * compterait qu'une conversion. On passe donc l'identifiant du salon, qui est
 * unique et stable.
 *
 * Les champs absents sont OMIS, jamais envoyes vides : Meta ignore les champs
 * manquants, mais une chaine vide compte comme une donnee invalide et degrade
 * le score de qualite de l'evenement.
 */
export function construireEvenement(params: {
  providerId: string;
  donnees: DonneesInscription;
  urlSource?: string;
  maintenant?: Date;
}): EvenementMeta {
  const { providerId, donnees, urlSource } = params;
  const maintenant = params.maintenant ?? new Date();

  const user_data: Record<string, string> = {};

  const em = hacher(donnees.email);
  if (em) user_data.em = em;

  const ph = hacher(normaliserTelephone(donnees.phone));
  if (ph) user_data.ph = ph;

  // L'IP et l'agent ne sont PAS haches : Meta les veut en clair, c'est ainsi
  // que son API est specifiee. Ils ameliorent la correspondance.
  if (donnees.ip) user_data.client_ip_address = donnees.ip;
  if (donnees.userAgent) user_data.client_user_agent = donnees.userAgent;

  // `fbc` et `fbp` partent tels quels : ce sont deja des identifiants Meta,
  // les hacher les rendrait inutilisables.
  if (donnees.fbc) user_data.fbc = donnees.fbc;
  if (donnees.fbp) user_data.fbp = donnees.fbp;

  return {
    event_name: EVENEMENT_INSCRIPTION,
    // Meta attend des SECONDES, pas des millisecondes. Envoyer des
    // millisecondes place l'evenement en l'an 56000 et le fait rejeter.
    event_time: Math.floor(maintenant.getTime() / 1000),
    event_id: providerId,
    action_source: "website",
    ...(urlSource ? { event_source_url: urlSource } : {}),
    user_data,
  };
}

/**
 * L'evenement a-t-il de quoi etre rapproche d'une personne ?
 *
 * Meta rejette un evenement dont `user_data` est vide. Plutot que de lui
 * envoyer un appel voue a l'echec, on s'abstient : c'est le genre de detail
 * qui, repete, degrade la reputation du compte publicitaire.
 */
export function evenementExploitable(e: EvenementMeta): boolean {
  return Object.keys(e.user_data).length > 0;
}

/**
 * Lit les cookies Meta (`_fbc`, `_fbp`) dans l'en-tete d'une requete.
 *
 * Ils ne sont poses que si le pixel navigateur tourne. Sans lui ils sont
 * absents, et la correspondance se fera sur l'e-mail seul — moins precise,
 * mais loin d'etre inutile.
 */
export function lireCookiesMeta(enTeteCookie: string | null | undefined): {
  fbc?: string;
  fbp?: string;
} {
  if (!enTeteCookie) return {};
  const paires = Object.fromEntries(
    enTeteCookie
      .split(";")
      .map((c) => c.trim().split("="))
      .filter((p) => p.length === 2),
  );
  return {
    fbc: paires._fbc || undefined,
    fbp: paires._fbp || undefined,
  };
}
