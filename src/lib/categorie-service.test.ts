import { describe, it, expect } from "vitest";
import {
  validerNomCategorie,
  memeCategorie,
  cleComparaison,
  nomDejaPris,
  trierCategories,
  dansCategorie,
  prochainePosition,
  NOM_MAX,
  NOM_MIN,
  CATEGORIES_MAX,
} from "./categorie-service";

describe("validerNomCategorie", () => {
  it("accepte un nom normal et le rend nettoye", () => {
    const v = validerNomCategorie("  Cheveux  ");
    expect(v).toEqual({ ok: true, nom: "Cheveux" });
  });

  /*
   * « Soins   visage » et « Soins visage » doivent etre la MEME categorie :
   * sinon un salon se retrouve avec deux onglets identiques a l'oeil.
   */
  it("ramene les espaces internes multiples a un seul", () => {
    const v = validerNomCategorie("Soins   visage");
    expect(v).toEqual({ ok: true, nom: "Soins visage" });
  });

  it("refuse un nom trop court", () => {
    for (const s of ["", " ", "a", "  b  "]) {
      expect(validerNomCategorie(s).ok, s).toBe(false);
    }
  });

  it("accepte pile a la longueur minimale", () => {
    expect(validerNomCategorie("ab").ok).toBe(true);
  });

  it("refuse un nom trop long", () => {
    expect(validerNomCategorie("a".repeat(NOM_MAX + 1)).ok).toBe(false);
  });

  it("accepte pile a la longueur maximale", () => {
    expect(validerNomCategorie("a".repeat(NOM_MAX)).ok).toBe(true);
  });

  it("refuse ce qui n'est pas une chaine", () => {
    for (const v of [null, undefined, 42, {}, []]) {
      expect(validerNomCategorie(v).ok).toBe(false);
    }
  });

  it("accepte les accents et les espaces", () => {
    expect(validerNomCategorie("Épilation du corps")).toEqual({
      ok: true,
      nom: "Épilation du corps",
    });
  });

  it("borne a 20 categories, une limite d'USAGE pas technique", () => {
    // Au-dela, la barre d'onglets devient illisible au comptoir.
    expect(CATEGORIES_MAX).toBe(20);
    expect(NOM_MIN).toBe(2);
    expect(NOM_MAX).toBe(30);
  });
});

describe("memeCategorie — eviter les doublons a l'oeil", () => {
  it("ignore la casse", () => {
    expect(memeCategorie("Cheveux", "cheveux")).toBe(true);
    expect(memeCategorie("CHEVEUX", "Cheveux")).toBe(true);
  });

  /*
   * « Épilation » et « Epilation » sont une seule categorie. Sans cela, un
   * salon finit avec deux onglets qui se ressemblent et des services
   * eparpilles entre eux.
   */
  it("ignore les accents", () => {
    expect(memeCategorie("Épilation", "Epilation")).toBe(true);
    expect(memeCategorie("Coiffure à domicile", "Coiffure a domicile")).toBe(true);
  });

  it("ignore les espaces de bordure et les doublons internes", () => {
    expect(memeCategorie("  Cheveux ", "Cheveux")).toBe(true);
    expect(memeCategorie("Soins  visage", "Soins visage")).toBe(true);
  });

  it("distingue deux vraies categories differentes", () => {
    expect(memeCategorie("Cheveux", "Ongles")).toBe(false);
    expect(memeCategorie("Soin visage", "Soin corps")).toBe(false);
  });

  it("produit une cle de comparaison stable", () => {
    expect(cleComparaison("  ÉPILATION  Jambes ")).toBe("epilation jambes");
  });
});

describe("nomDejaPris", () => {
  const existants = ["Cheveux", "Ongles", "Épilation"];

  it("detecte un doublon exact", () => {
    expect(nomDejaPris("Cheveux", existants)).toBe(true);
  });

  it("detecte un doublon malgre la casse ou les accents", () => {
    expect(nomDejaPris("cheveux", existants)).toBe(true);
    expect(nomDejaPris("EPILATION", existants)).toBe(true);
  });

  it("laisse passer un nom neuf", () => {
    expect(nomDejaPris("Massage", existants)).toBe(false);
  });

  it("laisse passer sur une liste vide", () => {
    expect(nomDejaPris("Cheveux", [])).toBe(false);
  });
});

describe("trierCategories", () => {
  it("trie par position croissante", () => {
    const t = trierCategories([
      { nom: "C", position: 2 },
      { nom: "A", position: 0 },
      { nom: "B", position: 1 },
    ]);
    expect(t.map((c) => c.nom)).toEqual(["A", "B", "C"]);
  });

  it("departage deux positions egales par le nom", () => {
    // Un ordre STABLE plutot qu'aleatoire : les onglets ne doivent pas
    // changer de place d'un affichage a l'autre.
    const t = trierCategories([
      { nom: "Zeste", position: 0 },
      { nom: "Avocat", position: 0 },
    ]);
    expect(t.map((c) => c.nom)).toEqual(["Avocat", "Zeste"]);
  });

  it("trie les accents selon l'usage francais", () => {
    const t = trierCategories([
      { nom: "Zebre", position: 0 },
      { nom: "Épilation", position: 0 },
    ]);
    expect(t[0].nom).toBe("Épilation");
  });

  it("ne modifie pas le tableau d'origine", () => {
    const source = [
      { nom: "B", position: 1 },
      { nom: "A", position: 0 },
    ];
    trierCategories(source);
    expect(source[0].nom).toBe("B");
  });

  it("supporte une liste vide", () => {
    expect(trierCategories([])).toEqual([]);
  });
});

describe("dansCategorie — le filtre de la grille", () => {
  it("laisse tout passer sans filtre", () => {
    expect(dansCategorie("c1", null)).toBe(true);
    expect(dansCategorie(null, null)).toBe(true);
  });

  it("ne garde que la categorie demandee", () => {
    expect(dansCategorie("c1", "c1")).toBe(true);
    expect(dansCategorie("c2", "c1")).toBe(false);
  });

  /*
   * UN SERVICE NON CLASSE EST NORMAL, pas une anomalie : tous les services
   * existants le sont au moment ou cette fonctionnalite arrive. Ils doivent
   * rester visibles dans « Tout ».
   */
  it("affiche un service non classe dans « Tout »", () => {
    expect(dansCategorie(null, null)).toBe(true);
  });

  it("masque un service non classe quand une categorie est choisie", () => {
    expect(dansCategorie(null, "c1")).toBe(false);
  });
});

describe("prochainePosition", () => {
  it("commence a zero sur une liste vide", () => {
    expect(prochainePosition([])).toBe(0);
  });

  /*
   * Une categorie neuve va EN FIN de liste : l'inserer en tete bousculerait
   * l'ordre que le salon a mis en place.
   */
  it("place la nouvelle apres la derniere", () => {
    expect(prochainePosition([0, 1, 2])).toBe(3);
  });

  it("supporte des positions non contigues", () => {
    expect(prochainePosition([0, 5, 2])).toBe(6);
  });
});
