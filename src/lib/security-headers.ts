/**
 * En-tetes de securite HTTP.
 *
 * Aucun n'etait envoye : le site pouvait etre place dans une iframe sur un
 * autre domaine (clickjacking), les navigateurs pouvaient deviner le type
 * d'une reponse, et l'URL complete d'une page fuyait vers les sites tiers via
 * le `Referer`.
 *
 * Isole ici plutot que dans `next.config.ts` pour rester testable : la
 * configuration de Next n'est pas importable depuis Vitest sans embarquer
 * tout son chargeur.
 */

/** Origines externes reellement utilisees par le site. */
const GOOGLE_FONTS_CSS = "https://fonts.googleapis.com";
const GOOGLE_FONTS_FILES = "https://fonts.gstatic.com";
/** Le service worker charge Workbox 7 depuis ce CDN (voir public/sw.js). */
const WORKBOX_CDN = "https://storage.googleapis.com";

/**
 * Tuiles OpenStreetMap, servies par Leaflet sur la fiche salon et dans les
 * reglages de la caisse. Le motif couvre les sous-domaines `a.`, `b.`, `c.`
 * que Leaflet alterne via `{s}`.
 */
const OSM_TILES = "https://*.tile.openstreetmap.org";

/**
 * La politique de securite du contenu.
 *
 * Envoyee en **Report-Only** d'abord : `'unsafe-inline'` et `'unsafe-eval'`
 * y figurent parce que Next.js injecte des scripts en ligne pour l'hydratation
 * et que Turbopack utilise `eval` en developpement. Les retirer demande des
 * nonces par requete — un chantier a part, qui casserait le site s'il etait
 * fait a l'aveugle.
 *
 * Report-Only n'empeche donc rien pour l'instant : il sert a decouvrir ce que
 * la page charge vraiment avant de basculer en mode bloquant.
 */
export function contentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    // 'unsafe-inline'/'unsafe-eval' : hydratation Next + Turbopack. A retirer
    // le jour ou l'on passera aux nonces.
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' " + WORKBOX_CDN,
    "style-src 'self' 'unsafe-inline' " + GOOGLE_FONTS_CSS,
    "font-src 'self' " + GOOGLE_FONTS_FILES,
    // `data:` est indispensable : les QR codes sont des images en base64.
    // Les tuiles OpenStreetMap sont chargees par Leaflet sur la fiche salon
    // et dans les reglages : sans elles, la carte reste un rectangle gris.
    // Manquait ici — invisible tant que la CSP est en Report-Only, cassant le
    // jour ou elle passera bloquante.
    "img-src 'self' data: blob: " + OSM_TILES,
    "connect-src 'self' " + WORKBOX_CDN,
    "worker-src 'self'",
    "manifest-src 'self'",
    // Personne ne doit pouvoir encadrer le site : c'est la meme protection
    // que X-Frame-Options, dans sa forme moderne.
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

/** Un en-tete HTTP, au format attendu par `headers()` de Next. */
export type EnTete = { key: string; value: string };

/**
 * Les en-tetes appliques a toutes les pages.
 *
 * `Strict-Transport-Security` n'est pose qu'en production : en developpement,
 * il forcerait le navigateur a passer `localhost` en HTTPS pendant deux ans,
 * y compris pour d'autres projets sur le meme port.
 */
export function securityHeaders(production: boolean): EnTete[] {
  const entetes: EnTete[] = [
    // Le navigateur ne devine plus le type d'une reponse. Complete le
    // durcissement de /uploads/ fait au lot C.
    { key: "X-Content-Type-Options", value: "nosniff" },
    // Clickjacking. Double emploi volontaire avec `frame-ancestors` : les
    // vieux navigateurs ne connaissent que celui-ci.
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    // L'URL complete ne part chez un tiers que si l'on reste en HTTPS, et
    // seulement l'origine. Sans cela, `/cliente/reservation?bookingId=…`
    // fuyait vers les sites tiers.
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // Le site ne demande ni camera, ni micro, ni position. Exception : le
    // scanner de QR de la caisse, qui a besoin de la camera en meme origine.
    {
      key: "Permissions-Policy",
      // `geolocation=(self)` est NECESSAIRE : les reglages du salon proposent
      // « Me localiser » pour poser le point qui ouvrira l'itineraire des
      // clientes. A `()`, le navigateur refusait la demande en production
      // alors qu'elle marchait en local — l'en-tete n'y est pas pose.
      // `camera=(self)` l'est aussi : /pos/scan lit les QR codes.
      value: "camera=(self), microphone=(), geolocation=(self), payment=()",
    },
    { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy() },
  ];

  if (production) {
    entetes.push({
      key: "Strict-Transport-Security",
      // Deux ans, sous-domaines compris. Pas de `preload` : l'inscription sur
      // la liste des navigateurs est difficile a annuler, et le domaine est
      // encore jeune.
      value: "max-age=63072000; includeSubDomains",
    });
  }

  return entetes;
}
