import { describe, it, expect } from "vitest";
import {
  cleJour,
  grilleDuMois,
  indexLundi,
  joursOccupes,
  libelleMois,
  memeJour,
  moisDecale,
  plageDeLaGrille,
} from "./mois-calendrier";

describe("indexLundi", () => {
  /**
   * `getDay()` rend 0 pour dimanche. Tel quel, il decalerait toute la grille
   * d'un jour — le piege classique d'un calendrier commencant le lundi.
   */
  it("place lundi en 0 et dimanche en 6", () => {
    expect(indexLundi(new Date(2026, 7, 24))).toBe(0); // lundi 24 aout 2026
    expect(indexLundi(new Date(2026, 7, 30))).toBe(6); // dimanche 30
  });
});

describe("grilleDuMois", () => {
  it("rend toujours 42 cases", () => {
    for (let m = 0; m < 12; m++) {
      expect(grilleDuMois(2026, m)).toHaveLength(42);
    }
  });

  it("commence un lundi", () => {
    for (let m = 0; m < 12; m++) {
      expect(indexLundi(grilleDuMois(2026, m)[0].date)).toBe(0);
    }
  });

  it("contient tous les jours du mois", () => {
    const cases = grilleDuMois(2026, 7); // aout : 31 jours
    expect(cases.filter((c) => c.dansLeMois)).toHaveLength(31);
  });

  it("marque les debordements des mois voisins", () => {
    // Aout 2026 commence un samedi : la grille demarre le lundi 27 juillet.
    const cases = grilleDuMois(2026, 7);
    expect(cases[0].dansLeMois).toBe(false);
    expect(cases[0].date.getMonth()).toBe(6); // juillet
    expect(cases[0].date.getDate()).toBe(27);
  });

  /** Fevrier 2027 fait pile 28 jours et commence un lundi : cas limite. */
  it("gere un mois de 28 jours commencant un lundi", () => {
    const cases = grilleDuMois(2027, 1);
    expect(cases[0].dansLeMois).toBe(true);
    expect(cases[0].date.getDate()).toBe(1);
    expect(cases.filter((c) => c.dansLeMois)).toHaveLength(28);
  });

  it("gere une annee bissextile", () => {
    expect(grilleDuMois(2028, 1).filter((c) => c.dansLeMois)).toHaveLength(29);
  });

  it("enchaine les jours sans trou ni doublon", () => {
    const cases = grilleDuMois(2026, 7);
    for (let i = 1; i < cases.length; i++) {
      const ecart =
        (cases[i].date.getTime() - cases[i - 1].date.getTime()) / 86_400_000;
      // Tolerance : un changement d'heure fait varier l'ecart de +/- 1 h.
      expect(Math.round(ecart)).toBe(1);
    }
  });
});

describe("plageDeLaGrille", () => {
  it("couvre la premiere et la derniere case", () => {
    const { debut, fin } = plageDeLaGrille(2026, 7);
    const cases = grilleDuMois(2026, 7);
    expect(memeJour(debut, cases[0].date)).toBe(true);
    // La borne haute est exclusive : le lendemain de la derniere case.
    expect(fin.getTime()).toBeGreaterThan(cases[41].date.getTime());
  });
});

describe("cleJour / joursOccupes", () => {
  it("formate en AAAA-MM-JJ avec zeros", () => {
    expect(cleJour(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(cleJour(new Date(2026, 11, 31))).toBe("2026-12-31");
  });

  /**
   * Le piege : `toISOString()` bascule en UTC. Un rendez-vous a 00 h 30 heure
   * locale serait range la VEILLE, et la pastille apparaitrait sur le mauvais
   * jour. On lit donc la date en local.
   */
  it("range un rendez-vous de nuit sur son jour local", () => {
    const minuitTrente = new Date(2026, 7, 26, 0, 30);
    expect(cleJour(minuitTrente)).toBe("2026-08-26");
  });

  it("dedoublonne plusieurs rendez-vous du meme jour", () => {
    const s = joursOccupes([
      new Date(2026, 7, 26, 9, 0).toISOString(),
      new Date(2026, 7, 26, 14, 0).toISOString(),
      new Date(2026, 7, 27, 10, 0).toISOString(),
    ]);
    expect(s.size).toBe(2);
    expect(s.has("2026-08-26")).toBe(true);
    expect(s.has("2026-08-27")).toBe(true);
  });

  it("ignore une date invalide sans planter", () => {
    expect(joursOccupes(["pas une date"]).size).toBe(0);
  });

  it("accepte une liste vide", () => {
    expect(joursOccupes([]).size).toBe(0);
  });
});

describe("moisDecale", () => {
  it("avance et recule d'un mois", () => {
    expect(moisDecale(2026, 7, 1)).toEqual({ annee: 2026, mois: 8 });
    expect(moisDecale(2026, 7, -1)).toEqual({ annee: 2026, mois: 6 });
  });

  it("franchit l'annee dans les deux sens", () => {
    expect(moisDecale(2026, 11, 1)).toEqual({ annee: 2027, mois: 0 });
    expect(moisDecale(2026, 0, -1)).toEqual({ annee: 2025, mois: 11 });
  });
});

describe("memeJour", () => {
  it("ignore l'heure", () => {
    expect(memeJour(new Date(2026, 7, 26, 9), new Date(2026, 7, 26, 21))).toBe(true);
  });

  it("distingue le meme quantieme d'un autre mois", () => {
    expect(memeJour(new Date(2026, 7, 26), new Date(2026, 8, 26))).toBe(false);
  });
});

describe("libelleMois", () => {
  it("rend le mois et l'annee en francais", () => {
    expect(libelleMois(2026, 7)).toMatch(/août 2026/i);
  });
});
