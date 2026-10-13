/**
 * L'offre de Salonista : la caisse est gratuite pour toujours, et trois
 * fonctions passent dans un abonnement Premium.
 *
 * Ce fichier est PUR — aucune base, aucun reseau — pour etre teste sans
 * mock. Le chargeur qui lit la base vit dans `plan-serveur.ts`.
 *
 * Les quatre etats d'un salon :
 *
 * | Etat                  | Quand                                              | Premium debloque |
 * |-----------------------|----------------------------------------------------|------------------|
 * | AVANT_PREMIERE_VENTE  | aucune vente encore : le compteur ne tourne pas    | oui              |
 * | ESSAI                 | le mois offert, compte depuis la PREMIERE VENTE    | oui              |
 * | PREMIUM               | ligne ACTIVE non echue, ou sans echeance (demo)    | oui              |
 * | GRATUIT               | tout le reste (essai ecoule, echue, SUSPENDED...)  | non              |
 *
 * UN SEUL MOIS OFFERT PAR SALON, A PARTIR DE SA PREMIERE VENTE. Un salon qui
 * passe une semaine a configurer ne perd pas une semaine d'essai. Mais un
 * salon qui vend depuis plus d'un mois a deja eu son mois : sans paiement, il
 * est en version gratuite. (Une version intermediaire faisait partir le mois
 * de l'inscription ; abandonnee a la demande du produit.)
 */

export const PRIX_PREMIUM_DT = 39;
export const DUREE_ESSAI_JOURS = 30;
/** Employees actives HORS gerante (role OWNER) en version gratuite. */
export const LIMITE_EMPLOYEES_GRATUIT = 1;

const JOUR_MS = 24 * 60 * 60 * 1000;

export type StatutAbonnement = "ACTIVE" | "SUSPENDED" | "EXPIRED" | "TRIAL";

/** La ligne `SalonSubscription` du module PREMIUM, ou null. */
export type LignePremium = {
  status: StatutAbonnement;
  expiresAt: Date | null;
};

export type Plan =
  /** Aucune vente : tout est debloque et le mois offert n'a pas commence. */
  | { etat: "AVANT_PREMIERE_VENTE" }
  | { etat: "ESSAI"; finEssai: Date; joursRestants: number }
  /** `jusquAu` null = sans echeance (salons de demonstration). */
  | { etat: "PREMIUM"; jusquAu: Date | null }
  /** `depuis` = fin de l'essai ou du Premium, null si inconnue. */
  | { etat: "GRATUIT"; depuis: Date | null };

export type Fonction = "FIDELITE" | "EQUIPE" | "COMMISSIONS";

export function finEssaiDepuis(debut: Date): Date {
  return new Date(debut.getTime() + DUREE_ESSAI_JOURS * JOUR_MS);
}

/** Jours restants arrondis au jour superieur : « encore 1 jour » jusqu'au bout. */
export function joursRestants(fin: Date, maintenant: Date): number {
  return Math.max(0, Math.ceil((fin.getTime() - maintenant.getTime()) / JOUR_MS));
}

/**
 * Une echeance est atteinte A l'instant exact qu'elle porte : meme regle que
 * `hasModule` (`expiresAt <= now` = echu), pour que les deux ne divergent pas.
 */
function echue(expiresAt: Date | null, maintenant: Date): boolean {
  return expiresAt !== null && expiresAt.getTime() <= maintenant.getTime();
}

function essai(fin: Date, maintenant: Date): Plan {
  if (echue(fin, maintenant)) return { etat: "GRATUIT", depuis: fin };
  return { etat: "ESSAI", finEssai: fin, joursRestants: joursRestants(fin, maintenant) };
}

