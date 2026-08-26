import { describe, it, expect } from "vitest";
import {
  GOUVERNORATS,
  adresseComplete,
  delegationAppartient,
  delegationsDe,
  gouvernoratExiste,
  nomsGouvernorats,
  refusAdresseSalon,
} from "./tunisie-geo";

describe("GOUVERNORATS", () => {
  it("compte les 24 gouvernorats tunisiens", () => {
    expect(GOUVERNORATS).toHaveLength(24);
  });

  it("n'a ni doublon ni gouvernorat sans delegation", () => {
    const noms = GOUVERNORATS.map((g) => g.nom);
    expect(new Set(noms).size).toBe(noms.length);
    for (const g of GOUVERNORATS) {
      expect(g.delegations.length).toBeGreaterThan(0);
    }
  });

  it("n'a pas de delegation en double dans un meme gouvernorat", () => {
    for (const g of GOUVERNORATS) {
      expect(new Set(g.delegations).size).toBe(g.delegations.length);
    }
  });

  it("contient les gouvernorats les plus peuples", () => {
    const noms = nomsGouvernorats();
    for (const attendu of ["Tunis", "Sfax", "Sousse", "Ariana", "Nabeul"]) {
      expect(noms).toContain(attendu);
    }
  });
});

describe("delegationsDe", () => {
  it("rend les delegations d'un gouvernorat", () => {
    expect(delegationsDe("Sousse")).toContain("Sousse Médina");
    expect(delegationsDe("Tunis")).toContain("La Marsa");
  });

  /** Un gouvernorat inconnu doit donner un selecteur vide, pas une erreur. */
  it("rend une liste vide sans planter", () => {
    expect(delegationsDe("Paris")).toEqual([]);
    expect(delegationsDe(null)).toEqual([]);
    expect(delegationsDe(undefined)).toEqual([]);
    expect(delegationsDe("")).toEqual([]);
  });
});

describe("delegationAppartient", () => {
  it("accepte un couple coherent", () => {
    expect(delegationAppartient("Sousse", "Hammam Sousse")).toBe(true);
  });

  /**
   * Le coeur du controle : sans lui, on enregistrerait « Sousse / La Marsa »,
   * une delegation qui existe mais pas dans ce gouvernorat.
   */
  it("refuse une delegation d'un AUTRE gouvernorat", () => {
    expect(delegationAppartient("Sousse", "La Marsa")).toBe(false);
    expect(delegationAppartient("Tunis", "Hammam Sousse")).toBe(false);
  });

  it("refuse ce qui n'est pas une chaine", () => {
    expect(delegationAppartient("Sousse", null)).toBe(false);
    expect(delegationAppartient(null, "La Marsa")).toBe(false);
    expect(delegationAppartient(42, 7)).toBe(false);
  });
});

describe("gouvernoratExiste", () => {
  it("distingue les vrais des faux", () => {
    expect(gouvernoratExiste("Sfax")).toBe(true);
    expect(gouvernoratExiste("Alger")).toBe(false);
    expect(gouvernoratExiste("")).toBe(false);
    expect(gouvernoratExiste(null)).toBe(false);
  });

  /** La casse compte : les valeurs viennent d'une liste, pas d'une saisie. */
  it("est sensible a la casse", () => {
    expect(gouvernoratExiste("sfax")).toBe(false);
  });
});

describe("refusAdresseSalon", () => {
  it("accepte une adresse complete", () => {
    expect(refusAdresseSalon("Sousse", "Hammam Sousse", "12 rue des Oliviers")).toBe(
      null,
    );
  });

  it("refuse un gouvernorat manquant ou inconnu", () => {
    expect(refusAdresseSalon(null, "Hammam Sousse", "12 rue X")?.message).toMatch(
      /gouvernorat/i,
    );
    expect(refusAdresseSalon("Alger", "Hammam Sousse", "12 rue X")).not.toBe(null);
  });

  it("refuse une delegation incoherente", () => {
    expect(refusAdresseSalon("Sousse", "La Marsa", "12 rue X")?.message).toMatch(
      /délégation/i,
    );
  });

  /** « Sousse Médina » seul ne permet pas de trouver un salon. */
  it("exige la rue", () => {
    expect(refusAdresseSalon("Sousse", "Hammam Sousse", "")?.message).toMatch(/rue/i);
    expect(refusAdresseSalon("Sousse", "Hammam Sousse", "  ")).not.toBe(null);
    expect(refusAdresseSalon("Sousse", "Hammam Sousse", "ab")).not.toBe(null);
  });

  it("rend des messages en francais", () => {
    expect(refusAdresseSalon(null, null, null)?.message).toMatch(/Sélectionne/);
  });
});

describe("adresseComplete", () => {
  /**
   * Nominatim geocode mal sans pays : les adresses libres echouaient. L'ordre
   * va du plus precis au plus large.
   */
  it("assemble du plus precis au plus large, avec le pays", () => {
    expect(adresseComplete("12 rue des Oliviers", "Hammam Sousse", "Sousse")).toBe(
      "12 rue des Oliviers, Hammam Sousse, Sousse, Tunisie",
    );
  });

  it("ignore les parties absentes sans laisser de virgule vide", () => {
    expect(adresseComplete(null, "Hammam Sousse", "Sousse")).toBe(
      "Hammam Sousse, Sousse, Tunisie",
    );
    expect(adresseComplete("", "  ", null)).toBe("Tunisie");
  });
});
