/**
 * Rappel WhatsApp d'un credit en cours — « rappel gentil ».
 *
 * Meme principe que la fidelite (voir whatsapp-fidelite.ts) : un lien `wa.me`
 * qui ouvre WhatsApp avec le texte deja redige, envoye depuis le numero du
 * salon. Gratuit, sans compte Meta, et la cliente reconnait l'expediteur.
 *
 * Le ton compte plus que pour la fidelite : on parle d'argent du a quelqu'un
 * qu'on veut revoir. Le message remercie d'abord, rappelle ensuite, et ne
 * parle jamais de « retard ».
 *
 * Decisions pures, sans reseau.
 */

import { toMillimes, type Money } from "./money";
import { numeroPourWhatsapp } from "./whatsapp-fidelite";

/** EN DARIJA TOUNSIA, lettres latines — meme registre que MESSAGE_PAR_DEFAUT. */
export const MESSAGE_CREDIT_PAR_DEFAUT =
  "Aslema {name} ! Ya3tik essa7a. Ena {salon}, n7eb nfakrek elli 3andek {montant} DT mazelou. Ki tet3adda 3lina, merci barcha !";

export type VariablesCredit = {
  /** Prenom de la cliente, ou vide si inconnu. */
  name: string;
  /** Montant du, deja formate (« 65,000 »). */
  montant: string;
  /** Nom du salon. */
  salon: string;
};

/** « 65,000 » : trois decimales et virgule, comme sur le ticket, sans « TND ». */
export function montantPourMessage(montant: Money): string {
  const m = toMillimes(montant);
  return `${Math.floor(m / 1000)},${String(m % 1000).padStart(3, "0")}`;
}

/**
 * Memes regles que `composerMessage` : variable inconnue laissee telle quelle
 * (l'erreur se voit dans l'apercu), espaces doubles nettoyes quand une
 * variable est vide.
 */
export function composerMessageCredit(
  gabarit: string | null | undefined,
  vars: VariablesCredit,
): string {
  const modele = gabarit?.trim() || MESSAGE_CREDIT_PAR_DEFAUT;
  return modele
    .replace(/\{name\}/g, vars.name)
    .replace(/\{montant\}/g, vars.montant)
    .replace(/\{salon\}/g, vars.salon)
    .replace(/ {2,}/g, " ")
    .trim();
}

/**
 * Le lien `wa.me`, ou `null` quand le rappel n'a pas lieu d'etre : pas de
 * numero joignable (dont les fiches « passage » `walk-in-…`), ou rien a
 * rappeler.
 */
export function lienRappelCredit(args: {
  phone: string | null | undefined;
  name: string | null | undefined;
  salon: string;
  montant: Money;
  gabarit?: string | null;
}): string | null {
  if (args.phone?.startsWith("walk-in")) return null;
  const numero = numeroPourWhatsapp(args.phone);
  if (!numero) return null;
  if (toMillimes(args.montant) <= 0) return null;
  const texte = composerMessageCredit(args.gabarit, {
    name: args.name?.trim() || "",
    montant: montantPourMessage(args.montant),
    salon: args.salon.trim(),
  });
  return `https://wa.me/${numero}?text=${encodeURIComponent(texte)}`;
}
