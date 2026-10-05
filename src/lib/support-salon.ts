/**
 * Le support des salons — les decisions, sans la base.
 *
 * Isole pour etre testable sans Prisma. Les adaptateurs vivent dans les
 * routes /api/superadmin/salons/*.
 */

import { randomBytes } from "crypto";

/**
 * JAMAIS DE MOT DE PASSE NI DE PIN EN CLAIR.
 *
 * Un superadmin ne peut pas « voir » le mot de passe d'un salon : il est
 * hache (bcrypt), et c'est irreversible par construction. C'est une
 * PROTECTION, pas une limitation a contourner : si nous pouvions le lire,
 * quiconque accede a la base le pourrait aussi.
 *
 * Deux chemins seulement, tous deux a usage unique :
 *   - envoyer un lien de reinitialisation a l'adresse DEJA enregistree ;
 *   - generer un mot de passe temporaire, affiche UNE SEULE FOIS, avec
 *     changement obligatoire a la connexion suivante.
 *
 * Le second n'existe que parce que le premier echoue parfois : un salon dont
 * l'adresse e-mail est morte ne recevrait jamais son lien.
 */

/** Duree de validite d'un lien de reinitialisation cree par le support. */
export const LIEN_SUPPORT_MINUTES = 30;

/**
 * 30 minutes et non une heure (la duree du reset public) : ce lien est cree
 * PENDANT un appel telephonique. Le salon est au bout du fil, il clique dans
 * la minute. Une fenetre plus large laisserait un lien actif dans une boite
 * mail longtemps apres l'appel.
 */
export function expirationLienSupport(maintenant: Date = new Date()): Date {
  return new Date(maintenant.getTime() + LIEN_SUPPORT_MINUTES * 60 * 1000);
}

/**
 * Un lien de reinitialisation est-il encore utilisable ?
 *
 * `null` pour l'expiration vaut PERIME, jamais « valide pour toujours » : une
 * donnee manquante ne doit pas ouvrir un acces.
 */
export function lienEncoreValide(
  expiration: Date | null | undefined,
  maintenant: Date = new Date(),
): boolean {
  if (!expiration) return false;
  return expiration > maintenant;
}

/**
 * Alphabet du mot de passe temporaire.
 *
 * Sans `0/O`, `1/l/I` : ce mot de passe est DICTE AU TELEPHONE. Confondre un
 * zero et un O fait echouer la connexion et rappeler le salon — exactement ce
 * qu'on cherchait a eviter. On retire aussi les caracteres speciaux, penibles
 * a dicter et a saisir sur un clavier de telephone.
 */
const ALPHABET_DICTABLE = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

/** Longueur du mot de passe temporaire. 12 caracteres dictables restent solides. */
export const LONGUEUR_MDP_TEMPORAIRE = 12;

/**
 * Genere un mot de passe temporaire.
 *
 * `randomBytes` et non `Math.random` : ce mot de passe ouvre un compte de
 * salon, il doit etre imprevisible.
 *
 * Le modulo introduit un biais negligeable ici (54 valeurs sur 256), et le
 * corriger par rejet n'apporterait rien de mesurable sur 12 caracteres tires
 * d'un alphabet de cette taille.
 */
export function genererMotDePasseTemporaire(
  longueur: number = LONGUEUR_MDP_TEMPORAIRE,
): string {
  const octets = randomBytes(longueur);
  let sortie = "";
  for (let i = 0; i < longueur; i++) {
    sortie += ALPHABET_DICTABLE[octets[i] % ALPHABET_DICTABLE.length];
  }
  return sortie;
}

/**
 * Les actions de support, telles qu'elles apparaissent dans le journal.
 *
 * Chaines litterales et non enum : le journal est relu par des humains, et
 * ajouter une action ne doit pas imposer une migration.
 */
export const ACTIONS = {
  LIEN_RESET: "support.lien_reinitialisation",
  MDP_TEMPORAIRE: "support.mot_de_passe_temporaire",
  PIN_REINITIALISE: "support.pin_reinitialise",
  COMPTE_DEBLOQUE: "support.compte_debloque",
  SESSIONS_FERMEES: "support.sessions_fermees",
  SALON_SUSPENDU: "support.salon_suspendu",
  SALON_REACTIVE: "support.salon_reactive",
  NOTE_AJOUTEE: "support.note_ajoutee",
  VUE_LECTURE_SEULE: "support.vue_lecture_seule",
  FICHE_CONSULTEE: "support.fiche_consultee",
} as const;

