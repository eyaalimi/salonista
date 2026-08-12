import { describe, it, expect } from "vitest";
import { isOutsideOpeningHours, findConflicts } from "./booking-conflicts";
import { emptyOpeningHours, type OpeningHours } from "./opening-hours";

// 2026-08-15 est un SAMEDI, 2026-08-17 un LUNDI. Verifie avec :
//   new Date(2026, 7, 15).getDay() === 6
const SAMEDI = (h: number, m = 0) => new Date(2026, 7, 15, h, m, 0, 0);
const LUNDI = (h: number, m = 0) => new Date(2026, 7, 17, h, m, 0, 0);

const ouvertEnSemaine: OpeningHours = {
  ...emptyOpeningHours(),
  mon: [{ start: "09:00", end: "18:00" }],
  sat: [],
};

describe("isOutsideOpeningHours", () => {
  it("un creneau pendant une plage ouverte n'est pas en conflit", () => {
    expect(isOutsideOpeningHours(LUNDI(10), ouvertEnSemaine)).toBe(false);
  });

  it("un creneau un jour ferme est en conflit", () => {
    expect(isOutsideOpeningHours(SAMEDI(10), ouvertEnSemaine)).toBe(true);
  });

  it("un creneau avant l'ouverture est en conflit", () => {
    expect(isOutsideOpeningHours(LUNDI(8), ouvertEnSemaine)).toBe(true);
  });

  it("un creneau apres la fermeture est en conflit", () => {
    expect(isOutsideOpeningHours(LUNDI(18, 30), ouvertEnSemaine)).toBe(true);
  });

  it("l'heure d'ouverture exacte n'est pas en conflit", () => {
    expect(isOutsideOpeningHours(LUNDI(9), ouvertEnSemaine)).toBe(false);
  });

  it("l'heure de fermeture exacte EST en conflit — le service commencerait a la fermeture", () => {
    expect(isOutsideOpeningHours(LUNDI(18), ouvertEnSemaine)).toBe(true);
  });

  it("gere les plages multiples (pause dejeuner)", () => {
    const avecPause: OpeningHours = {
      ...emptyOpeningHours(),
      mon: [
        { start: "09:00", end: "12:00" },
        { start: "14:00", end: "18:00" },
      ],
    };
    expect(isOutsideOpeningHours(LUNDI(10), avecPause)).toBe(false);
    expect(isOutsideOpeningHours(LUNDI(13), avecPause)).toBe(true);
    expect(isOutsideOpeningHours(LUNDI(15), avecPause)).toBe(false);
  });

  it("des horaires entierement vides mettent tout en conflit", () => {
    expect(isOutsideOpeningHours(LUNDI(10), emptyOpeningHours())).toBe(true);
  });
});

describe("findConflicts", () => {
  const creneaux = [
    { startTime: LUNDI(10), offerTitle: "Coupe femme" },
    { startTime: SAMEDI(10), offerTitle: "Balayage" },
    { startTime: SAMEDI(14), offerTitle: "Brushing" },
  ];

  it("ne retient que les creneaux hors horaires", () => {
    const r = findConflicts(creneaux, ouvertEnSemaine);
    expect(r.map((c) => c.offerTitle)).toEqual(["Balayage", "Brushing"]);
  });

  it("trie par date croissante", () => {
    const desordre = [
      { startTime: SAMEDI(14), offerTitle: "Brushing" },
      { startTime: SAMEDI(10), offerTitle: "Balayage" },
    ];
    const r = findConflicts(desordre, ouvertEnSemaine);
    expect(r.map((c) => c.offerTitle)).toEqual(["Balayage", "Brushing"]);
  });

  it("renvoie un tableau vide quand tout rentre dans les horaires", () => {
    const ouvertPartout: OpeningHours = {
      mon: [{ start: "00:00", end: "23:59" }],
      tue: [{ start: "00:00", end: "23:59" }],
      wed: [{ start: "00:00", end: "23:59" }],
      thu: [{ start: "00:00", end: "23:59" }],
      fri: [{ start: "00:00", end: "23:59" }],
      sat: [{ start: "00:00", end: "23:59" }],
      sun: [{ start: "00:00", end: "23:59" }],
    };
    expect(findConflicts(creneaux, ouvertPartout)).toEqual([]);
  });

  it("une liste vide ne produit aucun conflit", () => {
    expect(findConflicts([], ouvertEnSemaine)).toEqual([]);
  });
});
