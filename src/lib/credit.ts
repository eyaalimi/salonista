/**
 * Credits clientes (« Payer plus tard ») — decisions pures, sans base ni reseau.
 *
 * Une cliente peut repartir sans tout payer : le reste devient un credit
 * rattache a la vente (`Sale.amountDue`), regle plus tard en une ou plusieurs
 * fois. Tout se calcule ici en MILLIMES entiers (voir money.ts) : un credit
 * reglé en trois versements doit retomber exactement sur zero, pas sur
 * 0,000000001.
 *
 * Les dates « de calendrier » (anciennete, retard, echeances) sont lues a
 * l'heure de Tunis, pas a celle du serveur (UTC) : une vente de 23h30 le
 * 28/10 est une vente du 28/10 pour le salon, pas du 29.
 */

import { fromMillimes, toMillimes, type Money } from "./money";
import { normaliser } from "./suggestions-cliente";

/** Sans date promise, un credit est « en retard » au-dela de ce nombre de jours. */
export const JOURS_AVANT_RETARD = 15;

/** Au-dela, une date promise est vraisemblablement une faute de frappe. */
export const ECHEANCE_MAX_JOURS = 366;

const FUSEAU = "Africa/Tunis";
const MS_JOUR = 24 * 60 * 60 * 1000;

export type Refus = { ok: false; erreur: string };

// ---------------------------------------------------------------------------
// Creation d'une vente a credit
// ---------------------------------------------------------------------------

/**
 * Ce qui reste du apres un paiement partiel.
 *
 * Payer TOUT n'est pas un credit : c'est une vente normale, qui doit passer
 * par le chemin normal (points gagnes tout de suite, statut PAID). L'accepter
 * ici creerait des « credits » a zero qui encombreraient la page Credits.
 */
export function calculerCredit(args: {
  total: Money;
  payeAujourdhui: Money;
}): { ok: true; amountDue: string; status: "CREDIT" } | Refus {
  const totalM = toMillimes(args.total);
  const payeM = toMillimes(args.payeAujourdhui);
  if (totalM <= 0) {
    return { ok: false, erreur: "Rien à mettre en crédit : le total est nul." };
  }
  if (payeM < 0) {
    return { ok: false, erreur: "Le montant payé aujourd'hui ne peut pas être négatif." };
  }
  if (payeM >= totalM) {
    return {
      ok: false,
      erreur: "Elle paie tout aujourd'hui : ce n'est pas un crédit, encaissez normalement.",
    };
  }
  return { ok: true, amountDue: fromMillimes(totalM - payeM), status: "CREDIT" };
}

// ---------------------------------------------------------------------------
// Reglement : repartir un versement sur plusieurs ventes
// ---------------------------------------------------------------------------

export type CreditOuvert = { saleId: string; createdAt: Date; amountDue: Money };

export type Imputation = {
  saleId: string;
  montantImpute: string;
  resteApres: string;
  soldee: boolean;
};

/**
 * Repartit un versement sur les ventes a credit, la PLUS ANCIENNE d'abord.
 *
 * Pourquoi la plus ancienne : c'est elle qui passe en retard la premiere, et
 * c'est l'ordre qu'une cliente comprend (« je paie d'abord ce que je dois
 * depuis le plus longtemps »).
 *
 * Un versement superieur au total du est REFUSE : il n'y a pas de credit
 * « en avance ». L'excedent n'aurait nulle part ou aller — ni avoir, ni
 * monnaie a rendre tracee — et finirait en ecart de caisse.
 *
 * Seules les ventes reellement touchees figurent dans le resultat.
 */
export function repartirVersement(args: {
  montant: Money;
  credits: CreditOuvert[];
}): { ok: true; imputations: Imputation[] } | Refus {
  const montantM = toMillimes(args.montant);
  if (montantM <= 0) {
    return { ok: false, erreur: "Le montant reçu doit être supérieur à zéro." };
  }
  const ouverts = args.credits
    .map((c) => ({ ...c, dueM: toMillimes(c.amountDue) }))
    .filter((c) => c.dueM > 0)
    .sort(
      (a, b) =>
        a.createdAt.getTime() - b.createdAt.getTime() || a.saleId.localeCompare(b.saleId),
    );
  const totalDuM = ouverts.reduce((s, c) => s + c.dueM, 0);
  if (totalDuM === 0) {
    return { ok: false, erreur: "Cette cliente n'a aucun crédit en cours." };
  }
  if (montantM > totalDuM) {
    return {
      ok: false,
      erreur: `Le versement (${fromMillimes(montantM)} DT) dépasse ce que la cliente doit (${fromMillimes(totalDuM)} DT).`,
    };
  }

  const imputations: Imputation[] = [];
  let resteAVerser = montantM;
  for (const c of ouverts) {
    if (resteAVerser === 0) break;
    const impute = Math.min(resteAVerser, c.dueM);
    resteAVerser -= impute;
    const resteApres = c.dueM - impute;
    imputations.push({
      saleId: c.saleId,
      montantImpute: fromMillimes(impute),
      resteApres: fromMillimes(resteApres),
      soldee: resteApres === 0,
    });
  }
  return { ok: true, imputations };
}

