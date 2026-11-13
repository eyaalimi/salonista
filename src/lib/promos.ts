/**
 * Promos WhatsApp — decisions pures, sans reseau ni base.
 *
 * Le message part via un MODELE approuve par Meta, propre a chaque salon :
 *
 *   Aslema {{1}} ! 3andna promo jdida lik :
 *
 *   {{2}}
 *
 *   <texte de fin du salon>
 *
 * {{1}} = prenom (ou « 3zizti »), {{2}} = l'offre ecrite par la gerante.
 * Le texte de fin est FIXE dans le modele : Meta refuse un modele qui finit
 * par une variable (erreur 2388299) et se mefie d'un modele avec trop de
 * variables pour peu de texte (2388293). Voir docs/whatsapp-cloud.md.
 */

import { fromMillimes, toMillimes, type Money } from "./money";
import { tryNormalizePhone } from "./phone";

export const OFFRE_MAX = 500;

/** Remplace le prenom absent : Meta ne documente pas l'envoi d'une variable vide. */
export const PRENOM_PAR_DEFAUT = "3zizti";

/** Texte fixe du modele entre le prenom et l'offre. */
export const PHRASE_INTRO = "3andna promo jdida lik :";

/** Destinataires reserves par passage du moteur. */
export const LOT_PAR_PASSAGE = 60;
/** Au-dela, un temporaire devient definitif. */
export const TENTATIVES_MAX = 3;
/** Une reservation plus vieille que ca vient d'un passage mort : on la relache. */
export const BAIL_RESERVATION_MS = 5 * 60 * 1000;
/** Fenetre de « revenue » apres une promo. */
export const JOURS_RETOUR = 15;

export type Refus = { ok: false; erreur: string };

// ---------------------------------------------------------------------------
// Texte
// ---------------------------------------------------------------------------

/**
 * Meta refuse, dans une variable de modele, les retours a la ligne, les
 * tabulations et plus de 4 espaces consecutifs. On les remplace par des
 * espaces plutot que de refuser : la gerante tape volontiers sur « Entree ».
 */
