/**
 * Regles de securite et de nommage des images televersees.
 *
 * L'ancienne route validait `file.type` — l'en-tete MIME annonce par le
 * navigateur, trivialement falsifiable — et ecrivait sur disque une extension
 * tiree de `file.name.split(".").pop()`, donc choisie par l'appelant. On
 * pouvait deposer un `.html` ou un `.svg` en declarant `image/png`. Comme
 * Nginx sert `/uploads/` en direct, le fichier s'executait alors en MEME
 * ORIGINE que l'application : vol de session, actions au nom de la victime.
 *
 * Deux regles en decoulent, appliquees ici :
 *   1. le format vient des OCTETS du fichier (`sharp().metadata()`), jamais
 *      de ce que declare l'appelant ;
 *   2. l'extension vient d'une liste blanche indexee par ce format detecte,
 *      jamais du nom d'origine.
 *
 * Ce fichier ne contient que des decisions pures — pas de lecture de fichier,
 * pas de `sharp`, pas de disque — pour rester testable sans mock.
 */

/** Formats acceptes, tels que les nomme `sharp`. */
export const FORMATS_ACCEPTES = ["jpeg", "png", "webp", "avif"] as const;
export type FormatAccepte = (typeof FORMATS_ACCEPTES)[number];

/** 5 Mo, comme avant : la limite tenait, ce n'est pas elle le probleme. */
export const TAILLE_MAX = 5 * 1024 * 1024;

/** Nombre d'images par requete. */
export const IMAGES_MAX_PAR_ENVOI = 5;

/**
 * Quota par utilisateur et par jour.
 *
 * N'importe quel compte connecte — y compris une cliente, qui n'a aucune
 * raison de televerser — pouvait deposer 5 Mo autant de fois qu'il voulait
 * sur le disque d'un Lightsail. 40 envois par jour couvre largement un salon
 * qui installe son catalogue, et borne l'abus.
 */
export const ENVOIS_MAX_PAR_JOUR = 40;

/**
 * Les variantes generees, en largeur de pixels.
 *
 * Mesure en production : des vignettes de 1280 px etaient servies dans 160 px,
 * et une couverture de salon de 630 px etait etiree a 1049 px. Trois tailles
 * couvrent l'ensemble des usages du site — vignette de liste, carte, banniere
 * plein ecran — sans multiplier les fichiers sur le disque.
 */
export const LARGEURS_VARIANTES = [400, 800, 1600] as const;
export type LargeurVariante = (typeof LARGEURS_VARIANTES)[number];

/**
 * L'extension a ecrire sur le disque, pour un format detecte.
 *
 * Toutes les variantes sont re-encodees en WebP : un seul format en sortie
 * simplifie le `srcset` et pese moins que le JPEG a qualite egale.
 */
export const EXTENSION_SORTIE = "webp";

export type RefusImage = {
  /** Message en francais, affichable tel quel. */
  message: string;
  /** Code HTTP a renvoyer. */
  status: number;
};

/**
 * Le format detecte est-il acceptable ?
 *
 * @param format ce que `sharp().metadata()` a lu dans les octets, ou
 *   `undefined` quand sharp n'a rien reconnu — un `.html` renomme, par
 *   exemple.
 */
export function refusFormat(format: string | undefined): RefusImage | null {
  if (!format || !(FORMATS_ACCEPTES as readonly string[]).includes(format)) {
    return {
      message: "Ce fichier n'est pas une image valide. Utilisez JPG, PNG ou WebP.",
      status: 400,
    };
  }
  return null;
}

/** La taille est-elle dans la limite ? */
export function refusTaille(octets: number): RefusImage | null {
  if (octets > TAILLE_MAX) {
    return { message: "Fichier trop volumineux (max 5 Mo)", status: 400 };
  }
  if (octets === 0) {
    return { message: "Fichier vide", status: 400 };
  }
  return null;
}

/** Le nombre d'images de cette requete est-il acceptable ? */
export function refusNombre(n: number): RefusImage | null {
  if (n === 0) return { message: "Aucun fichier", status: 400 };
  if (n > IMAGES_MAX_PAR_ENVOI) {
    return { message: `Maximum ${IMAGES_MAX_PAR_ENVOI} images`, status: 400 };
  }
  return null;
}

/** Le quota journalier est-il depasse ? */
export function refusQuota(envoisAujourdhui: number): RefusImage | null {
  if (envoisAujourdhui >= ENVOIS_MAX_PAR_JOUR) {
    return {
      message:
        "Limite d'envois atteinte pour aujourd'hui. Réessayez demain ou contactez-nous.",
      status: 429,
    };
  }
  return null;
}

/**
 * Le nom de fichier d'une variante.
 *
 * `base` est un identifiant genere par le serveur (UUID) — jamais le nom
 * d'origine, qui reste sous controle de l'appelant.
 */
export function nomVariante(base: string, largeur: LargeurVariante): string {
  return `${base}-${largeur}.${EXTENSION_SORTIE}`;
}

/**
 * Quelles variantes generer pour une image de cette largeur ?
 *
 * On n'agrandit jamais : produire du 1600 px a partir d'une source de 500 px
 * ne fait que gonfler le disque sans ajouter un pixel d'information. La plus
 * petite variante est toujours produite, meme si la source est minuscule —
 * sinon une image de 100 px n'aurait aucune variante et rien a servir.
 */
export function largeursAGenerer(
  largeurSource: number,
): LargeurVariante[] {
  const utiles = LARGEURS_VARIANTES.filter((l) => l <= largeurSource);
  return utiles.length > 0 ? utiles : [LARGEURS_VARIANTES[0]];
}

/**
 * Cette image a-t-elle des variantes sur le disque ?
 *
 * Seules celles televersees depuis le lot C en ont. Les anciennes sont en
 * `.jpg`/`.png` : leur demander une variante donnerait un 404.
 */
export function aDesVariantes(src: string): boolean {
  return src.startsWith("/uploads/") && src.endsWith(`.${EXTENSION_SORTIE}`);
}

/**
 * L'URL de la variante a servir pour une largeur demandee.
 *
 * Next reclame des largeurs arbitraires (256, 384, 1080…) alors que seules
 * trois existent. On prend la premiere variante superieure ou egale : servir
 * plus petit que demande afficherait une image visiblement floue. Au-dela de
 * la plus grande, on sert la plus grande.
 *
 * Les images sans variantes sont rendues telles quelles.
 */
export function urlVariante(src: string, largeurDemandee: number): string {
  if (!aDesVariantes(src)) return src;

  const base = src.slice(0, -(EXTENSION_SORTIE.length + 1));
  const choisie =
    LARGEURS_VARIANTES.find((l) => l >= largeurDemandee) ??
    LARGEURS_VARIANTES[LARGEURS_VARIANTES.length - 1];

  return `${base}-${choisie}.${EXTENSION_SORTIE}`;
}
