/**
 * Message WhatsApp annoncant les points gagnes apres un encaissement.
 *
 * Le champ `RewardProgram.whatsappMessage` existait depuis le lot fidelite,
 * avec ses variables — mais RIEN ne le lisait : le lien annonce dans le
 * commentaire du schema n'avait jamais ete construit. La cliente ne savait
 * donc jamais qu'elle avait des points, ce qui vide le programme de son sens.
 *
 * POURQUOI UN LIEN `wa.me` ET PAS UN ENVOI AUTOMATIQUE. L'API WhatsApp
 * Business exige un compte Meta verifie, des modeles approuves par Meta et
 * facture chaque message. Le lien ouvre WhatsApp avec le texte deja redige :
 * la caissiere appuie sur envoyer. Aucun cout, aucune demarche, et le message
 * part depuis le numero du salon — donc dans une conversation que la cliente
 * reconnait.
 *
 * Decisions pures, sans reseau, pour rester testables sans mock.
 */

/** Gabarit utilise quand le salon n'en a pas defini. */
export const MESSAGE_PAR_DEFAUT =
  "Bonjour {name} 💖 Merci pour votre visite ! Vous avez gagné {earned} points. Solde total : {balance} points.";

export type VariablesMessage = {
  /** Prenom de la cliente, ou vide si inconnu. */
  name: string;
  /** Points gagnes sur cette vente. */
  earned: number;
  /** Solde apres la vente. */
  balance: number;
};

/**
 * Remplace les variables du gabarit.
 *
 * Une variable inconnue est laissee TELLE QUELLE plutot que vidée : un salon
 * qui se trompe de nom voit son erreur dans l'apercu, au lieu d'un trou
 * silencieux dans le message envoye a ses clientes.
 *
 * `{name}` vide produit « Bonjour  💖 » — on nettoie donc les espaces
 * doubles laisses par une variable absente.
 */
export function composerMessage(
  gabarit: string | null | undefined,
  vars: VariablesMessage,
): string {
  const modele = gabarit?.trim() || MESSAGE_PAR_DEFAUT;
  return modele
    .replace(/\{name\}/g, vars.name)
    .replace(/\{earned\}/g, String(vars.earned))
    .replace(/\{balance\}/g, String(vars.balance))
    .replace(/ {2,}/g, " ")
    .trim();
}

/**
 * Le numero au format attendu par `wa.me` : chiffres uniquement, indicatif
 * pays compris, sans `+` ni espaces.
 *
 * Rend `null` si le numero est inexploitable — l'appelant masque alors le
 * bouton plutot que d'ouvrir un WhatsApp vide.
 */
export function numeroPourWhatsapp(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const chiffres = phone.replace(/\D/g, "");
  // Un numero tunisien fait 8 chiffres, 11 avec l'indicatif 216. En-dessous
  // de 8, ce n'est pas un numero joignable.
  if (chiffres.length < 8) return null;
  return chiffres;
}

/**
 * Le lien `wa.me` a ouvrir, ou `null` si l'envoi n'a pas lieu d'etre.
 *
 * Trois cas ou l'on ne propose RIEN :
 *  - pas de numero exploitable ;
 *  - aucun point gagne — annoncer « vous avez gagne 0 points » dessert le
 *    programme ;
 *  - pas de cliente rattachee a la vente (passage sans compte).
 */
export function lienWhatsappFidelite(args: {
  phone: string | null | undefined;
  gabarit: string | null | undefined;
  name: string | null | undefined;
  earned: number;
  balance: number;
}): string | null {
  const numero = numeroPourWhatsapp(args.phone);
  if (!numero) return null;
  if (args.earned <= 0) return null;

  const texte = composerMessage(args.gabarit, {
    name: args.name?.trim() || "",
    earned: args.earned,
    balance: args.balance,
  });

  return `https://wa.me/${numero}?text=${encodeURIComponent(texte)}`;
}