export function calculerPlan(args: {
  premium: LignePremium | null;
  /** Premiere vente encaissee : le mois offert en part. */
  premiereVenteAt: Date | null;
  maintenant: Date;
}): Plan {
  const { premium, premiereVenteAt, maintenant } = args;

  if (!premium) {
    if (!premiereVenteAt) return { etat: "AVANT_PREMIERE_VENTE" };
    // Ligne pas encore posee (le chargeur la cree juste apres) : le mois
    // court depuis la premiere vente, et un mois deja ecoule l'est.
    return essai(finEssaiDepuis(premiereVenteAt), maintenant);
  }
  if (premium.status === "TRIAL") {
    // Un essai sans echeance n'est pose par aucun chemin du code ; s'il
    // apparait (saisie manuelle), on lui donne la duree normale.
    return essai(premium.expiresAt ?? finEssaiDepuis(premiereVenteAt ?? maintenant), maintenant);
  }

  if (premium.status === "ACTIVE" && !echue(premium.expiresAt, maintenant)) {
    return { etat: "PREMIUM", jusquAu: premium.expiresAt };
  }

  return { etat: "GRATUIT", depuis: premium.expiresAt };
}

/**
 * Une fonction Premium est-elle disponible ? Seul le plan decide.
 *
 * L'ancien module REWARDS n'ouvre PLUS la fidelite : une premiere version le
 * gardait « pour ne rien casser », et un salon en version gratuite voyait sa
 * page Fidelite ouverte. Decision produit : sans Premium, pas de fidelite.
 */
export function fonctionDisponible(plan: Plan, fonction: Fonction): boolean {
  return plan.etat !== "GRATUIT" || !FONCTIONS_PREMIUM.includes(fonction);
}

/** Ce que la version gratuite ne donne pas. */
const FONCTIONS_PREMIUM: readonly Fonction[] = ["FIDELITE", "EQUIPE", "COMMISSIONS"];

/* -------------------------------------------------------------------------- */
/* Equipe                                                                     */
/* -------------------------------------------------------------------------- */

export type EmployeeEquipe = {
  id: string;
  role: string;
  active: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
};

/** Employees actives qui comptent dans la limite : tout sauf la gerante. */
export function compterDansLimite<T extends EmployeeEquipe>(employees: T[]): T[] {
  return employees.filter((e) => e.active && e.role !== "OWNER");
}

/**
 * Peut-on ajouter (creer ou reactiver) une employee qui compte ?
 * `activesHorsOwner` = nombre ACTUEL, avant l'ajout.
 */
export function peutAjouterEmployee(equipeDisponible: boolean, activesHorsOwner: number): boolean {
  return equipeDisponible || activesHorsOwner < LIMITE_EMPLOYEES_GRATUIT;
}

/**
 * Qui garde son acces quand le salon passe en version gratuite avec trop
 * d'employees ?
 *
 * Par defaut, celle qui s'est connectee le plus recemment : c'est le meilleur
 * indice de qui travaille encore au salon. A egalite (jamais connectees), la
 * plus recemment creee. La gerante choisit ensuite si ce n'est pas la bonne.
 */