// ---------------------------------------------------------------------------
// Dates de calendrier (heure de Tunis)
// ---------------------------------------------------------------------------

/** "AAAA-MM-JJ" du jour, a Tunis. */
export function jourTunis(d: Date): string {
  // en-CA formate en AAAA-MM-JJ, l'ordre qui se compare comme une chaine.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSEAU,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function jourVersUtc(jour: string): number {
  const [a, m, j] = jour.split("-").map(Number);
  return Date.UTC(a, m - 1, j);
}

function utcVersJour(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Jours de calendrier ecoules depuis la vente (0 le jour meme). */
export function ancienneteJours(createdAt: Date, maintenant: Date): number {
  const n = Math.round((jourVersUtc(jourTunis(maintenant)) - jourVersUtc(jourTunis(createdAt))) / MS_JOUR);
  return Math.max(0, n);
}

/**
 * En retard si la date promise est DEPASSEE (payer le jour promis n'est pas
 * un retard), ou, sans date promise, au-dela de JOURS_AVANT_RETARD jours.
 */
export function estEnRetard(args: {
  createdAt: Date;
  dueDate: Date | null;
  maintenant: Date;
}): boolean {
  if (args.dueDate) return jourTunis(args.maintenant) > jourTunis(args.dueDate);
  return ancienneteJours(args.createdAt, args.maintenant) > JOURS_AVANT_RETARD;
}

/** "JJ/MM" — la forme des puces et des pastilles. */
export function formatJourMois(d: Date): string {
  const [, m, j] = jourTunis(d).split("-");
  return `${j}/${m}`;
}

/** "JJ/MM/AAAA" — la forme du recu. */
export function formatDateCourte(d: Date): string {
  const [a, m, j] = jourTunis(d).split("-");
  return `${j}/${m}/${a}`;
}

/**
 * Midi UTC du jour donne : stocke ainsi, `dueDate` retombe sur le meme jour
 * de calendrier a Tunis (UTC+1) comme sur un serveur en UTC. Minuit aurait pu
 * basculer sur la veille selon le fuseau de lecture.
 */
export function dateEcheance(jour: string): Date {
  return new Date(jourVersUtc(jour) + 12 * 60 * 60 * 1000);
}

export type Echeances = {
  samedi: string;
  uneSemaine: string;
  finDuMois: string;
};

/**
 * Les trois echeances proposees par des puces, en "AAAA-MM-JJ".
 *
 * - Samedi : le PROCHAIN samedi, jamais aujourd'hui — une cliente qui promet
 *   « samedi » un samedi parle de la semaine suivante.
 * - Fin du mois : le dernier jour du mois ; le dernier jour lui-meme, on
 *   propose la fin du mois suivant, pour la meme raison.
 */
export function echeancesProposees(maintenant: Date): Echeances {
  const aujourdhui = jourTunis(maintenant);
  const msJour = jourVersUtc(aujourdhui);
  const jourSemaine = new Date(msJour).getUTCDay(); // 0 = dimanche, 6 = samedi
  const jusquaSamedi = ((6 - jourSemaine + 7) % 7) || 7;

  const d = new Date(msJour);
  let finMois = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0);
  if (finMois === msJour) finMois = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 2, 0);

  return {
    samedi: utcVersJour(msJour + jusquaSamedi * MS_JOUR),
    uneSemaine: utcVersJour(msJour + 7 * MS_JOUR),
    finDuMois: utcVersJour(finMois),
  };
}

/**
 * Lit la date promise envoyee par la caisse ("AAAA-MM-JJ" ou ISO).
 * `null`/absente = « Sans date », accepte. Refuse une date passee (elle
 * mettrait la vente en retard des sa creation) et une date au-dela d'un an.
 */
export function lireEcheance(
  valeur: string | null | undefined,
  maintenant: Date,
): { ok: true; dueDate: Date | null } | Refus {
  if (valeur === null || valeur === undefined || valeur === "") return { ok: true, dueDate: null };
  const jour = /^\d{4}-\d{2}-\d{2}$/.test(valeur) ? valeur : null;
  const brute = jour ? dateEcheance(jour) : new Date(valeur);
  if (Number.isNaN(brute.getTime())) {
    return { ok: false, erreur: "Date de retour invalide." };
  }
  const due = dateEcheance(jourTunis(brute));
  const aujourdhui = jourTunis(maintenant);
  if (jourTunis(due) < aujourdhui) {
    return { ok: false, erreur: "La date de retour est déjà passée." };
  }
  if (ancienneteJours(maintenant, due) > ECHEANCE_MAX_JOURS) {
    return { ok: false, erreur: "La date de retour est à plus d'un an." };
  }
  return { ok: true, dueDate: due };
}

// ---------------------------------------------------------------------------
// Effacer une dette
// ---------------------------------------------------------------------------

export const MOTIF_EFFACEMENT_MIN = 5;

