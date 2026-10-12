/**
 * Tous les textes de la page Fidelite, au meme endroit.
 *
 * POURQUOI UN FICHIER SEPARE. La page precedente noyait la gerante sous du
 * vocabulaire technique — « cashback », « portefeuille », « solde », « vie »,
 * « {name} ». Ce fichier rassemble les formulations retenues pour qu'on
 * puisse les relire d'un coup, sans les chercher dans du JSX.
 *
 * LA DARIJA EST EN LETTRES LATINES, chiffres 3/7/9 compris — comme sur
 * WhatsApp, et comme la landing (voir `src/components/landing/content.ts`).
 * Elle vient EN SOUS-TITRE du francais, jamais a sa place : la gerante lit le
 * francais, la darija lui donne la phrase a dire a sa cliente.
 *
 * Le projet n'a pas d'i18n (verifie : aucune librairie dans package.json), et
 * ce lot n'en introduit pas. Des constantes suffisent.
 */

/** Les trois etapes du programme, en haut de page. */
export const ETAPES = [
  { fr: "Elle paie", darija: "Tkhalles" },
  { fr: "Elle gagne une cagnotte", darija: "Terba7 cagnotte" },
  { fr: "Elle paie moins", darija: "Tkhalles a9al" },
] as const;

/**
 * Le gabarit WhatsApp propose aux NOUVEAUX salons.
 *
 * Il ne remplace jamais un message deja personnalise — voir
 * `MESSAGE_PAR_DEFAUT` dans src/lib/whatsapp-fidelite.ts, qui ne sert que
 * lorsque le champ est vide.
 */
export const MESSAGE_DARIJA_DEFAUT =
  "Aslema {name} ! Ya3tik essa7a 3al visite. Rbe7t {earned} points, w taw 3andek {balance} points fel compte mte3ek.";

/**
 * Les variables du message, nommees en francais pour la gerante.
 *
 * Le jeton technique (`{name}`) reste la valeur envoyee au serveur : seul
 * l'affichage change. Une gerante n'a aucune raison de savoir qu'un gabarit
 * s'ecrit avec des accolades.
 */
export const VARIABLES_MESSAGE = [
  { jeton: "{name}", libelle: "Prénom", exemple: "Sarra" },
  { jeton: "{earned}", libelle: "Points gagnés", exemple: "1500" },
  { jeton: "{balance}", libelle: "Total de points", exemple: "1500" },
] as const;

/** Les valeurs d'exemple de l'apercu WhatsApp — jamais `{name}` a l'ecran. */
export const EXEMPLE_WHATSAPP = {
  name: "Sarra",
  earned: 1500,
  balance: 1500,
};

/**
 * L'exemple pedagogique en deux visites.
 *
 * Les montants sont ceux de la maquette (150 DT puis 40 DT) ; les points et
 * les reductions, eux, sont CALCULES par `exempleDeuxVisites` a partir des
 * vraies regles du salon. Figer les chiffres ici aurait produit un exemple
 * qui contredit les pastilles affichees juste au-dessus.
 */
export const EXEMPLE_VISITES = {
  montant1: 150,
  montant2: 40,
  visite1: {
    titre: "Visite 1",
    darija: "Sarra 3amlet coloration b 150 DT",
  },
  visite2: {
    titre: "Visite 2",
    darija: "Jet l brushing b 40 DT, esta3melt el cagnotte mte3ha",
  },
  resultat: {
    titre: "Résultat",
    darija: "Khallset a9al, w 3awdet !",
  },
} as const;
