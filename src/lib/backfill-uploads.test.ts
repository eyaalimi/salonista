import { describe, it, expect } from "vitest";
import {
  baseSansExtension,
  decideFichier,
  estVariante,
  formaterOctets,
  reecrireTableau,
  reecrireUrl,
} from "./backfill-uploads";

describe("baseSansExtension", () => {
  it("retire une extension connue", () => {
    expect(baseSansExtension("abc.jpg")).toBe("abc");
    expect(baseSansExtension("abc.png")).toBe("abc");
    expect(baseSansExtension("abc.webp")).toBe("abc");
  });

  it("ignore la casse de l'extension", () => {
    expect(baseSansExtension("photo.JPG")).toBe("photo");
    expect(baseSansExtension("photo.PNG")).toBe("photo");
  });

  /**
   * Constate dans public/uploads/ : quatre fichiers en `.jfif`, tous lus en
   * `jpeg` par sharp. C'est l'extension que Windows donne aux JPEG
   * enregistres depuis un navigateur. Les omettre les laisserait en pleine
   * resolution.
   */
  it("reconnait les .jfif de Windows", () => {
    expect(baseSansExtension("2ce058e0-5e7b.jfif")).toBe("2ce058e0-5e7b");
  });

  it("garde les points internes du nom", () => {
    expect(baseSansExtension("mon.salon.v2.jpg")).toBe("mon.salon.v2");
  });

  it("refuse une extension inconnue", () => {
    expect(baseSansExtension("notes.txt")).toBeUndefined();
    expect(baseSansExtension("script.html")).toBeUndefined();
  });

  it("refuse un nom sans extension", () => {
    expect(baseSansExtension("README")).toBeUndefined();
  });

  /** Un fichier cache `.gitkeep` ne doit pas devenir une base vide. */
  it("refuse un nom qui commence par un point", () => {
    expect(baseSansExtension(".gitkeep")).toBeUndefined();
  });
});

describe("estVariante", () => {
  it("reconnait les trois largeurs generees", () => {
    expect(estVariante("abc-400.webp")).toBe(true);
    expect(estVariante("abc-800.webp")).toBe(true);
    expect(estVariante("abc-1600.webp")).toBe(true);
  });

  it("ne prend pas une canonique pour une variante", () => {
    expect(estVariante("abc.webp")).toBe(false);
  });

  /**
   * Le piege de l'idempotence : sans ce filtre, `abc-400.webp` serait traite
   * comme un original et produirait `abc-400-400.webp` a chaque relance.
   */
  it("ne prend pas un nombre quelconque pour une largeur", () => {
    expect(estVariante("promo-2024.webp")).toBe(false);
    expect(estVariante("photo-12.webp")).toBe(false);
  });

  it("n'est pas une variante si l'extension differe", () => {
    expect(estVariante("abc-400.jpg")).toBe(false);
  });
});

describe("decideFichier", () => {
  const vide = new Set<string>();

  it("convertit un jpg sans canonique", () => {
    expect(decideFichier("abc.jpg", new Set(["abc.jpg"]))).toEqual({
      action: "convertir",
      base: "abc",
    });
  });

  it("ignore un fichier dont la canonique existe deja", () => {
    const presents = new Set(["abc.jpg", "abc.webp"]);
    expect(decideFichier("abc.jpg", presents)).toEqual({
      action: "ignorer",
      raison: "deja-converti",
    });
  });

  it("ignore la canonique elle-meme", () => {
    expect(decideFichier("abc.webp", new Set(["abc.webp"]))).toEqual({
      action: "ignorer",
      raison: "deja-converti",
    });
  });

  it("ignore les variantes", () => {
    expect(decideFichier("abc-800.webp", vide)).toEqual({
      action: "ignorer",
      raison: "variante",
    });
  });

  it("ignore un fichier qui n'est pas une image", () => {
    expect(decideFichier("notes.txt", vide)).toEqual({
      action: "ignorer",
      raison: "extension-inconnue",
    });
  });

  /**
   * Idempotence : rejouer la meme decision sur l'etat resultant ne doit plus
   * rien convertir.
   */
  it("est idempotent apres une premiere passe", () => {
    const avant = new Set(["abc.jpg"]);
    expect(decideFichier("abc.jpg", avant).action).toBe("convertir");

    const apres = new Set(["abc.jpg", "abc.webp", "abc-400.webp"]);
    expect(decideFichier("abc.jpg", apres).action).toBe("ignorer");
    expect(decideFichier("abc.webp", apres).action).toBe("ignorer");
    expect(decideFichier("abc-400.webp", apres).action).toBe("ignorer");
  });
});

describe("reecrireUrl", () => {
  const converties = new Set(["abc"]);

  it("reecrit un jpg converti vers sa canonique webp", () => {
    expect(reecrireUrl("/uploads/abc.jpg", converties)).toBe("/uploads/abc.webp");
  });

  /**
   * La regle qui evite les images cassees : on ne pointe jamais vers un
   * fichier qu'on n'a pas ecrit. Une conversion en echec laisse l'URL sur
   * l'original, qui reste sur le disque.
   */
  it("laisse l'URL intacte si la conversion a echoue", () => {
    expect(reecrireUrl("/uploads/inconnu.jpg", converties)).toBe(
      "/uploads/inconnu.jpg",
    );
  });

  it("laisse intacte une URL deja en webp", () => {
    expect(reecrireUrl("/uploads/abc.webp", converties)).toBe("/uploads/abc.webp");
  });

  it("ne touche pas aux chemins hors /uploads/", () => {
    expect(reecrireUrl("/images/hero.jpg", converties)).toBe("/images/hero.jpg");
    expect(reecrireUrl("https://cdn.example/x.jpg", converties)).toBe(
      "https://cdn.example/x.jpg",
    );
  });

  it("ne touche pas a une chaine vide", () => {
    expect(reecrireUrl("", converties)).toBe("");
  });

  it("ne s'aventure pas dans un sous-dossier", () => {
    expect(reecrireUrl("/uploads/sous/abc.jpg", new Set(["abc"]))).toBe(
      "/uploads/sous/abc.jpg",
    );
  });

  it("est idempotent", () => {
    const une = reecrireUrl("/uploads/abc.jpg", converties);
    expect(reecrireUrl(une, converties)).toBe(une);
  });
});

describe("reecrireTableau", () => {
  const converties = new Set(["a", "b"]);

  it("rend null quand rien ne change", () => {
    expect(reecrireTableau(["/uploads/a.webp"], converties)).toBe(null);
    expect(reecrireTableau([], converties)).toBe(null);
  });

  it("reecrit et preserve l'ordre", () => {
    expect(
      reecrireTableau(["/uploads/a.jpg", "/images/x.png", "/uploads/b.png"], converties),
    ).toEqual(["/uploads/a.webp", "/images/x.png", "/uploads/b.webp"]);
  });

  /** L'ordre des photos est celui choisi par le salon : il ne doit pas bouger. */
  it("ne reordonne pas quand une seule entree change", () => {
    expect(
      reecrireTableau(["/uploads/z.jpg", "/uploads/a.jpg"], converties),
    ).toEqual(["/uploads/z.jpg", "/uploads/a.webp"]);
  });
});

describe("formaterOctets", () => {
  it("choisit l'unite lisible", () => {
    expect(formaterOctets(512)).toBe("512 o");
    expect(formaterOctets(2048)).toBe("2.0 Ko");
    expect(formaterOctets(5 * 1024 * 1024)).toBe("5.00 Mo");
  });
});
