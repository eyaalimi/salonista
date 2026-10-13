/**
 * Le cockpit d'appels — decisions pures, sans Prisma.
 *
 * Quatre questions, quatre fonctions : a quelle marche ce salon s'est-il
 * arrete (`marcheBloquante`), qui rappeler d'abord (`prioriteAppel`), ou en
 * est-il globalement (`scoreSante`), et que lui demander au telephone
 * (`questionsAPoser`).
 *
 * CE FICHIER NE REDEFINIT RIEN. « Salon actif » vit dans `campagne-tableau.ts`,
 * le seuil d'inactivite dans `vue-ensemble.ts`, les etapes de demarrage dans
 * `onboarding-salon.ts`, le remplissage du profil dans
 * `profil-salon-complet.ts`. Les redire ici les ferait diverger — et deux
 * ecrans du superadmin donneraient deux reponses differentes sur le meme
 * salon.
 */

import { estActif, type SignesDeVie } from "./campagne-tableau";
import { SEUIL_INACTIF_JOURS } from "./vue-ensemble";
import { etapesDemarrage, type ProfilSalon } from "./onboarding-salon";
import { aUneAlerteSecurite, type CompteursSecurite } from "./evenement-salon";

/* ------------------------------------------------------------------ *
 *  L'ENTONNOIR D'ACTIVATION
 * ------------------------------------------------------------------ */

/**
 * Les sept marches, dans l'ordre ou un salon les franchit.
 *
 * ORDRE DELIBERE : chacune suppose la precedente. On ne peut pas encaisser
 * sans tiroir, ni ouvrir un tiroir sans catalogue. Un salon est range a la
 * PREMIERE qu'il n'a pas franchie — c'est elle qu'on vient debloquer au
 * telephone, pas la derniere.
 */
export const MARCHES = [
  "inscrit",
  "email_verifie",
  "profil",
  "catalogue",
  "tiroir",
  "premiere_vente",
  "actif",
] as const;

export type Marche = (typeof MARCHES)[number];

export const LIBELLE_MARCHE: Record<Marche, string> = {
  inscrit: "Inscrits",
  email_verifie: "E-mail vérifié",
  profil: "Profil prêt",
  catalogue: "Catalogue prêt",
  tiroir: "Tiroir ouvert",
  premiere_vente: "1re vente",
  actif: "Actifs sur 7 jours",
};

/**
 * Ce qu'il faut savoir d'un salon pour le situer dans l'entonnoir.
 *
 * `profil` et `nombreOffres` sont passes tels quels a `etapesDemarrage` :
 * c'est lui qui decide ce qu'est un profil rempli, pas ce fichier.
 */
export type SalonPourMarche = SignesDeVie & {
  emailVerifie: boolean;
  profil: ProfilSalon;
  nombreOffres: number;
  /** Un tiroir a-t-il deja ete ouvert, meme referme depuis ? */
  tiroirDejaOuvert: boolean;
  /** Date de la premiere vente, `null` si le salon n'a jamais encaisse. */
  premiereVenteAt: Date | null;
};

/**
 * Les trois etapes de `etapesDemarrage` reparties sur DEUX marches.
 *
 * `etapesDemarrage` rend : [profil, premier service, horaires]. L'entonnoir
 * n'en veut que deux. Les HORAIRES rejoignent « Profil prêt » parce que sans
 * eux aucun creneau n'est genere : le salon se croit en ligne alors que
 * personne ne peut reserver. Un profil sans horaires n'est pas pret.
 */
function profilEtCatalogue(s: SalonPourMarche): {
  profilPret: boolean;
  cataloguePret: boolean;
} {
  const [profil, service, horaires] = etapesDemarrage(s.profil, s.nombreOffres);
  return {
    profilPret: profil.faite && horaires.faite,
    cataloguePret: service.faite,
  };
}

/**
 * La premiere marche que ce salon n'a PAS franchie, ou `null` s'il les a
 * toutes passees.
 *
 * `null` veut dire « rien a debloquer » : le salon est actif et vend. Il ne
 * doit donc apparaitre dans aucune file d'appels.
 */
