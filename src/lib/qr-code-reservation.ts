/**
 * Lire le code d'une reservation dans ce qu'a vu la camera.
 *
 * Le QR d'une cliente contient une URL complete —
 * `https://salonista.tn/verification?code=BT-xxxxxxxxxxxxxxxx` — parce qu'il
 * doit rester lisible par l'appareil photo natif d'un telephone, qui ne sait
 * ouvrir qu'un lien. Le scanner de la caisse voit donc cette URL, pas le code
 * seul.
 *
 * Trois formes arrivent en pratique :
 *   - l'URL complete, cas normal ;
 *   - le code nu, si un jour un scanner de code-barres lit le texte ;
 *   - n'importe quoi d'autre — un QR de wifi, une etiquette produit — qu'il
 *     faut rejeter sans rien casser.
 */

/**
 * Un code de reservation : `BT-` suivi de 16 caracteres de l'alphabet nanoid
 * (`A-Za-z0-9_-`). Voir la generation dans `POST /api/bookings`.
 */
const FORMAT_CODE = /^BT-[A-Za-z0-9_-]{16}$/;

/**
 * @returns le code de reservation, ou `null` si le contenu scanne n'en porte
 *   pas. Ne jette jamais : une camera lit beaucoup de choses, et un QR
 *   inconnu ne doit pas interrompre le scan.
 */
export function extraireCodeReservation(contenu: string): string | null {
  const brut = contenu.trim();
  if (!brut) return null;

  // Le code nu, tel qu'il serait lu par une douchette.
  if (FORMAT_CODE.test(brut)) return brut;

  // L'URL du QR. `URL` rejette tout seul ce qui n'en est pas une.
  let url: URL;
  try {
    url = new URL(brut);
  } catch {
    return null;
  }

  // Le chemin doit etre celui de la verification : une autre page de
  // salonista.tn qui porterait un `?code=` ne doit pas passer pour un QR de
  // reservation.
  if (!url.pathname.endsWith("/verification")) return null;

  const code = url.searchParams.get("code")?.trim();
  if (!code || !FORMAT_CODE.test(code)) return null;

  return code;
}
