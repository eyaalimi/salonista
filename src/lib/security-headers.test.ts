import { describe, it, expect } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "./security-headers";

function valeur(production: boolean, cle: string): string | undefined {
  return securityHeaders(production).find((e) => e.key === cle)?.value;
}

describe("securityHeaders", () => {
  it("empeche le site d'etre encadre ailleurs", () => {
    expect(valeur(true, "X-Frame-Options")).toBe("SAMEORIGIN");
  });

  it("interdit au navigateur de deviner le type d'une reponse", () => {
    expect(valeur(true, "X-Content-Type-Options")).toBe("nosniff");
  });

  it("limite ce qui fuit dans le Referer", () => {
    expect(valeur(true, "Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  /**
   * En developpement, HSTS forcerait le navigateur a passer localhost en
   * HTTPS pendant deux ans — y compris pour d'autres projets sur le meme
   * port. Un poste de developpement en resterait casse longtemps.
   */
  it("ne pose HSTS qu'en production", () => {
    expect(valeur(true, "Strict-Transport-Security")).toContain("max-age=63072000");
    expect(valeur(false, "Strict-Transport-Security")).toBeUndefined();
  });

  it("n'inscrit pas le domaine sur la liste preload", () => {
    expect(valeur(true, "Strict-Transport-Security")).not.toContain("preload");
  });

  /**
   * Le scanner de QR de la caisse ouvre la camera. `camera=()` la couperait
   * et casserait /pos/scan.
   */
  it("laisse la camera au site lui-meme, pour le scanner de QR", () => {
    expect(valeur(true, "Permissions-Policy")).toContain("camera=(self)");
  });

  it("coupe le micro et le paiement", () => {
    const p = valeur(true, "Permissions-Policy") ?? "";
    expect(p).toContain("microphone=()");
    expect(p).toContain("payment=()");
  });

  /**
   * La position etait coupee (`geolocation=()`). Les reglages du salon
   * proposent desormais « Me localiser » pour poser le point qui ouvrira
   * l'itineraire des clientes : le bouton echouait en production alors qu'il
   * marchait en local, ou l'en-tete n'est pas pose.
   *
   * `(self)` et non `*` : notre origine seulement, jamais un tiers embarque.
   */
  it("laisse la position au site lui-meme, pour localiser un salon", () => {
    const p = valeur(true, "Permissions-Policy") ?? "";
    expect(p).toContain("geolocation=(self)");
    expect(p).not.toContain("geolocation=*");
  });

  /**
   * Report-Only d'abord : la politique contient encore 'unsafe-inline', que
   * Next impose pour l'hydratation. Bloquer tout de suite casserait le site.
   */
  it("envoie la CSP en Report-Only, pas en mode bloquant", () => {
    expect(valeur(true, "Content-Security-Policy-Report-Only")).toBeDefined();
    expect(valeur(true, "Content-Security-Policy")).toBeUndefined();
  });
});

describe("contentSecurityPolicy", () => {
  const csp = contentSecurityPolicy();

  it("autorise les polices Google, chargees par le layout", () => {
    expect(csp).toContain("https://fonts.googleapis.com");
    expect(csp).toContain("https://fonts.gstatic.com");
  });

  it("autorise le CDN Workbox, charge par le service worker", () => {
    expect(csp).toContain("https://storage.googleapis.com");
  });

  /**
   * Les QR codes sont des images en base64 : sans `data:`, la cliente ne
   * verrait plus son code.
   */
  it("autorise les images en data: pour les QR codes", () => {
    expect(csp).toContain("img-src 'self' data:");
  });

  /**
   * Leaflet charge ses tuiles depuis OpenStreetMap sur la fiche salon et dans
   * les reglages. Elles manquaient a `img-src` : sans effet tant que la CSP
   * est en Report-Only, mais la carte serait devenue un rectangle gris le
   * jour ou elle passerait bloquante.
   */
  it("autorise les tuiles OpenStreetMap", () => {
    expect(csp).toMatch(/img-src[^;]*tile\.openstreetmap\.org/);
  });

  it("interdit d'encadrer le site", () => {
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("interdit les objets embarques", () => {
    expect(csp).toContain("object-src 'none'");
  });

  it("limite les envois de formulaire au site", () => {
    expect(csp).toContain("form-action 'self'");
  });
});