export function marcheBloquante(
  s: SalonPourMarche,
  maintenant: Date = new Date(),
): Marche | null {
  if (!s.emailVerifie) return "email_verifie";

  const { profilPret, cataloguePret } = profilEtCatalogue(s);
  if (!profilPret) return "profil";
  if (!cataloguePret) return "catalogue";

  if (!s.tiroirDejaOuvert) return "tiroir";
  if (s.premiereVenteAt === null) return "premiere_vente";

  const il7 = new Date(maintenant);
  il7.setDate(il7.getDate() - 7);
  // `estActif` est la DEFINITION du projet : une vente OU une connexion.
  if (!estActif(s, il7, maintenant)) return "actif";

  return null;
}

/** Un salon a-t-il franchi une marche donnee ? */
export function aFranchi(
  s: SalonPourMarche,
  marche: Marche,
  maintenant: Date = new Date(),
): boolean {
  const bloquante = marcheBloquante(s, maintenant);
  if (bloquante === null) return true;
  // Il a franchi tout ce qui precede sa marche bloquante.
  return MARCHES.indexOf(marche) < MARCHES.indexOf(bloquante);
}

export type LigneEntonnoir = {
  marche: Marche;
  libelle: string;
  /** Combien de salons ont franchi cette marche. */
  atteint: number;
  /** Part des inscrits, 0 a 100. */
  pourcentage: number;
  /** Combien sont bloques ICI, c'est-a-dire n'ont pas franchi la suivante. */
  bloques: number;
  /** Cette marche est-elle la plus grosse perte de l'entonnoir ? */
  plusGrossePerte: boolean;
};

/**
 * L'entonnoir complet.
 *
 * « Bloques ici » n'est PAS « n'a pas atteint » : c'est le nombre de salons
 * dont c'est exactement la marche bloquante. Un salon sans e-mail verifie est
 * bloque a « E-mail verifie » et nulle part ailleurs — sinon il compterait
 * dans les six marches suivantes, et la file d'appels serait pleine de
 * doublons.
 */
export function construireEntonnoir(
  salons: readonly SalonPourMarche[],
  maintenant: Date = new Date(),
): LigneEntonnoir[] {
  const total = salons.length;
  const bloquesPar = new Map<Marche, number>();
  for (const m of MARCHES) bloquesPar.set(m, 0);

  for (const s of salons) {
    const b = marcheBloquante(s, maintenant);
    if (b) bloquesPar.set(b, (bloquesPar.get(b) ?? 0) + 1);
  }

  // Atteint = inscrits moins tous ceux bloques AVANT cette marche.
  const lignes: LigneEntonnoir[] = [];
  let perdusAvant = 0;
  for (const marche of MARCHES) {
    const atteint = total - perdusAvant;
    lignes.push({
      marche,
      libelle: LIBELLE_MARCHE[marche],
      atteint,
      pourcentage: total === 0 ? 0 : Math.round((atteint / total) * 100),
      bloques: bloquesPar.get(marche) ?? 0,
      plusGrossePerte: false,
    });
    perdusAvant += bloquesPar.get(marche) ?? 0;
  }

  // La plus grosse perte : celle ou le plus de salons s'arretent. En cas
  // d'egalite, la PLUS PRECOCE gagne — c'est elle qui bloque le plus de
  // monde en amont, et la debloquer libere aussi les marches suivantes.
  let maxi = 0;
  for (const l of lignes) if (l.bloques > maxi) maxi = l.bloques;
  if (maxi > 0) {
    const premiere = lignes.find((l) => l.bloques === maxi);
    if (premiere) premiere.plusGrossePerte = true;
  }

  return lignes;
}

/* ------------------------------------------------------------------ *
 *  LA PRIORITE D'APPEL
 * ------------------------------------------------------------------ */

export type SalonPourPriorite = SalonPourMarche & {
  id: string;
  salonName: string;
  city: string | null;
  inscritLe: Date;
  suspendu: boolean;
  securite: CompteursSecurite;
};

/**
 * Les trois rangs d'urgence. Plus petit = plus urgent.
 *
 * 0 — ALERTE DE SECURITE. Une employee verrouillee ne peut pas encaisser, et
 *     elle n'appellera pas forcement pour le dire. C'est le seul cas ou le
 *     salon perd de l'argent maintenant.
 * 1 — JAMAIS ENCAISSE. La regle de la section 27 : les plus RECENTS d'abord,
 *     un salon inscrit il y a trois jours se rattrape d'un appel, celui d'il
 *     y a six mois beaucoup moins.
 * 2 — LE RESTE, du plus proche de la premiere vente au plus loin : un salon
 *     bloque au tiroir est a un geste de vendre, celui qui n'a pas verifie
 *     son e-mail en est a six.
 */