export function repartirEquipe<T extends EmployeeEquipe>(employees: T[]): {
  garder: T[];
  suspendre: T[];
} {
  const comptees = compterDansLimite(employees);
  const triees = [...comptees].sort((a, b) => {
    const la = a.lastLoginAt?.getTime() ?? -Infinity;
    const lb = b.lastLoginAt?.getTime() ?? -Infinity;
    if (la !== lb) return lb - la;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
  return {
    garder: triees.slice(0, LIMITE_EMPLOYEES_GRATUIT),
    suspendre: triees.slice(LIMITE_EMPLOYEES_GRATUIT),
  };
}

/* -------------------------------------------------------------------------- */
/* Fidelite                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * De combien reculer `lastActivityAt` au retour en Premium.
 *
 * Les mois passes en version gratuite ne doivent pas faire expirer les points
 * d'une cliente : elle ne pouvait ni en gagner ni en utiliser. On decale donc
 * sa derniere activite de la duree de la pause. Aucun decalage si la pause est
 * inconnue ou negative (Premium prolonge avant son echeance).
 */
export function decalagePauseMs(debutPause: Date | null, maintenant: Date): number {
  if (!debutPause) return 0;
  return Math.max(0, maintenant.getTime() - debutPause.getTime());
}

/* -------------------------------------------------------------------------- */
/* Activation par l'administration                                            */
/* -------------------------------------------------------------------------- */

/**
 * Ajoute N mois civils. Le 31 janvier + 1 mois donne le 28 (ou 29) fevrier,
 * pas le 3 mars : un mois paye ne doit pas deborder sur le suivant.
 */
export function ajouterMois(d: Date, mois: number): Date {
  const r = new Date(d.getTime());
  const jour = r.getUTCDate();
  r.setUTCDate(1);
  r.setUTCMonth(r.getUTCMonth() + mois);
  const dernierJour = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(jour, dernierJour));
  return r;
}

/**
 * Nouvelle echeance apres un paiement de N mois : on prolonge l'echeance
 * actuelle si elle est encore dans le futur (un salon qui paie en avance ne
 * perd pas ses jours restants), sinon on part d'aujourd'hui.
 */
export function nouvelleEcheancePremium(
  echeanceActuelle: Date | null,
  maintenant: Date,
  mois: number,
): Date {
  const depart =
    echeanceActuelle && echeanceActuelle.getTime() > maintenant.getTime()
      ? echeanceActuelle
      : maintenant;
  return ajouterMois(depart, mois);
}

export const DUREES_ACTIVATION_MOIS = [1, 3, 12] as const;

/* -------------------------------------------------------------------------- */
/* Bandeau de fin d'essai                                                     */
/* -------------------------------------------------------------------------- */

/** A partir de combien de jours restants le bandeau devient bien visible. */
export const ALERTE_FIN_ESSAI_JOURS = 7;

export type ChiffresFinEssai = {
  clientesAvecPoints: number;
  totalPoints: number;
  employeesHorsOwner: number;
  /** Montant des commissions non reglees, en DT (chaine a 3 decimales). */
  commissionsNonReglees: string;
};

const nombre = new Intl.NumberFormat("fr-FR");

/**
 * Les lignes « Sans Premium : … » du bandeau, avec les vrais chiffres du
 * salon. Seules les lignes non nulles sont rendues : annoncer « 0 clientes ne
 * pourront plus utiliser leurs 0 points » ferait fuir sans raison.
 */
export function lignesPerteFinEssai(c: ChiffresFinEssai): string[] {
  const lignes: string[] = [];
  if (c.clientesAvecPoints > 0 && c.totalPoints > 0) {
    lignes.push(
      `${nombre.format(c.clientesAvecPoints)} ${c.clientesAvecPoints > 1 ? "clientes ne pourront" : "cliente ne pourra"} plus utiliser ${c.clientesAvecPoints > 1 ? "leurs" : "ses"} ${nombre.format(c.totalPoints)} points`,
    );
  }
  const perdues = c.employeesHorsOwner - LIMITE_EMPLOYEES_GRATUIT;
  if (perdues > 0) {
    lignes.push(
      `${perdues} de vos ${c.employeesHorsOwner} employées ${perdues > 1 ? "perdront" : "perdra"} leur accès`,
    );
  }
  if (Number(c.commissionsNonReglees) > 0) {
    lignes.push(
      `vos commissions seront verrouillées (${c.commissionsNonReglees.replace(".", ",")} DT non réglés)`,
    );
  }
  return lignes;
}

/** « a, b et c » — la liste a la francaise, sans virgule d'Oxford. */
export function joindreFr(elements: string[]): string {
  if (elements.length <= 1) return elements.join("");
  return `${elements.slice(0, -1).join(", ")} et ${elements[elements.length - 1]}`;
}

/** 15/11, a l'heure de Tunis : la date que la gerante lit sur son calendrier. */
export function dateCourteFr(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Africa/Tunis",
  }).format(d);
}

/** Code d'erreur commun a toutes les routes qui refusent faute de Premium. */
export const CODE_PREMIUM_REQUIS = "PREMIUM_REQUIS";

export const MESSAGES_PREMIUM = {
  equipe:
    "La version gratuite permet une seule employée en plus de la gérante. Passez au Premium pour ajouter toute votre équipe.",
  commissions:
    "Les commissions font partie du Premium. Passez au Premium pour les consulter et les régler.",
  fidelite:
    "Le programme fidélité est en pause en version gratuite. Les points de la cliente sont conservés.",
} as const;
