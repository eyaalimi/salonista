import { describe, it, expect } from "vitest";
import {
  CATEGORIES_DEPENSE,
  MONTANT_MAX_DEPENSE,
  libelleCategorieDepense,
  lireMontant,
  refusDepense,
} from "./depense-caisse";

describe("lireMontant", () => {
  it("lit un montant decimal", () => {
    expect(lireMontant("12.500")).toBe(12.5);
  });

  // Ce qu'une caissiere tape, et que `Number` refuse.
  it("accepte la virgule decimale", () => {
    expect(lireMontant("12,5")).toBe(12.5);
  });

  it("rend null pour une saisie vide ou illisible", () => {
    expect(lireMontant("")).toBeNull();
    expect(lireMontant("  ")).toBeNull();
    expect(lireMontant("abc")).toBeNull();
  });
});

describe("refusDepense — les memes regles que le serveur", () => {
  it("accepte une depense complete", () => {
    expect(refusDepense({ montant: "25", motif: "Livraison shampoing" })).toBeNull();
  });

  it("exige un montant strictement positif", () => {
    expect(refusDepense({ montant: "", motif: "x" })).toMatch(/montant/i);
    expect(refusDepense({ montant: "0", motif: "x" })).toMatch(/montant/i);
    expect(refusDepense({ montant: "-5", motif: "x" })).toMatch(/montant/i);
  });

  it("refuse au-dela du plafond", () => {
    expect(refusDepense({ montant: String(MONTANT_MAX_DEPENSE + 1), motif: "x" })).not.toBeNull();
    expect(refusDepense({ montant: String(MONTANT_MAX_DEPENSE), motif: "x" })).toBeNull();
  });

  // Le serveur refuse un motif vide : le dire avant l'envoi.
  it("exige un motif", () => {
    expect(refusDepense({ montant: "25", motif: "   " })).toMatch(/motif/i);
  });
});

describe("categories", () => {
  it("chaque categorie a un libelle", () => {
    for (const c of CATEGORIES_DEPENSE) expect(libelleCategorieDepense(c.value)).toBe(c.label);
  });

  it("rend la valeur brute d'une categorie inconnue", () => {
    expect(libelleCategorieDepense("INCONNUE")).toBe("INCONNUE");
  });
});