export const RANG_ALERTE = 0;
export const RANG_JAMAIS_VENDU = 1;
export const RANG_AUTRE = 2;

export type Priorite = {
  rang: number;
  /** Cle de tri secondaire, croissante. */
  cle: number;
};

export function prioriteAppel(
  s: SalonPourPriorite,
  maintenant: Date = new Date(),
): Priorite {
  if (aUneAlerteSecurite(s.securite)) {
    // Entre deux alertes, le salon inscrit le plus recemment d'abord : il est
    // encore en train de decouvrir le produit, et un blocage maintenant lui
    // fait abandonner.
    return { rang: RANG_ALERTE, cle: -s.inscritLe.getTime() };
  }

  if (s.premiereVenteAt === null) {
    return { rang: RANG_JAMAIS_VENDU, cle: -s.inscritLe.getTime() };
  }

  // Les autres : du plus avance au moins avance dans l'entonnoir.
  const b = marcheBloquante(s, maintenant);
  const distance = b === null ? MARCHES.length : MARCHES.length - MARCHES.indexOf(b);
  return { rang: RANG_AUTRE, cle: distance };
}

/**
 * La file d'appels, les plus urgents d'abord.
 *
 * LES SALONS SUSPENDUS SONT EXCLUS : leur silence est notre decision, pas
 * leur abandon. Meme regle que `salonsARappeler`.
 *
 * Les salons sans aucun blocage (`marcheBloquante === null`) sortent aussi :
 * ils vendent et sont actifs, il n'y a rien a leur dire.
 */
export function fileDAppels<T extends SalonPourPriorite>(
  salons: readonly T[],
  maintenant: Date = new Date(),
): T[] {
  return salons
    .filter((s) => !s.suspendu)
    .filter(
      (s) =>
        marcheBloquante(s, maintenant) !== null || aUneAlerteSecurite(s.securite),
    )
    .sort((a, b) => {
      const pa = prioriteAppel(a, maintenant);
      const pb = prioriteAppel(b, maintenant);
      if (pa.rang !== pb.rang) return pa.rang - pb.rang;
      if (pa.cle !== pb.cle) return pa.cle - pb.cle;
      // Dernier recours : un ordre stable, pour que deux chargements de la
      // page ne reclassent pas la liste sous les yeux de l'appelant.
      return a.id.localeCompare(b.id);
    });
}

/* ------------------------------------------------------------------ *
 *  LE SCORE DE SANTE
 * ------------------------------------------------------------------ */

/** Points attribues aux marches franchies. */
export const POINTS_MARCHES = 60;
/** Points attribues a l'activite des 7 derniers jours. */
export const POINTS_ACTIVITE = 30;
/** Points retires par une alerte de securite ouverte. */
export const MALUS_ALERTE = 10;

/**
 * Un score de 0 a 100, ou `null` pour un salon suspendu.
 *
 * POURQUOI PAS DE SCORE POUR UN SUSPENDU. Son inactivite est notre decision :
 * lui donner 10/100 laisserait croire a un client en perdition alors qu'on a
 * nous-memes coupe l'acces. Afficher « — » est la seule lecture honnete.
 *
 * Les 60 points des marches se comptent sur les SIX marches franchissables
 * apres l'inscription : « Inscrits » est acquise par definition, la compter
 * donnerait 10/100 a un salon qui n'a rien fait du tout.
 */
export function scoreSante(
  s: SalonPourPriorite,
  maintenant: Date = new Date(),
): number | null {
  if (s.suspendu) return null;

  const franchissables = MARCHES.slice(1);
  let franchies = 0;
  for (const m of franchissables) {
    if (aFranchi(s, m, maintenant)) franchies += 1;
  }
  let score = Math.round((franchies / franchissables.length) * POINTS_MARCHES);

  const il7 = new Date(maintenant);
  il7.setDate(il7.getDate() - 7);
  if (estActif(s, il7, maintenant)) score += POINTS_ACTIVITE;

  if (aUneAlerteSecurite(s.securite)) score -= MALUS_ALERTE;

  return Math.max(0, Math.min(100, score));
}

/* ------------------------------------------------------------------ *
 *  LES QUESTIONS A POSER
 * ------------------------------------------------------------------ */

export type Question = {
  /** La question, telle qu'on la pose. Vouvoiement : elle est DITE. */
  question: string;
  /** Pourquoi on la pose — pour l'appelant, pas pour le salon. */
  parceQue: string;
};

