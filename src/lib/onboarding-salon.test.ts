import { describe, it, expect } from "vitest";
import { etapesDemarrage, demarrageTermine } from "./onboarding-salon";

const PROFIL_VIDE = {
  address: null,
  city: null,
  photos: [],
  openingHours: null,
};

const PROFIL_COMPLET = {
  address: "12 rue de Marseille",
  city: "Tunis",
  photos: ["/uploads/a.jpg"],
  openingHours: { mon: { open: "09:00", close: "18:00" } },
};

describe("etapesDemarrage", () => {
  it("ne coche rien pour un salon qui vient de s'inscrire", () => {
    const e = etapesDemarrage(PROFIL_VIDE, 0);
    expect(e.map((x) => x.faite)).toEqual([false, false, false]);
  });

  it("coche le profil quand adresse, ville et photo sont la", () => {
    const e = etapesDemarrage(PROFIL_COMPLET, 0);
    expect(e[0].faite).toBe(true);
  });

  it("ne coche pas le profil s'il manque la photo", () => {
    const e = etapesDemarrage({ ...PROFIL_COMPLET, photos: [] }, 0);
    expect(e[0].faite).toBe(false);
  });

  it("ne coche pas le profil s'il manque la ville", () => {
    const e = etapesDemarrage({ ...PROFIL_COMPLET, city: null }, 0);
    expect(e[0].faite).toBe(false);
  });

  it("ignore une adresse faite d'espaces", () => {
    const e = etapesDemarrage({ ...PROFIL_COMPLET, address: "   " }, 0);
    expect(e[0].faite).toBe(false);
  });

  it("coche les services des la premiere offre publiee", () => {
    const e = etapesDemarrage(PROFIL_VIDE, 1);
    expect(e[1].faite).toBe(true);
  });

  // `nombreOffres` doit etre compte AVEC le filtre `photos: { isEmpty: false }`
  // (voir pos/calendar/page.tsx) : toutes les surfaces publiques l'exigent.
  // Une offre sans photo ne compte donc pas, et l'appelant passe 0.
  it("ne coche pas les services quand aucune offre n'est visible", () => {
    const e = etapesDemarrage(PROFIL_COMPLET, 0);
    expect(e[1].faite).toBe(false);
  });

  it("previent qu'une photo est necessaire", () => {
    const e = etapesDemarrage(PROFIL_VIDE, 0);
    expect(e[1].aide).toMatch(/photo/i);
  });

  it("coche les horaires quand openingHours est renseigne", () => {
    const e = etapesDemarrage(PROFIL_COMPLET, 0);
    expect(e[2].faite).toBe(true);
  });

  it("ne coche pas les horaires sur un objet vide", () => {
    const e = etapesDemarrage({ ...PROFIL_COMPLET, openingHours: {} }, 0);
    expect(e[2].faite).toBe(false);
  });

  it("donne a chaque etape un titre et un lien", () => {
    for (const etape of etapesDemarrage(PROFIL_VIDE, 0)) {
      expect(etape.titre.length).toBeGreaterThan(0);
      expect(etape.href.startsWith("/pos/")).toBe(true);
    }
  });
});

describe("demarrageTermine", () => {
  it("est faux tant qu'une etape manque", () => {
    expect(demarrageTermine(PROFIL_COMPLET, 0)).toBe(false);
  });

  it("est vrai quand les trois etapes sont faites", () => {
    expect(demarrageTermine(PROFIL_COMPLET, 2)).toBe(true);
  });

  it("est vrai pour un salon deja installe avant le guide", () => {
    expect(demarrageTermine(PROFIL_COMPLET, 12)).toBe(true);
  });
});
