import { describe, it, expect } from "vitest";
import {
  horairesRenseignes,
  raisonAbsenceCreneaux,
  messageAbsence,
} from "./creneaux-absents";
import { etapesDemarrage } from "./onboarding-salon";

const HORAIRES = { lundi: [{ debut: "09:00", fin: "18:00" }] };

describe("horairesRenseignes", () => {
  it("accepte un objet non vide", () => {
    expect(horairesRenseignes(HORAIRES)).toBe(true);
  });

  it("refuse l'absence d'horaires sous toutes ses formes", () => {
    expect(horairesRenseignes({})).toBe(false);
    expect(horairesRenseignes(null)).toBe(false);
    expect(horairesRenseignes(undefined)).toBe(false);
    expect(horairesRenseignes("")).toBe(false);
  });

  // Prisma rend du JSON : un tableau vide ne doit pas passer pour un objet
  // rempli, sans quoi on dirait « journee complete » a un salon sans horaires.
  it("refuse un tableau", () => {
    expect(horairesRenseignes([])).toBe(false);
    expect(horairesRenseignes([{ jour: "lundi" }])).toBe(false);
  });

  // Les deux fonctions repondent a la meme question et doivent rester
  // d'accord : si l'une evolue, ce test tombe.
  it("concorde avec etapesDemarrage sur les memes entrees", () => {
    for (const valeur of [HORAIRES, {}, null]) {
      const viaEtapes = etapesDemarrage(
        { address: "r", city: "v", photos: ["/a"], openingHours: valeur },
        1,
      )[2].faite;
      expect(horairesRenseignes(valeur)).toBe(viaEtapes);
    }
  });
});

describe("raisonAbsenceCreneaux", () => {
  it("ne dit rien quand il y a des creneaux", () => {
    expect(
      raisonAbsenceCreneaux({ nombreCreneaux: 3, openingHours: HORAIRES }),
    ).toBeNull();
    // Meme sans horaires : s'il y a des creneaux, il n'y a rien a expliquer.
    expect(raisonAbsenceCreneaux({ nombreCreneaux: 1, openingHours: null })).toBeNull();
  });

  // Le coeur du probleme : sans horaires, AUCUN jour ne marchera jamais.
  it("designe les horaires quand ils manquent", () => {
    expect(raisonAbsenceCreneaux({ nombreCreneaux: 0, openingHours: null })).toBe(
      "horaires-absents",
    );
    expect(raisonAbsenceCreneaux({ nombreCreneaux: 0, openingHours: {} })).toBe(
      "horaires-absents",
    );
  });

  it("parle de journee complete quand les horaires existent", () => {
    expect(
      raisonAbsenceCreneaux({ nombreCreneaux: 0, openingHours: HORAIRES }),
    ).toBe("jour-complet");
  });
});

describe("messageAbsence", () => {
  it("donne une CONSIGNE quand les horaires manquent, pas un constat", () => {
    const m = messageAbsence("horaires-absents");
    expect(m.titre).toContain("horaires");
    expect(m.lienHoraires).toBe(true);
    // Surtout pas « choisissez un autre jour » : aucun jour ne marchera.
    expect(m.detail).not.toContain("autre jour");
    expect(m.titre).not.toContain("autre jour");
  });

  it("propose de changer de jour quand les horaires existent", () => {
    const m = messageAbsence("jour-complet");
    expect(m.detail).toContain("autre jour");
    // Un lien vers les horaires n'aurait aucun sens ici.
    expect(m.lienHoraires).toBe(false);
  });

  it("chaque raison a un titre et un detail non vides", () => {
    for (const r of ["horaires-absents", "jour-complet"] as const) {
      const m = messageAbsence(r);
      expect(m.titre.length).toBeGreaterThan(0);
      expect(m.detail.length).toBeGreaterThan(0);
    }
  });
});
