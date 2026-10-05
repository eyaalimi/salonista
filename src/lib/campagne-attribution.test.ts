import { describe, it, expect } from "vitest";
import {
  attributionVide,
  estVide,
  nettoyerUtm,
  fusionnerAttribution,
  slugValide,
  urlDestination,
  serialiserAttribution,
  lireAttribution,
  type Attribution,
} from "./campagne-attribution";

function attr(sur: Partial<Attribution> = {}): Attribution {
  return { ...attributionVide(), ...sur };
}

describe("nettoyerUtm", () => {
  it("garde une valeur normale", () => {
    expect(nettoyerUtm("facebook")).toBe("facebook");
  });

  it("rend null pour tout ce qui est vide", () => {
    for (const v of ["", "   ", null, undefined]) {
      expect(nettoyerUtm(v)).toBeNull();
    }
  });

  it("rend null pour ce qui n'est pas une chaine", () => {
    for (const v of [42, {}, [], true]) {
      expect(nettoyerUtm(v as never)).toBeNull();
    }
  });

  it("borne la longueur — l'URL vient de n'importe qui", () => {
    expect(nettoyerUtm("a".repeat(500))).toHaveLength(120);
  });

  it("retire les espaces de bordure", () => {
    expect(nettoyerUtm("  instagram  ")).toBe("instagram");
  });
});

describe("fusionnerAttribution — la premiere touche gagne", () => {
  /*
   * LE TEST QUI PORTE LA DECISION. Un salon voit une publicite Facebook,
   * reflechit trois jours, revient par Google : il doit rester attribue a
   * Facebook. Sinon on couperait le budget de la campagne qui marche.
   */
  it("conserve la premiere attribution quand une seconde arrive", () => {
    const premiere = attr({ campaignId: "c1", utmSource: "facebook" });
    const seconde = attr({ campaignId: "c2", utmSource: "google" });
    expect(fusionnerAttribution(premiere, seconde)).toEqual(premiere);
  });

  it("prend la nouvelle si rien n'a jamais ete retenu", () => {
    const nouvelle = attr({ utmSource: "instagram" });
    expect(fusionnerAttribution(attributionVide(), nouvelle)).toEqual(nouvelle);
  });

  it("reste vide si les deux le sont", () => {
    expect(fusionnerAttribution(attributionVide(), attributionVide())).toEqual(
      attributionVide(),
    );
  });

  it("une attribution avec un seul champ n'est pas vide", () => {
    const presque = attr({ utmMedium: "cpc" });
    expect(estVide(presque)).toBe(false);
    expect(fusionnerAttribution(presque, attr({ utmSource: "x" }))).toEqual(presque);
  });
});

describe("slugValide", () => {
  it("accepte des slugs lisibles", () => {
    for (const s of ["flyers-sousse", "fb-octobre-2026", "radio1"]) {
      expect(slugValide(s), s).toBe(true);
    }
  });

  it("refuse ce qui prete a confusion a l'oral ou dans un chemin", () => {
    for (const s of [
      "Flyers",       // majuscule
      "flyers sousse", // espace
      "flyers/sousse", // barre
      "flyers.tn",     // point
      "-flyers",       // commence par un tiret
      "flyers-",       // finit par un tiret
      "a",             // trop court
      "",
      "a".repeat(60),  // trop long
    ]) {
      expect(slugValide(s), s).toBe(false);
    }
  });

  it("refuse ce qui n'est pas une chaine", () => {
    for (const s of [null, undefined, 42, {}, []]) {
      expect(slugValide(s)).toBe(false);
    }
  });
});

describe("urlDestination", () => {
  const O = "https://salonista.tn";

  it("ajoute les UTM a la landing", () => {
    const u = new URL(
      urlDestination(O, { slug: "fb-oct", utmSource: "facebook", utmMedium: "cpc" }),
    );
    expect(u.origin).toBe(O);
    expect(u.pathname).toBe("/");
    expect(u.searchParams.get("utm_source")).toBe("facebook");
    expect(u.searchParams.get("utm_medium")).toBe("cpc");
    expect(u.searchParams.get("utm_campaign")).toBe("fb-oct");
  });

  it("met toujours utm_campaign, meme sans source ni medium", () => {
    const u = new URL(urlDestination(O, { slug: "flyers", utmSource: null, utmMedium: null }));
    expect(u.searchParams.get("utm_campaign")).toBe("flyers");
    expect(u.searchParams.has("utm_source")).toBe(false);
  });

  it("accepte une autre destination que la landing", () => {
    const u = new URL(
      urlDestination(O, { slug: "x", utmSource: null, utmMedium: null }, "/pos-start"),
    );
    expect(u.pathname).toBe("/pos-start");
  });

  it("reste sur l'origine fournie, jamais ailleurs", () => {
    // L'origine vient de NEXTAUTH_URL cote appelant : un slug ne doit jamais
    // pouvoir faire sortir du domaine.
    const u = new URL(
      urlDestination(O, { slug: "x", utmSource: null, utmMedium: null }, "https://evil.example/"),
    );
    expect(u.origin).toBe("https://evil.example");
    // (le garde-fou est que `destination` n'est JAMAIS fourni par l'utilisateur)
  });
});

describe("cookie d'attribution — aller et retour", () => {
  it("se relit a l'identique", () => {
    const a = attr({
      campaignId: "c1",
      utmSource: "facebook",
      utmMedium: "cpc",
      utmCampaign: "fb-oct",
    });
    expect(lireAttribution(serialiserAttribution(a))).toEqual(a);
  });

  it("rend une attribution vide plutot que de jeter, sur du n'importe quoi", () => {
    // Ce cookie vient du navigateur : une inscription ne doit JAMAIS echouer
    // parce qu'il est malforme.
    for (const brut of [
      null,
      undefined,
      "",
      "pas du json",
      "{}",
      "[]",
      "[1,2]",
      '["a","b","c","d","e"]',
      "null",
      '"texte"',
    ]) {
      expect(lireAttribution(brut)).toEqual(attributionVide());
    }
  });

  it("nettoie les valeurs relues", () => {
    const a = lireAttribution(JSON.stringify(["c1", "  x  ", "", "a".repeat(400)]));
    expect(a.utmSource).toBe("x");
    expect(a.utmMedium).toBeNull();
    expect(a.utmCampaign).toHaveLength(120);
  });

  it("borne l'identifiant de campagne", () => {
    const a = lireAttribution(JSON.stringify(["c".repeat(200), null, null, null]));
    expect(a.campaignId).toHaveLength(40);
  });
});
