/**
 * Transitions d'etat d'une reservation — sans paiement en ligne.
 *
 * Salonista n'encaisse rien : la cliente reserve son creneau ici et regle son
 * soin au salon. La FAQ le dit depuis toujours (« Vous reservez votre creneau
 * en ligne, puis vous reglez votre soin directement au salon »), mais le code
 * pretendait le contraire — POST /api/payment posait `paymentStatus: "PAID"`
 * et envoyait un mail « Paiement effectue avec succes » sans qu'aucun dinar
 * ne change de main. N'importe quelle cliente connectee obtenait ainsi un QR
 * valide et une reservation « payee » gratuitement.
 *
 * Le QR est donc emis a la CREATION de la reservation, pas au paiement : il
 * atteste d'un rendez-vous, pas d'un reglement. Le salon encaisse au
 * comptoir, et `paymentStatus` reste UNPAID jusqu'a ce qu'un vrai
 * prestataire de paiement soit branche.
 */

import type { BookingStatus, PaymentStatus } from "@/generated/prisma/enums";

/**
 * Le paiement en ligne est-il actif ?
 *
 * Aucun prestataire tunisien (Paymee, Konnect, Flouci, ClicToPay) n'est
 * integre a ce jour. Ce drapeau existe pour que le retour du paiement en
 * ligne soit un changement localise : passer a `true` devra reactiver
 * POST /api/payment, remettre la page /cliente/paiement et faire dependre le
 * QR du reglement. Tant qu'il vaut `false`, ces chemins repondent 410.
 *
 * Volontairement une constante et non une variable d'environnement : un
 * deploiement ne doit pas pouvoir l'activer par accident alors qu'aucun code
 * d'encaissement n'existe derriere.
 */
export const PAIEMENT_EN_LIGNE_ACTIF = false;

/** Etat d'une reservation au moment de sa creation. */
export type EtatCreation = {
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  /** `true` si un QR doit etre emis des maintenant. */
  emettreQr: boolean;
};

/**
 * Dans quel etat naitre une reservation ?
 *
 * Sans paiement en ligne, le creneau est acquis des la reservation : la
 * cliente est attendue, le salon la voit dans son agenda, et le QR qu'elle
 * presentera existe deja. Avec un paiement en ligne, la reservation
 * attendrait le reglement avant d'etre confirmee.
 */
export function etatCreationReservation(
  paiementEnLigne: boolean = PAIEMENT_EN_LIGNE_ACTIF,
): EtatCreation {
  if (paiementEnLigne) {
    return { status: "PENDING", paymentStatus: "UNPAID", emettreQr: false };
  }
  return { status: "CONFIRMED", paymentStatus: "UNPAID", emettreQr: true };
}

/** Pourquoi une validation d'arrivee est refusee, ou `null` si elle passe. */
export type RefusValidation =
  | { raison: "annulee"; message: string }
  | { raison: "deja-validee"; message: string }
  | { raison: "non-payee"; message: string };

/**
 * Le salon peut-il valider l'arrivee de cette cliente ?
 *
 * Le controle « non payee » ne s'applique QUE si le paiement en ligne est
 * actif. Sans lui, exiger un reglement prealable rendrait tout QR invalide :
 * la cliente se presenterait au salon avec un code que la caisse refuserait,
 * alors qu'elle vient precisement payer sur place.
 *
 * L'appartenance de la reservation au salon n'est PAS decidee ici : elle
 * depend du verificateur (employe, proprietaire, admin) et reste dans
 * verify-authz.ts.
 */
export function refusValidationArrivee(
  reservation: {
    status: BookingStatus;
    paymentStatus: PaymentStatus;
    qrVerified: boolean;
  },
  paiementEnLigne: boolean = PAIEMENT_EN_LIGNE_ACTIF,
): RefusValidation | null {
  if (reservation.status === "CANCELLED") {
    return { raison: "annulee", message: "Cette réservation a été annulée" };
  }
  if (reservation.qrVerified) {
    return {
      raison: "deja-validee",
      message: "Ce QR code a déjà été vérifié",
    };
  }
  if (paiementEnLigne && reservation.paymentStatus !== "PAID") {
    return { raison: "non-payee", message: "Réservation non payée" };
  }
  return null;
}
