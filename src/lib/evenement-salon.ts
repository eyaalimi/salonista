/**
 * Les signaux d'activite d'un salon — decisions pures, sans Prisma.
 *
 * POURQUOI UNE TABLE A PART, ET SURTOUT PAS `CampaignEvent`.
 * `CampaignEvent` compte des VISITEURS ANONYMES : un identifiant tire au
 * hasard, aucune IP, et des chiffres qui servent a decider ou va le budget
 * publicitaire. Y verser l'activite des salons deja inscrits gonflerait les
 * etapes de l'entonnoir avec des gens qui ont deja converti — on couperait
 * une campagne qui marche en croyant lire ses resultats. Les deux tables
 * repondent a deux questions differentes : « d'ou viennent les inscriptions »
 * et « ou ce salon-la bute ».
 *
 * CE QUI N'ENTRE JAMAIS DANS UN EVENEMENT : un mot de passe, un PIN, une
 * adresse e-mail saisie. On enregistre QU'UN echec a eu lieu, jamais avec
 * quoi. Une IP conservee l'est hachee, comme dans `SuperadminAuditLog`.
 *
 * Aucun acces base ici : l'ecriture vit dans `evenement-salon-ecriture.ts`,
 * et ces decisions se testent sans mock.
 */

/**
 * Les types d'evenements.
 *
 * Chaine et non enum Prisma : ajouter un signal ne doit pas imposer une
 * migration, et ces valeurs sont relues par des humains dans le cockpit
 * d'appels. Meme choix que `SuperadminAuditLog.action`.
 */
export const EVENEMENTS = {
  /** Mot de passe refuse, sur un compte QUI EXISTE et tient un salon. */
  CONNEXION_MDP_INCORRECT: "connexion.mot_de_passe_incorrect",
  /** Connexion refusee faute d'e-mail verifie. */
  CONNEXION_EMAIL_NON_VERIFIE: "connexion.email_non_verifie",
  /** PIN d'employee refuse. */
  PIN_INCORRECT: "pin.incorrect",
  /** PIN verrouille apres trop d'echecs. */
  PIN_VERROUILLAGE: "pin.verrouillage",
  /** Vente en especes refusee parce qu'aucun tiroir n'etait ouvert. */
  VENTE_REFUSEE_TIROIR_FERME: "caisse.vente_refusee_tiroir_ferme",
  /** L'ecran de paiement s'est ouvert. Un abandon se DEDUIT, voir plus bas. */
  PAIEMENT_OUVERT: "caisse.paiement_ouvert",
  /** Une employee a ouvert un ecran. Deduplique, voir `doitEnregistrerVisite`. */
  ECRAN_VISITE: "ecran.visite",
  /** L'application a ete installee depuis le compte d'un salon connecte. */
  APP_INSTALLEE: "app.installee",
} as const;

export type TypeEvenement = (typeof EVENEMENTS)[keyof typeof EVENEMENTS];

/** Les ecrans dont on suit l'ouverture. */
export const ECRANS_SUIVIS = ["services", "reglages", "caisse"] as const;
export type EcranSuivi = (typeof ECRANS_SUIVIS)[number];

export function estEcranSuivi(valeur: unknown): valeur is EcranSuivi {
  return (
    typeof valeur === "string" &&
    (ECRANS_SUIVIS as readonly string[]).includes(valeur)
  );
}

/**
 * Fenetre de deduplication des visites d'ecran, en minutes.
 *
 * Sans elle, une caissiere qui fait des allers-retours entre la grille et le
 * panier ecrirait des centaines de lignes par heure, et « a ouvert Services
 * 4 fois sans rien creer » ne voudrait plus rien dire : on ne compterait plus
 * des VISITES mais des clics. Trente minutes separent deux vraies sessions de
 * travail.
 */
export const FENETRE_VISITE_MINUTES = 30;

/**
 * Faut-il enregistrer cette visite d'ecran ?
 *
 * `dernierePour` est la date du dernier evenement du MEME ecran par la MEME
 * employee — `null` si elle n'en a jamais eu.
 */
export function doitEnregistrerVisite(
  dernierePour: Date | null,
  maintenant: Date = new Date(),
): boolean {
  if (dernierePour === null) return true;
  const ecartMs = maintenant.getTime() - dernierePour.getTime();
  // Un ecart negatif (horloge client en avance, rejeu) est traite comme
  // « trop recent » : on n'ecrit pas.
  if (ecartMs < 0) return false;
  return ecartMs >= FENETRE_VISITE_MINUTES * 60_000;
}

/**
 * Delai au-dela duquel un ecran de paiement ouvert sans vente compte comme
 * un panier abandonne, en minutes.
 *
 * POURQUOI ON NE CAPTE PAS LA FERMETURE DE L'ONGLET. `beforeunload` ne part
 * pas de maniere fiable — iOS ne l'emet pratiquement jamais, et une tablette
 * qui se met en veille ne previent personne. Un abandon qu'on croit mesurer
 * mais qui remonte une fois sur trois est pire qu'un abandon calcule : on
 * batirait une conversation telephonique sur un chiffre faux. On DEDUIT donc
 * l'abandon de ce qu'on sait de source sure : l'ecran s'est ouvert, et
 * aucune vente n'a suivi.
 *
 * Quinze minutes : au-dela, ce n'est plus une cliente qui cherche sa monnaie.
 */