/** Motif nettoye, ou refus. Le motif est la seule trace : il est obligatoire. */
export function lireMotifEffacement(motif: unknown): { ok: true; motif: string } | Refus {
  const texte = typeof motif === "string" ? motif.trim().replace(/\s+/g, " ") : "";
  if (texte.length < MOTIF_EFFACEMENT_MIN) {
    return {
      ok: false,
      erreur: `Indiquez pourquoi la dette est effacée (au moins ${MOTIF_EFFACEMENT_MIN} caractères).`,
    };
  }
  return { ok: true, motif: texte.slice(0, 500) };
}

// ---------------------------------------------------------------------------
// Page Credits : regroupement par cliente
// ---------------------------------------------------------------------------

export type VenteACredit = {
  id: string;
  customerId: string;
  receiptNumber: string;
  createdAt: Date;
  total: Money;
  amountDue: Money;
  dueDate: Date | null;
  resume: string;
};

export type CreditCliente = {
  customerId: string;
  totalDu: string;
  plusAncienne: Date;
  dueDateLaPlusProche: Date | null;
  enRetard: boolean;
  ventes: Array<Omit<VenteACredit, "total" | "amountDue"> & { total: string; amountDue: string; enRetard: boolean }>;
};

export type FiltreCredits = "toutes" | "retard" | "semaine";

/**
 * Une ligne par cliente, les plus anciens credits d'abord : c'est l'ordre des
 * appels a passer. Une cliente est en retard des qu'UNE de ses ventes l'est.
 */
export function grouperCreditsParCliente(ventes: VenteACredit[], maintenant: Date): CreditCliente[] {
  const parCliente = new Map<string, VenteACredit[]>();
  for (const v of ventes) {
    if (toMillimes(v.amountDue) <= 0) continue;
    const liste = parCliente.get(v.customerId) ?? [];
    liste.push(v);
    parCliente.set(v.customerId, liste);
  }
  const resultat: CreditCliente[] = [];
  for (const [customerId, liste] of parCliente) {
    liste.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const lignes = liste.map((v) => ({
      ...v,
      total: fromMillimes(toMillimes(v.total)),
      amountDue: fromMillimes(toMillimes(v.amountDue)),
      enRetard: estEnRetard({ createdAt: v.createdAt, dueDate: v.dueDate, maintenant }),
    }));
    const echeances = liste
      .map((v) => v.dueDate)
      .filter((d): d is Date => d !== null)
      .sort((a, b) => a.getTime() - b.getTime());
    resultat.push({
      customerId,
      totalDu: fromMillimes(liste.reduce((s, v) => s + toMillimes(v.amountDue), 0)),
      plusAncienne: liste[0].createdAt,
      dueDateLaPlusProche: echeances[0] ?? null,
      enRetard: lignes.some((l) => l.enRetard),
      ventes: lignes,
    });
  }
  return resultat.sort((a, b) => a.plusAncienne.getTime() - b.plusAncienne.getTime());
}

/**
 * « Promis cette semaine » = une date promise entre aujourd'hui et dans 7
 * jours, bornes comprises. Une date deja depassee releve du filtre « En
 * retard », pas de celui-ci.
 */
export function filtrerCredits(
  clientes: CreditCliente[],
  filtre: FiltreCredits,
  maintenant: Date,
): CreditCliente[] {
  if (filtre === "retard") return clientes.filter((c) => c.enRetard);
  if (filtre === "semaine") {
    const debut = jourTunis(maintenant);
    const fin = utcVersJour(jourVersUtc(debut) + 7 * MS_JOUR);
    return clientes.filter((c) =>
      c.ventes.some((v) => {
        if (!v.dueDate) return false;
        const j = jourTunis(v.dueDate);
        return j >= debut && j <= fin;
      }),
    );
  }
  return clientes;
}

/** Les trois tuiles de tete. Calculees AVANT filtre : ce sont les totaux du salon. */
export function totauxCredits(clientes: CreditCliente[]): {
  aRecuperer: string;
  clientes: number;
  enRetard: number;
} {
  return {
    aRecuperer: fromMillimes(clientes.reduce((s, c) => s + toMillimes(c.totalDu), 0)),
    clientes: clientes.length,
    enRetard: clientes.filter((c) => c.enRetard).length,
  };
}

/**
 * Recherche de la page Credits : chiffres → dans le telephone, sinon dans
 * le nom, sans accents ni majuscules (« amira » trouve « Amîra »). Meme
 * normalisation que les suggestions de la caisse. Filtre en memoire : un
 * salon a quelques dizaines de credits, pas des milliers.
 */
export function correspondRecherche(
  cliente: { firstName: string | null; lastName: string | null; phone: string },
  q: string,
): boolean {
  const requete = q.trim();
  if (!requete) return true;
  if (/^[\d+\s().-]+$/.test(requete)) {
    const chiffres = requete.replace(/\D/g, "");
    if (!chiffres) return true;
    if (cliente.phone.startsWith("walk-in")) return false;
    return cliente.phone.replace(/\D/g, "").includes(chiffres);
  }
  const nom = normaliser(`${cliente.firstName ?? ""} ${cliente.lastName ?? ""}`);
  return normaliser(requete)
    .split(" ")
    .filter(Boolean)
    .every((mot) => nom.includes(mot));
}
