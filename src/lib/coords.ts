/**
 * Validation des coordonnees geographiques d'un salon.
 *
 * Pas d'import Prisma ici — le module doit rester chargeable par vitest
 * (cf. src/lib/verify-authz.ts, meme contrainte).
 */

export type Coords = { lat: number; lng: number };

/**
 * Une paire (lat, lng) est-elle utilisable comme emplacement de salon ?
 *
 * Le cas (0, 0) est rejete volontairement : c'est le « Null Island », au large
 * du Ghana, qu'on obtient quand un parsing echoue en silence — Number("")
 * vaut 0. Aucun salon tunisien ne s'y trouve. En revanche une SEULE des deux
 * coordonnees a zero reste valide : l'equateur et le meridien de Greenwich
 * sont des lieux reels.
 */
export function isValidCoords(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  if (lat === 0 && lng === 0) return false;
  return true;
}

/**
 * Normalise une paire d'entrees (nombres, chaines, null, undefined) en un point
 * valide, ou null si le point est absent ou invalide.
 *
 * Les deux coordonnees vont ensemble : un demi-point n'est affichable nulle
 * part, la fiche publique teste `lat && lng`.
 */
export function parseCoords(
  lat: number | string | null | undefined,
  lng: number | string | null | undefined,
): Coords | null {
  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    return null;
  }
  // Number("") vaut 0 : sans ce garde, une chaine vide produirait Null Island.
  if (typeof lat === "string" && lat.trim() === "") return null;
  if (typeof lng === "string" && lng.trim() === "") return null;

  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!isValidCoords(latNum, lngNum)) return null;
  return { lat: latNum, lng: lngNum };
}