export const DELAI_ABANDON_MINUTES = 15;

export type OuverturePaiement = {
  /** Quand l'ecran de paiement s'est ouvert. */
  a: Date;
  /** L'employee qui l'a ouvert, si connue. */
  employeeId?: string | null;
};

/**
 * Combien de paniers abandonnes dans cette serie d'ouvertures ?
 *
 * Une ouverture compte comme abandonnee quand AUCUNE vente n'a ete
 * enregistree dans les `DELAI_ABANDON_MINUTES` qui suivent.
 *
 * Deux garde-fous qui evitent de compter a tort :
 *
 *  - une ouverture trop RECENTE (moins de 15 min) n'est pas comptee : la
 *    vente est peut-etre en cours. La compter ferait apparaitre un abandon
 *    a chaque encaissement observe en direct ;
 *  - une vente posterieure a l'ouverture, meme de quelques secondes, annule
 *    l'abandon — c'est exactement le cas nominal.
 */
export function compterPaniersAbandonnes(
  ouvertures: readonly OuverturePaiement[],
  ventesA: readonly Date[],
  maintenant: Date = new Date(),
): number {
  const delaiMs = DELAI_ABANDON_MINUTES * 60_000;
  const ventes = [...ventesA].sort((a, b) => a.getTime() - b.getTime());

  let total = 0;
  for (const o of ouvertures) {
    const fin = o.a.getTime() + delaiMs;
    // Trop recent pour conclure : la vente peut encore arriver.
    if (maintenant.getTime() < fin) continue;
    const suivie = ventes.some((v) => {
      const t = v.getTime();
      return t >= o.a.getTime() && t <= fin;
    });
    if (!suivie) total++;
  }
  return total;
}

/**
 * Les types qui constituent une ALERTE DE SECURITE ouverte.
 *
 * Ce sont ceux qui font remonter un salon en tete de la file d'appels : une
 * employee bloquee dehors ne peut pas encaisser, et elle n'appellera pas
 * forcement pour le dire.
 */
export const TYPES_ALERTE: readonly TypeEvenement[] = [
  EVENEMENTS.PIN_VERROUILLAGE,
  EVENEMENTS.PIN_INCORRECT,
  EVENEMENTS.CONNEXION_MDP_INCORRECT,
];

/**
 * Nombre d'echecs sur la fenetre au-dela duquel on parle d'alerte, meme sans
 * verrouillage. Cinq : en dessous, c'est une faute de frappe ordinaire.
 */
export const SEUIL_ECHECS_ALERTE = 5;

/** Fenetre d'observation des alertes, en jours. */
export const FENETRE_ALERTE_JOURS = 7;

export type CompteursSecurite = {
  /** Verrouillages de PIN sur la fenetre. */
  verrouillages: number;
  /** Echecs de PIN sur la fenetre. */
  pinIncorrects: number;
  /** Mots de passe refuses sur la fenetre. */
  mdpIncorrects: number;
};

/**
 * Ce salon a-t-il une alerte de securite ouverte ?
 *
 * Un verrouillage suffit a lui seul : quelqu'un est dehors MAINTENANT.
 * Sinon, il faut au moins `SEUIL_ECHECS_ALERTE` echecs cumules sur la
 * fenetre — PIN et mot de passe confondus, parce que les deux racontent la
 * meme chose : on n'arrive plus a entrer.
 */
export function aUneAlerteSecurite(c: CompteursSecurite): boolean {
  if (c.verrouillages > 0) return true;
  return c.pinIncorrects + c.mdpIncorrects >= SEUIL_ECHECS_ALERTE;
}

/** Libelles lisibles, pour l'activite recente du cockpit. */
export const LIBELLE_EVENEMENT: Record<string, string> = {
  [EVENEMENTS.CONNEXION_MDP_INCORRECT]: "Mot de passe incorrect",
  [EVENEMENTS.CONNEXION_EMAIL_NON_VERIFIE]: "Connexion refusée — e-mail non vérifié",
  [EVENEMENTS.PIN_INCORRECT]: "PIN incorrect",
  [EVENEMENTS.PIN_VERROUILLAGE]: "PIN verrouillé",
  [EVENEMENTS.VENTE_REFUSEE_TIROIR_FERME]: "Vente refusée — tiroir fermé",
  [EVENEMENTS.PAIEMENT_OUVERT]: "Écran de paiement ouvert",
  [EVENEMENTS.ECRAN_VISITE]: "Écran ouvert",
  [EVENEMENTS.APP_INSTALLEE]: "Application installée",
};

export function libelleEvenement(type: string): string {
  return LIBELLE_EVENEMENT[type] ?? type;
}
