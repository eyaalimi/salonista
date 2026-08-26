/**
 * Decisions du rattrapage des images televersees avant le lot C.
 *
 * Le lot C re-encode chaque televersement en WebP et le decline en 400/800/
 * 1600 px. Il ne s'applique qu'aux NOUVEAUX fichiers : les photos deja sur le
 * disque sont restees en `.jpg`/`.png` d'origine. `aDesVariantes()` les
 * reconnait comme heritees et les rend `unoptimized` — le bon garde-fou, mais
 * elles partent alors en pleine resolution.
 *
 * Mesure en production le 24 aout : une image de 1600 px telechargee pour
 * s'afficher dans 214 px, et un premier rendu a 7,4 s en cache froid pour un
 * TTFB a 277 ms. Ce n'est pas le serveur qui est lent.
 *
 * Ce fichier ne contient que des decisions pures — pas de `sharp`, pas de
 * disque, pas de Prisma — pour rester testable sans mock, comme
 * `upload-image.ts` dont il reutilise les regles plutot que de les redire.
 */

import { EXTENSION_SORTIE, aDesVariantes } from "./upload-image";

/**
 * Extensions d'origine a rattraper.
 *
 * Volontairement alignee sur `FORMATS_ACCEPTES` d'`upload-image.ts`, aux noms
 * d'extension pres : sharp nomme le format `jpeg`, le disque porte `.jpg`,
 * `.jpeg` ou `.jfif`. Ce sont les fichiers que l'ancienne route pouvait
 * ecrire — elle tirait l'extension du nom fourni par le navigateur.
 *
 * `.jfif` n'est pas theorique : quatre fichiers du dossier en portent, et
 * `sharp().metadata()` les lit tous en `jpeg`. C'est l'extension que Windows
 * donne aux JPEG enregistres depuis un navigateur. Les omettre les laisserait
 * en pleine resolution, precisement le probleme qu'on corrige.
 *
 * Cette liste ne sert qu'a REPERER les candidats ; le format reel vient
 * toujours des octets, cote script.
 */
export const EXTENSIONS_HERITEES = [
  ".jpg",
  ".jpeg",
  ".jfif",
  ".png",
  ".webp",
  ".avif",
] as const;

/**
 * Le nom de base d'un fichier, sans son extension.
 *
 * `undefined` si le nom n'a pas d'extension reconnue — un fichier sans point,
 * ou un `.txt` egare dans le dossier.
 */
export function baseSansExtension(nomFichier: string): string | undefined {
  const point = nomFichier.lastIndexOf(".");
  if (point <= 0) return undefined;

  const extension = nomFichier.slice(point).toLowerCase();
  if (!(EXTENSIONS_HERITEES as readonly string[]).includes(extension)) {
    return undefined;
  }
  return nomFichier.slice(0, point);
}

/**
 * Ce nom de fichier est-il une VARIANTE deja generee ?
 *
 * Les variantes s'appellent `<base>-400.webp`. Sans ce filtre, le rattrapage
 * les prendrait pour des originaux et genererait `<base>-400-400.webp`,
 * `<base>-400-800.webp`… a chaque execution : la fin de l'idempotence.
 *
 * Le motif exige que le suffixe soit une des largeurs connues, pas n'importe
 * quel nombre : un fichier legitimement nomme `promo-2024.jpg` n'est pas une
 * variante.
 */
export function estVariante(nomFichier: string): boolean {
  return /-(400|800|1600)\.webp$/i.test(nomFichier);
}

export type DecisionFichier =
  | { action: "convertir"; base: string }
  | { action: "ignorer"; raison: IgnoreRaison };

export type IgnoreRaison =
  | "variante"
  | "extension-inconnue"
  | "deja-converti";

/**
 * Faut-il convertir ce fichier ?
 *
 * @param nomFichier nom nu, sans chemin.
 * @param fichiersPresents l'ensemble des noms presents dans le dossier, pour
 *   detecter qu'une canonique `<base>.webp` existe deja. C'est ce qui rend le
 *   script idempotent : relance apres relance, un fichier deja traite est
 *   ignore sans etre re-encode.
 */
export function decideFichier(
  nomFichier: string,
  fichiersPresents: ReadonlySet<string>,
): DecisionFichier {
  if (estVariante(nomFichier)) {
    return { action: "ignorer", raison: "variante" };
  }

  const base = baseSansExtension(nomFichier);
  if (base === undefined) {
    return { action: "ignorer", raison: "extension-inconnue" };
  }

  const canonique = `${base}.${EXTENSION_SORTIE}`;

  // Le fichier EST deja la canonique : rien a produire.
  if (nomFichier === canonique) {
    return { action: "ignorer", raison: "deja-converti" };
  }

  // Un `.jpg` dont le `.webp` existe deja : passage precedent du script.
  if (fichiersPresents.has(canonique)) {
    return { action: "ignorer", raison: "deja-converti" };
  }

  return { action: "convertir", base };
}

/**
 * L'URL a ecrire en base pour un chemin `/uploads/...` herite.
 *
 * Rend l'URL inchangee quand il n'y a rien a faire : chemin hors `/uploads/`
 * (une URL externe, un `/images/` du build), extension inconnue, ou canonique
 * WebP deja en place. L'appelant compare l'entree et la sortie pour savoir
 * s'il doit ecrire.
 */
export function reecrireUrl(
  url: string,
  basesConverties: ReadonlySet<string>,
): string {
  if (!url.startsWith("/uploads/")) return url;
  if (aDesVariantes(url)) return url;

  const nomFichier = url.slice("/uploads/".length);
  // Un chemin avec un sous-dossier n'est pas ce que la route produit ; on ne
  // s'y aventure pas.
  if (nomFichier.includes("/")) return url;

  const base = baseSansExtension(nomFichier);
  if (base === undefined) return url;

  // On ne reecrit QUE vers un fichier dont on sait qu'il existe. Reecrire a
  // l'aveugle transformerait une image affichee en 404 des qu'une conversion
  // aurait echoue.
  if (!basesConverties.has(base)) return url;

  return `/uploads/${base}.${EXTENSION_SORTIE}`;
}

/**
 * Reecrit un tableau d'URLs (`ProviderProfile.photos`, `Offer.photos`).
 *
 * Rend `null` si rien ne change, pour que l'appelant n'ecrive pas une ligne
 * identique — une transaction par entite, autant qu'elles servent a quelque
 * chose.
 */
export function reecrireTableau(
  urls: readonly string[],
  basesConverties: ReadonlySet<string>,
): string[] | null {
  const suivant = urls.map((u) => reecrireUrl(u, basesConverties));
  const change = suivant.some((u, i) => u !== urls[i]);
  return change ? suivant : null;
}

/** Formate un nombre d'octets en unite lisible. */
export function formaterOctets(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(1)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(2)} Mo`;
}
