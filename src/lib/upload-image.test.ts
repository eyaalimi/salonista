import { describe, it, expect } from "vitest";
import {
  refusFormat,
  refusTaille,
  refusNombre,
  refusQuota,
  nomVariante,
  largeursAGenerer,
  aDesVariantes,
  urlVariante,
  TAILLE_MAX,
  ENVOIS_MAX_PAR_JOUR,
} from "./upload-image";

describe("refusFormat", () => {
  it("accepte les quatre formats d'image", () => {
    for (const f of ["jpeg", "png", "webp", "avif"]) {
      expect(refusFormat(f)).toBe(null);
    }
  });

  /**
   * Le coeur de la faille : on deposait un .html ou un .svg en declarant
   * image/png. Sharp ne reconnait pas le HTML, et le SVG — qui peut porter du
   * script — n'est pas dans la liste blanche.
   */
  it("refuse un fichier que sharp ne reconnait pas (HTML renomme)", () => {
    expect(refusFormat(undefined)?.status).toBe(400);
  });

  it("refuse le SVG : il peut porter du script", () => {
    expect(refusFormat("svg")?.status).toBe(400);
  });

  it("refuse le GIF, hors liste blanche", () => {
    expect(refusFormat("gif")?.status).toBe(400);
  });

  it("rend un message en francais", () => {
    expect(refusFormat("svg")?.message).toMatch(/image valide/i);
  });
});

describe("refusTaille", () => {
  it("accepte une image sous la limite", () => {
    expect(refusTaille(1024)).toBe(null);
  });

  it("accepte exactement la limite", () => {
    expect(refusTaille(TAILLE_MAX)).toBe(null);
  });

  it("refuse au-dela de la limite", () => {
    expect(refusTaille(TAILLE_MAX + 1)?.status).toBe(400);
  });

  it("refuse un fichier vide", () => {
    expect(refusTaille(0)?.message).toMatch(/vide/i);
  });
});

describe("refusNombre", () => {
  it("accepte de une a cinq images", () => {
    expect(refusNombre(1)).toBe(null);
    expect(refusNombre(5)).toBe(null);
  });

  it("refuse zero image", () => {
    expect(refusNombre(0)?.message).toMatch(/aucun fichier/i);
  });

  it("refuse au-dela de cinq", () => {
    expect(refusNombre(6)?.status).toBe(400);
  });
});

describe("refusQuota", () => {
  it("laisse passer sous le quota", () => {
    expect(refusQuota(0)).toBe(null);
    expect(refusQuota(ENVOIS_MAX_PAR_JOUR - 1)).toBe(null);
  });

  it("refuse une fois le quota atteint, en 429", () => {
    const r = refusQuota(ENVOIS_MAX_PAR_JOUR);
    expect(r?.status).toBe(429);
    expect(r?.message).toMatch(/limite d'envois/i);
  });
});

describe("nomVariante", () => {
  it("compose le nom depuis la base et la largeur", () => {
    expect(nomVariante("abc-123", 800)).toBe("abc-123-800.webp");
  });

  /**
   * L'extension ne vient JAMAIS du nom d'origine : c'est ce qui permettait de
   * deposer un .html. Elle est fixee par le code.
   */
  it("impose toujours l'extension webp", () => {
    expect(nomVariante("x", 400).endsWith(".webp")).toBe(true);
  });
});

describe("largeursAGenerer", () => {
  it("genere les trois tailles pour une grande image", () => {
    expect(largeursAGenerer(2000)).toEqual([400, 800, 1600]);
  });

  it("n'agrandit jamais au-dela de la source", () => {
    expect(largeursAGenerer(900)).toEqual([400, 800]);
  });

  it("inclut une largeur egale a la source", () => {
    expect(largeursAGenerer(800)).toEqual([400, 800]);
  });

  it("genere au moins la plus petite, meme pour une image minuscule", () => {
    // Sans ce repli, une image de 100 px n'aurait aucune variante — donc
    // rien a servir.
    expect(largeursAGenerer(100)).toEqual([400]);
  });
});

describe("aDesVariantes", () => {
  it("reconnait une image televersee depuis le lot C", () => {
    expect(aDesVariantes("/uploads/abc.webp")).toBe(true);
  });

  /**
   * Les images d'avant ce lot sont en .jpg ou .png et n'ont pas de variantes.
   * Leur en demander produirait des 404 en cascade.
   */
  it("ecarte les images d'avant les variantes", () => {
    expect(aDesVariantes("/uploads/ancienne.jpg")).toBe(false);
    expect(aDesVariantes("/uploads/ancienne.png")).toBe(false);
  });

  it("ecarte ce qui ne vient pas de /uploads/", () => {
    expect(aDesVariantes("/images/hero.webp")).toBe(false);
    expect(aDesVariantes("https://exemple.tn/photo.webp")).toBe(false);
  });
});

describe("urlVariante", () => {
  it("sert la variante exacte quand elle existe", () => {
    expect(urlVariante("/uploads/abc.webp", 800)).toBe("/uploads/abc-800.webp");
  });

  /**
   * Next reclame des largeurs arbitraires (256, 384, 1080…). Servir plus
   * petit que demande afficherait une image visiblement floue : on arrondit
   * toujours vers le haut.
   */
  it("arrondit vers la variante superieure", () => {
    expect(urlVariante("/uploads/abc.webp", 256)).toBe("/uploads/abc-400.webp");
    expect(urlVariante("/uploads/abc.webp", 640)).toBe("/uploads/abc-800.webp");
    expect(urlVariante("/uploads/abc.webp", 1080)).toBe("/uploads/abc-1600.webp");
  });

  it("plafonne a la plus grande variante", () => {
    expect(urlVariante("/uploads/abc.webp", 3000)).toBe("/uploads/abc-1600.webp");
  });

  it("laisse intacte une image sans variantes", () => {
    expect(urlVariante("/uploads/ancienne.jpg", 800)).toBe("/uploads/ancienne.jpg");
  });
});