export type ActionSupport = (typeof ACTIONS)[keyof typeof ACTIONS];

/**
 * Les points a verifier AVANT toute action sensible.
 *
 * Affiches a l'ecran, pas seulement documentes : le risque reel du support
 * n'est pas technique, c'est qu'un inconnu appelle en se faisant passer pour
 * un salon et obtienne un acces. Ces trois questions coutent trente secondes
 * et ferment cette porte.
 */
export const VERIFICATIONS_IDENTITE = [
  "Le numéro qui appelle est bien celui enregistré sur le compte",
  "La personne donne le nom exact du salon",
  "La personne donne le matricule fiscal, ou la ville et la date d'inscription",
] as const;

/**
 * Un terme de recherche est-il exploitable ?
 *
 * Deux caracteres au minimum : en dessous, la recherche remonterait la moitie
 * de la base et serait inutilisable.
 */
export function termeRecherchable(terme: unknown): terme is string {
  return typeof terme === "string" && terme.trim().length >= 2;
}

/**
 * Normalise un terme de recherche.
 *
 * Les espaces sont conserves a l'interieur (« Salon Nour »), seuls ceux des
 * bords sont retires. La longueur est bornee : ce terme part dans une requete
 * `contains`, et une chaine demesuree ferait travailler la base pour rien.
 */
export function normaliserTerme(terme: string): string {
  return terme.trim().slice(0, 100);
}

/**
 * Duree d'une session « voir comme le salon ».
 *
 * 15 minutes : le temps de comprendre ce que la personne decrit au telephone,
 * pas le temps de s'installer dans son compte. Un acces en lecture aux
 * donnees commerciales d'un salon ne doit jamais etre confortable.
 */
export const VUE_LECTURE_MINUTES = 15;

export function expirationVueLecture(maintenant: Date = new Date()): Date {
  return new Date(maintenant.getTime() + VUE_LECTURE_MINUTES * 60 * 1000);
}

/** Nom du cookie qui porte la vue en lecture seule. */
export const COOKIE_VUE_LECTURE = "salonista-vue-lecture";

/**
 * Les permissions d'ECRITURE de la caisse.
 *
 * Pendant une vue « voir comme le salon », elles sont TOUTES refusees cote
 * serveur — pas seulement masquees dans l'interface. Masquer un bouton
 * n'empeche personne d'appeler la route directement.
 *
 * Liste explicite plutot que « tout sauf les lectures » : une permission
 * nouvelle doit etre refusee PAR DEFAUT le temps qu'on y pense, et c'est ce
 * que fait `estEcriture` ci-dessous.
 */
const PERMISSIONS_LECTURE = new Set([
  "bookings.view",
  "customers.view",
  "inventory.view",
  "analytics.view",
]);

/**
 * Cette permission ecrit-elle ?
 *
 * Tout ce qui n'est pas explicitement une LECTURE est traite comme une
 * ecriture. Le defaut est donc le refus : une permission ajoutee demain sera
 * bloquee en lecture seule sans que personne ait a y penser.
 */
export function estEcriture(permission: string): boolean {
  return !PERMISSIONS_LECTURE.has(permission);
}

/** La vue en lecture seule est-elle encore ouverte ? */
export function vueLectureActive(
  expiration: Date | null | undefined,
  maintenant: Date = new Date(),
): boolean {
  if (!expiration) return false;
  return expiration > maintenant;
}

/**
 * Masque une adresse e-mail pour l'affichage.
 *
 * La fiche de support montre assez pour reconnaitre la boite au telephone
 * (« c'est bien un gmail qui commence par a ? »), jamais assez pour la
 * reconstituer.
 */
export function masquerEmail(email: string | null | undefined): string {
  if (!email) return "—";
  const [locale, domaine] = email.split("@");
  if (!domaine) return "—";
  return `${locale.slice(0, 1)}${"*".repeat(Math.max(3, locale.length - 1))}@${domaine}`;
}

/**
 * Masque un numero de telephone, en gardant les quatre derniers chiffres.
 *
 * Meme raison : de quoi confirmer au telephone, pas de quoi recopier.
 */
export function masquerTelephone(phone: string | null | undefined): string {
  if (!phone) return "—";
  if (phone.startsWith("walk-in-")) return "—";
  const chiffres = phone.replace(/\D/g, "");
  if (chiffres.length <= 4) return phone;
  return `••• ${chiffres.slice(-4)}`;
}