export type SignauxQuestions = {
  emailVerifie: boolean;
  horairesRenseignes: boolean;
  /** Champs de profil manquants, libelles — vient de `completionProfil`. */
  champsManquants: readonly string[];
  /** Au moins une employee verrouillee en ce moment. */
  employeeVerrouillee: boolean;
  /** Paniers abandonnes sur la periode. */
  paniersAbandonnes: number;
  /** Ventes refusees faute de tiroir ouvert. */
  ventesRefuseesTiroir: number;
  /** Un tiroir a ete ouvert mais jamais cloture. */
  tiroirJamaisCloture: boolean;
  /** Aucun service au catalogue. */
  catalogueVide: boolean;
  /** Services publies sans photo — invisibles sur la place de marche. */
  servicesSansPhoto: number;
};

/** Au-dela, l'appel devient un interrogatoire. */
export const MAX_QUESTIONS = 4;

/**
 * Les questions a poser, de la plus urgente a la moins urgente, au plus
 * `MAX_QUESTIONS`.
 *
 * ORDRE : ce qui EMPECHE de travailler d'abord (personne dehors, caisse
 * bloquee), puis ce qui empeche de vendre (pas de catalogue, pas d'horaires),
 * puis ce qui se rattrape plus tard (champs manquants, photos).
 *
 * CES PHRASES SONT DITES AU TELEPHONE. Vouvoiement, pas de jargon, et une
 * question a la fois — « on les ajoute ensemble ? » obtient un oui, « votre
 * profil est incomplet » obtient un silence.
 */
export function questionsAPoser(s: SignauxQuestions): Question[] {
  const toutes: Question[] = [];

  if (s.employeeVerrouillee) {
    toutes.push({
      question: "On réinitialise son code PIN ensemble ?",
      parceQue: "Une employée est bloquée et ne peut plus encaisser.",
    });
  }

  if (s.ventesRefuseesTiroir > 0) {
    toutes.push({
      question: "Savez-vous ouvrir la caisse le matin ?",
      parceQue: `${s.ventesRefuseesTiroir} encaissement(s) refusé(s) faute de tiroir ouvert.`,
    });
  }

  if (!s.emailVerifie) {
    toutes.push({
      question: "Avez-vous reçu l'e-mail de confirmation ?",
      parceQue: "Sans vérification, la connexion est refusée.",
    });
  }

  if (s.paniersAbandonnes > 0) {
    toutes.push({
      question: "Qu'est-ce qui bloque au moment de payer ?",
      parceQue: `${s.paniersAbandonnes} panier(s) ouvert(s) sans encaissement.`,
    });
  }

  if (s.catalogueVide) {
    toutes.push({
      question: "On ajoute vos premiers services ensemble ?",
      parceQue: "Sans service au catalogue, rien ne peut être encaissé.",
    });
  }

  if (!s.horairesRenseignes) {
    toutes.push({
      question: "Sans horaires, aucune cliente ne peut réserver : on les ajoute ensemble ?",
      parceQue: "Aucun créneau n'est généré tant que les horaires manquent.",
    });
  }

  if (s.tiroirJamaisCloture) {
    toutes.push({
      question: "Savez-vous clôturer la caisse le soir ?",
      parceQue: "Un tiroir ouvert sans clôture fausse le rapport du lendemain.",
    });
  }

  if (s.servicesSansPhoto > 0) {
    toutes.push({
      question: "On ajoute une photo à vos services ?",
      parceQue: `${s.servicesSansPhoto} service(s) sans photo, donc invisibles pour les clientes.`,
    });
  }

  if (s.champsManquants.length > 0) {
    // On NOMME ce qui manque : « il vous manque l'adresse et le matricule »
    // est un motif d'appel, « votre profil est incomplet » n'en est pas un.
    toutes.push({
      question: `Pouvons-nous compléter ${s.champsManquants.slice(0, 3).join(", ")} ?`,
      parceQue: "Ces informations servent à votre facturation.",
    });
  }

  return toutes.slice(0, MAX_QUESTIONS);
}

/** Jours ecoules depuis une date, ou `null`. */
export function joursDepuis(d: Date | null, maintenant: Date = new Date()): number | null {
  if (!d) return null;
  return Math.floor((maintenant.getTime() - d.getTime()) / 86_400_000);
}

/** Le seuil d'inactivite, reexporte pour l'interface — jamais redefini. */
export { SEUIL_INACTIF_JOURS };