export function nettoyerOffre(texte: unknown): { ok: true; offre: string } | Refus {
  const brut = typeof texte === "string" ? texte : "";
  const offre = brut
    .replace(/[\r\n\t]+/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();
  if (!offre) return { ok: false, erreur: "Écrivez votre offre." };
  if (offre.length > OFFRE_MAX) {
    return {
      ok: false,
      erreur: `L'offre est trop longue : ${offre.length} caractères pour ${OFFRE_MAX} au maximum.`,
    };
  }
  return { ok: true, offre };
}

/** Le prenom tel qu'il part dans {{1}}. */
export function prenomPourModele(prenom: string | null | undefined): string {
  const p = (prenom ?? "").replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim();
  return p || PRENOM_PAR_DEFAUT;
}

/**
 * Exactement ce que la cliente lira — l'apercu de l'ecran doit correspondre
 * au modele approuve, sinon la gerante valide un message qu'elle ne verra
 * jamais partir.
 */
export function composerApercu(args: {
  prenom: string | null | undefined;
  offre: string;
  texteFin: string;
}): string {
  const lignes = [`Aslema ${prenomPourModele(args.prenom)} ! ${PHRASE_INTRO}`, "", args.offre.trim()];
  if (args.texteFin.trim()) lignes.push("", args.texteFin.trim());
  return lignes.join("\n");
}

// ---------------------------------------------------------------------------
// Audiences
// ---------------------------------------------------------------------------

export const AUDIENCES = ["TOUTES", "RECENTES_90J", "INACTIVES_60J", "MANUELLE"] as const;
export type Audience = (typeof AUDIENCES)[number];

export function estAudience(v: unknown): v is Audience {
  return typeof v === "string" && (AUDIENCES as readonly string[]).includes(v);
}

export type ClientePromo = {
  id: string;
  telephone: string;
  prenom: string | null;
  promosAcceptees: boolean;
  derniereVenteAt: Date | null;
};

export type Retenue = { customerId: string; telephone: string; prenom: string | null };

const MS_JOUR = 24 * 60 * 60 * 1000;

/** "+216 22 345 678" → "21622345678" (format Meta), ou null. */
export function telephonePourWhatsapp(phone: string): string | null {
  if (phone.startsWith("walk-in")) return null;
  const n = tryNormalizePhone(phone);
  return n ? n.replace(/\D/g, "") : null;
}

/**
 * Qui recoit la promo.
 *
 * TOUJOURS exclues, dans cet ordre : les clientes qui ont refuse les promos,
 * les numeros inexploitables, puis les doublons (deux fiches pour le meme
 * numero — elle ne doit pas recevoir deux fois le meme message, ni le salon
 * payer deux fois). Les compteurs alimentent la phrase « 12 clientes ont
 * demande a ne plus recevoir de promos ».
 */
export function selectionnerDestinataires(args: {
  clientes: ClientePromo[];
  audience: Audience;
  maintenant: Date;
  idsManuels?: string[];
}): { retenues: Retenue[]; exclues: { refus: number; numeroInvalide: number; doublon: number } } {
  const t = args.maintenant.getTime();
  const manuels = new Set(args.idsManuels ?? []);
  const dansAudience = (c: ClientePromo): boolean => {
    switch (args.audience) {
      case "TOUTES":
        return true;
      case "RECENTES_90J":
        return c.derniereVenteAt !== null && t - c.derniereVenteAt.getTime() <= 90 * MS_JOUR;
      case "INACTIVES_60J":
        return c.derniereVenteAt !== null && t - c.derniereVenteAt.getTime() > 60 * MS_JOUR;
      case "MANUELLE":
        return manuels.has(c.id);
    }
  };

  const exclues = { refus: 0, numeroInvalide: 0, doublon: 0 };
  const vus = new Set<string>();
  const retenues: Retenue[] = [];
  for (const c of args.clientes) {
    if (!dansAudience(c)) continue;
    if (!c.promosAcceptees) {
      exclues.refus++;
      continue;
    }
    const tel = telephonePourWhatsapp(c.telephone);
    if (!tel) {
      exclues.numeroInvalide++;
      continue;
    }
    if (vus.has(tel)) {
      exclues.doublon++;
      continue;
    }
    vus.add(tel);
    retenues.push({ customerId: c.id, telephone: tel, prenom: c.prenom?.trim() || null });
  }
  return { retenues, exclues };
}

/** Cout estime en millimes, ou null si le prix d'un message est inconnu. */
export function coutEstime(nb: number, prixMessageDT: Money | null | undefined): number | null {
  if (prixMessageDT === null || prixMessageDT === undefined) return null;
  return nb * toMillimes(prixMessageDT);
}

export function libelleCout(nb: number, prixMessageDT: Money | null | undefined): string {
  const m = coutEstime(nb, prixMessageDT);
  if (m === null) return "coût selon le tarif Meta";
  return `coût estimé ${fromMillimes(m).replace(".", ",")} DT`;
}

// ---------------------------------------------------------------------------
// Erreurs Meta
// ---------------------------------------------------------------------------

/**
 * Codes d'erreur WhatsApp Cloud a NE PAS reessayer. Source : page officielle
 * « Error codes » (developers.facebook.com/docs/whatsapp/cloud-api/support/
 * error-codes), consultee le 12/11/2026.
 *
 * - 131026 message non delivrable (pas de WhatsApp, vieille application) ;
 * - 131049 limite marketing par destinataire (« healthy ecosystem ») : Meta
 *   dit d'attendre 24 h, reessayer avant « only result in another error » ;
 * - 131050 la cliente a coupe les messages marketing (« Do not retry ») ;
 * - 131047 hors fenetre de 24 h ; 130472 experience marketing de Meta ;
 * - 132000, 132001, 132005, 132007, 132012, 132015, 132016, 132018 : modele
 *   (variables, langue, politique, pause, desactivation) ;
 * - 100, 131008, 131009, 131021, 131051, 135000 : requete invalide ;
 * - 0, 3, 10, 190, 200, 131005 : jeton ou permissions ;
 * - 33, 368, 131031, 131037, 131042, 131045, 131055, 131063, 133010,
 *   130403, 130497 : compte, numero, paiement, restriction ;
 * - 131048 limite anti-spam et 131064 limite de qualite : la doc ne donne
 *   aucun delai, et les reessayer chaque minute degraderait encore la note
 *   de qualite du numero. Classes definitifs (decision du 12/11/2026).
 *
 * Tout le reste est TEMPORAIRE : 1, 2, 4, 80007, 130429, 131000, 131016,
 * 131056, 131057, 133004, erreurs reseau, 5xx, delai depasse.
 */
const DEFINITIVES = new Set([
  "0", "3", "10", "33", "100", "190", "200", "368",
  "130403", "130472", "130497",
  "131005", "131008", "131009", "131021", "131026", "131031", "131037", "131042",
  "131045", "131047", "131048", "131049", "131050", "131051", "131055", "131063", "131064",
  "132000", "132001", "132005", "132007", "132012", "132015", "132016", "132018",
  "133010", "135000",
]);

export function estErreurDefinitive(codeMeta: string | number | null | undefined): boolean {
  if (codeMeta === null || codeMeta === undefined) return false;
  const code = String(codeMeta);
  // Permissions 200-299 : toutes definitives.
  const n = Number(code);
  if (Number.isInteger(n) && n >= 200 && n <= 299) return true;
  return DEFINITIVES.has(code);
}

/** La cliente a coupe les messages marketing dans WhatsApp : promos refusees. */
export const CODE_MARKETING_REFUSE = "131050";

/**
 * Apres une tentative d'envoi : le nouvel etat du destinataire.
 * Temporaire → EN_ATTENTE (reessai au passage suivant), sauf a la 3e
 * tentative ; definitif → ECHEC tout de suite.
 */
export function apresTentative(args: {
  tentatives: number;
  resultat:
    | { ok: true; messageIdExterne: string }
    | { ok: false; code: string; message: string; definitive: boolean };
}): { statut: "ENVOYE" | "EN_ATTENTE" | "ECHEC"; tentatives: number; erreur: string | null } {
  const tentatives = args.tentatives + 1;
  if (args.resultat.ok) return { statut: "ENVOYE", tentatives, erreur: null };
  const erreur = `${args.resultat.code} — ${args.resultat.message}`.slice(0, 500);
  if (args.resultat.definitive || tentatives >= TENTATIVES_MAX) {
    return { statut: "ECHEC", tentatives, erreur };
  }
  return { statut: "EN_ATTENTE", tentatives, erreur };
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

const RANG: Record<string, number> = { ENVOYE: 1, DELIVRE: 2, LU: 3 };
const STATUT_META: Record<string, "ENVOYE" | "DELIVRE" | "LU" | "ECHEC"> = {
  sent: "ENVOYE",
  delivered: "DELIVRE",
  read: "LU",
  failed: "ECHEC",
};

/**
 * Nouveau statut apres un evenement Meta, ou null s'il ne faut rien changer.
 *
 * Meta peut livrer les evenements dans le desordre et les renvoyer pendant
 * 36 h : un « delivered » arrive apres un « read » ne fait PAS reculer le
 * statut, et un echec n'ecrase pas un message deja lu ou delivre.
 */
export function statutApresEvenement(actuel: string, evenementMeta: string): string | null {
  const nouveau = STATUT_META[evenementMeta];
  if (!nouveau) return null;
  if (nouveau === "ECHEC") {
    return actuel === "DELIVRE" || actuel === "LU" || actuel === "ECHEC" ? null : "ECHEC";
  }
  if (actuel === "ECHEC") return null;
  const rangActuel = RANG[actuel] ?? 0;
  return RANG[nouveau] > rangActuel ? nouveau : null;
}

/**
 * La cliente demande a ne plus recevoir : bouton « Ne plus recevoir » ou un
 * texte « STOP ». Insensible a la casse, aux accents et a la ponctuation ; un
 * message qui CONTIENT stop au milieu d'une phrase n'est pas une demande.
 */
export function estDesinscription(texte: string | null | undefined): boolean {
  if (!texte) return false;
  const t = texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return ["stop", "arret", "ne plus recevoir", "ne plus recevoir de promos", "desabonner", "desinscrire"].includes(t);
}

// ---------------------------------------------------------------------------
// Resultats d'une campagne
// ---------------------------------------------------------------------------

/**
 * Destinataires DISTINCTS revenus acheter dans les 15 jours qui suivent leur
 * envoi. Une cliente venue deux fois compte une fois. Une vente anterieure a
 * l'envoi ne compte pas : elle n'a pas pu etre provoquee par la promo.
 */
export function compterRevenues(
  destinataires: Array<{ customerId: string | null; envoyeLe: Date | null }>,
  ventes: Array<{ customerId: string; createdAt: Date }>,
): number {
  const parCliente = new Map<string, Date[]>();
  for (const v of ventes) {
    const l = parCliente.get(v.customerId) ?? [];
    l.push(v.createdAt);
    parCliente.set(v.customerId, l);
  }
  const revenues = new Set<string>();
  for (const d of destinataires) {
    if (!d.customerId || !d.envoyeLe) continue;
    const debut = d.envoyeLe.getTime();
    const fin = debut + JOURS_RETOUR * MS_JOUR;
    if ((parCliente.get(d.customerId) ?? []).some((t) => t.getTime() >= debut && t.getTime() <= fin)) {
      revenues.add(d.customerId);
    }
  }
  return revenues.size;
}

/** Modeles de texte proposes par des puces : un point de depart, pas un carcan. */
export const MODELES_OFFRE: Array<{ id: string; label: string; texte: string }> = [
  {
    id: "mois",
    label: "Promo du mois",
    texte: "Promo à 10 DT ce mois-ci : épilation lèvre + sourcils + brushing. Réservez vite !",
  },
  {
    id: "nouveaute",
    label: "Nouveauté",
    texte: "Nouveau au salon : soin kératine pour des cheveux lisses et brillants. -20 % pour la découverte.",
  },
  {
    id: "fete",
    label: "Fête / Aïd",
    texte: "Pour l'Aïd, profitez de -15 % sur les brushings et les maquillages. Pensez à réserver !",
  },
  {
    id: "anniversaire",
    label: "Anniversaire",
    texte: "Le salon fête son anniversaire : un soin offert pour toute prestation cette semaine !",
  },
];

// ---------------------------------------------------------------------------
// Programmation
// ---------------------------------------------------------------------------

/** Une programmation au-dela est sans doute une faute de frappe sur l'annee. */
export const PROGRAMMATION_MAX_JOURS = 60;

/**
 * « Maintenant » (null/vide) ou une date future. Une date passee de moins de
 * 5 minutes vaut « maintenant » (le temps de remplir la modale) ; au-dela,
 * elle est refusee : la gerante croirait programmer, on enverrait tout de
 * suite.
 */
export function lireProgrammation(
  valeur: unknown,
  maintenant: Date,
): { ok: true; programmeeLe: Date | null } | Refus {
  if (valeur === null || valeur === undefined || valeur === "") return { ok: true, programmeeLe: null };
  const d = new Date(String(valeur));
  if (Number.isNaN(d.getTime())) return { ok: false, erreur: "Date d'envoi invalide." };
  const ecart = d.getTime() - maintenant.getTime();
  if (ecart < -5 * 60 * 1000) return { ok: false, erreur: "La date d'envoi est déjà passée." };
  if (ecart <= 0) return { ok: true, programmeeLe: null };
  if (ecart > PROGRAMMATION_MAX_JOURS * MS_JOUR) {
    return { ok: false, erreur: `On ne peut pas programmer à plus de ${PROGRAMMATION_MAX_JOURS} jours.` };
  }
  return { ok: true, programmeeLe: d };
}

// ---------------------------------------------------------------------------
// Mode du salon
// ---------------------------------------------------------------------------

export type ModePromos = "WHATSAPP" | "SIMULATION" | "AUCUN";

/**
 * Par quel canal ce salon envoie-t-il ?
 *
 * - connexion ACTIVE : WhatsApp, toujours ;
 * - SIMULATION seulement pour un salon de DEMONSTRATION (`ProviderProfile.demo`,
 *   le meme critere que le Premium sans echeance), sans connexion, et avec
 *   PROMOS_SIMULATION=1. Un vrai salon ne voit JAMAIS le mode demo, meme si
 *   la variable est posee en production : il croirait avoir envoye une promo
 *   qui n'est partie chez personne ;
 * - sinon : aucun canal (« WhatsApp n'est pas encore connecte »). Une
 *   connexion en brouillon ou suspendue ne bascule jamais en simulation.
 */
export function modePromos(args: {
  statutConnexion: "BROUILLON" | "ACTIVE" | "SUSPENDUE" | null;
  simulationActivee: boolean;
  salonDemo: boolean;
}): ModePromos {
  if (args.statutConnexion === "ACTIVE") return "WHATSAPP";
  if (args.statutConnexion === null && args.simulationActivee && args.salonDemo) return "SIMULATION";
  return "AUCUN";
}
