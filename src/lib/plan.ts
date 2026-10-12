/**
 * L'offre de Salonista : la caisse est gratuite pour toujours, et trois
 * fonctions passent dans un abonnement Premium.
 *
 * Ce fichier est PUR — aucune base, aucun reseau — pour etre teste sans
 * mock. Le chargeur qui lit la base vit dans `plan-serveur.ts`.
 *
 * Les quatre etats d'un salon :
 *
 * | Etat                  | Quand                                      | Premium debloque |
 * |-----------------------|--------------------------------------------|------------------|
 * | AVANT_PREMIERE_VENTE  | aucune vente, aucune ligne PREMIUM         | oui              |
 * | ESSAI                 | ligne TRIAL non echue                      | oui              |
 * | PREMIUM               | ligne ACTIVE non echue, ou sans echeance   | oui              |
 * | GRATUIT               | tout le reste (echue, SUSPENDED, EXPIRED)  | non              |
 *
 * POURQUOI L'ESSAI PART DE LA PREMIERE VENTE ET NON DE L'INSCRIPTION : un
 * salon passe souvent des jours a configurer ses services et son equipe avant
 * d'encaisser. Faire tourner le compteur pendant ce temps lui ferait payer un
 * mois qu'il n'a pas utilise.
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
  premiereVenteAt: Date | null;
  maintenant: Date;
}): Plan {
  const { premium, premiereVenteAt, maintenant } = args;

  if (!premium) {
    if (!premiereVenteAt) return { etat: "AVANT_PREMIERE_VENTE" };
    // Cas de course : la vente est passee, la ligne pas encore creee (ou sa
    // creation a echoue). On calcule l'essai depuis la vente ; le chargeur
    // cree la ligne juste apres. Un essai deja fini compte comme fini.
    return essai(finEssaiDepuis(premiereVenteAt), maintenant);
  }

  if (premium.status === "TRIAL") {
    // Un essai sans echeance n'est pose par aucun chemin du code ; s'il
    // apparait (saisie manuelle), on lui donne la duree normale.
    const fin =
      premium.expiresAt ?? finEssaiDepuis(premiereVenteAt ?? maintenant);
    return essai(fin, maintenant);
  }

  if (premium.status === "ACTIVE" && !echue(premium.expiresAt, maintenant)) {
    return { etat: "PREMIUM", jusquAu: premium.expiresAt };
  }

  return { etat: "GRATUIT", depuis: premium.expiresAt };
}

/**
 * Une fonction Premium est-elle disponible ?
 *
 * `rewardsHistorique` : un ancien module REWARDS encore actif. Des salons ont
 * ete actives a la main avant l'offre Premium ; leur retirer la fidelite du
 * jour au lendemain casserait ce qui leur a ete vendu.
 */
export function fonctionDisponible(
  plan: Plan,
  fonction: Fonction,
  rewardsHistorique = false,
): boolean {
  if (plan.etat !== "GRATUIT") return true;
  return fonction === "FIDELITE" && rewardsHistorique;
}

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
export function compterDansLimite(employees: EmployeeEquipe[]): EmployeeEquipe[] {
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
export function repartirEquipe(employees: EmployeeEquipe[]): {
  garder: EmployeeEquipe[];
  suspendre: EmployeeEquipe[];
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
