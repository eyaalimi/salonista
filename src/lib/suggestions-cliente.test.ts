import { describe, it, expect } from "vitest";
import {
  normaliser,
  suggestionsParNom,
  telephoneAffichable,
  SUGGESTIONS_MAX,
  type ClienteSuggeree,
} from "./suggestions-cliente";
import { placeholderTelephone } from "./booking-customer";

const c = (id: string, firstName: string | null, lastName: string | null = null): ClienteSuggeree => ({
  id,
  phone: `2${id.padStart(7, "0")}`,
  firstName,
  lastName,
});

const CLIENTELE = [
  c("1", "Fatma", "Ben Ali"),
  c("2", "Raoufa", "Trabelsi"),
  c("3", "Faten", "Ferchichi"),
  c("4", "Amira", "Fekih"),
  c("5", "Élodie", "Martin"),
  c("6", null, null),
];

const ids = (l: ClienteSuggeree[]) => l.map((x) => x.id);

describe("suggestionsParNom", () => {
  // La demande : des la PREMIERE lettre.
  it("propose des la premiere lettre", () => {
    expect(suggestionsParNom(CLIENTELE, "f").length).toBeGreaterThan(0);
  });

  // « f » cherche Fatma ou Ferchichi, pas Raoufa (le f est au milieu).
  it("ne retient que les mots qui COMMENCENT par la saisie", () => {
    const r = ids(suggestionsParNom(CLIENTELE, "f"));
    expect(r).toContain("1"); // Fatma
    expect(r).toContain("3"); // Faten Ferchichi
    expect(r).toContain("4"); // Amira Fekih — par son nom de famille
    expect(r).not.toContain("2"); // Raoufa
  });

  it("met les correspondances sur le PRENOM avant celles sur le nom", () => {
    const r = ids(suggestionsParNom(CLIENTELE, "f"));
    // Fatma et Faten (prenoms) avant Amira Fekih (nom de famille).
    expect(r.indexOf("4")).toBeGreaterThan(r.indexOf("1"));
    expect(r.indexOf("4")).toBeGreaterThan(r.indexOf("3"));
  });

  it("trouve par le nom de famille", () => {
    expect(ids(suggestionsParNom(CLIENTELE, "trab"))).toEqual(["2"]);
  });

  it("accepte prenom et debut du nom ensemble", () => {
    expect(ids(suggestionsParNom(CLIENTELE, "fatma b"))).toEqual(["1"]);
  });

  // Une tablette sans clavier français ne tape pas « É ».
  it("ignore les accents et la casse", () => {
    expect(ids(suggestionsParNom(CLIENTELE, "elo"))).toEqual(["5"]);
    expect(ids(suggestionsParNom(CLIENTELE, "ÉLO"))).toEqual(["5"]);
    expect(ids(suggestionsParNom(CLIENTELE, "  fAtMa  "))).toEqual(["1"]);
  });

  it("ne propose rien pour une saisie vide", () => {
    expect(suggestionsParNom(CLIENTELE, "")).toEqual([]);
    expect(suggestionsParNom(CLIENTELE, "   ")).toEqual([]);
  });

  it("ignore les fiches sans aucun nom", () => {
    for (const lettre of "abcdefghijklmnopqrstuvwxyz") {
      expect(ids(suggestionsParNom(CLIENTELE, lettre))).not.toContain("6");
    }
  });

  it("ne depasse jamais la limite", () => {
    const beaucoup = Array.from({ length: 30 }, (_, i) => c(String(i + 10), `Sana${i}`));
    expect(suggestionsParNom(beaucoup, "s")).toHaveLength(SUGGESTIONS_MAX);
  });

  it("garde un ordre stable d'une frappe a l'autre", () => {
    expect(ids(suggestionsParNom(CLIENTELE, "f"))).toEqual(
      ids(suggestionsParNom([...CLIENTELE].reverse(), "f")),
    );
  });

  it("ne renvoie rien quand personne ne correspond", () => {
    expect(suggestionsParNom(CLIENTELE, "zz")).toEqual([]);
  });
});

describe("normaliser", () => {
  it("retire accents, casse et espaces multiples", () => {
    expect(normaliser("  Élodie   MARTIN ")).toBe("elodie martin");
  });
});

describe("telephoneAffichable", () => {
  it("masque l'identifiant interne d'une cliente sans numero", () => {
    expect(telephoneAffichable(placeholderTelephone())).toBeNull();
  });

  it("garde un vrai numero", () => {
    expect(telephoneAffichable("+21620123456")).toBe("+21620123456");
  });

  it("rend null sans numero", () => {
    expect(telephoneAffichable(null)).toBeNull();
    expect(telephoneAffichable("")).toBeNull();
  });
});
