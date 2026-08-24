/**
 * L'origine publique du site.
 *
 * AVANT : on lisait `x-forwarded-proto` / `x-forwarded-host`. Or Nginx ne
 * REECRIT pas ces en-tetes — il les transmet tels que le client les a
 * envoyes. N'importe qui pouvait donc appeler
 * `/api/tracking/click?token=…` avec `X-Forwarded-Host: evil.example` et
 * obtenir une redirection vers son propre site.
 *
 * C'est exactement le genre de lien qu'une influenceuse diffuse : le lien
 * portait bien `salonista.tn`, la victime cliquait en confiance, et
 * atterrissait ailleurs. Le QR code d'une reservation etait detournable de la
 * meme facon — il embarque cette origine.
 *
 * MAINTENANT : `NEXTAUTH_URL` uniquement. Cette variable est definie dans le
 * `.env` du serveur, hors d'atteinte d'un appelant.
 */

/**
 * @returns l'origine sans barre oblique finale, par exemple
 *   `https://salonista.tn`.
 *
 * En developpement, `NEXTAUTH_URL` vaut `http://localhost:3000`. Si elle
 * manque, on retombe sur cette valeur plutot que de lire la requete : mieux
 * vaut un lien casse en local qu'une redirection ouverte en production.
 */
export function publicOrigin(): string {
  const brut = process.env.NEXTAUTH_URL?.trim();
  if (!brut) return "http://localhost:3000";
  return brut.replace(/\/+$/, "");
}
