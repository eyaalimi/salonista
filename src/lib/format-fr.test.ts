import { describe, it, expect } from "vitest";
import {
  accord,
  motAccorde,
  dateRelative,
  dateCourte,
  dateHeure,
  depuisJours,
} from "./format-fr";

const T = new Date("2026-10-13T14:00:00");
const jours = (n: number) => {
  const d = new Date(T);
  d.setDate(d.getDate() + n);
  return d;
};

describe("accord", () => {
  // La regle que « salon(s) » masquait : en francais, 0 reste au singulier.
  it("laisse 0 et 1 au singulier", () => {
    expect(accord(0, "salon")).toBe("0 salon");
    expect(accord(1, "salon")).toBe("1 salon");
  });

  it("met au pluriel a partir de 2", () => {
    expect(accord(2, "salon")).toBe("2 salons");
    expect(accord(18, "salon")).toBe("18 salons");
  });

  it("accepte un pluriel irregulier", () => {
    expect(accord(2, "journal", "journaux")).toBe("2 journaux");
    expect(accord(1, "journal", "journaux")).toBe("1 journal");
  });

  it("accorde aussi les nombres negatifs", () => {
    expect(accord(-3, "jour")).toBe("-3 jours");
  });

  it("motAccorde rend le mot seul", () => {
    expect(motAccorde(1, "bloqué")).toBe("bloqué");
    expect(motAccorde(3, "bloqué")).toBe("bloqués");
  });
});

describe("dateRelative", () => {
  it("dit « jamais » sans date", () => {
    expect(dateRelative(null, T)).toBe("jamais");
  });

  // Ce qui remplace « inscrit il y a 0 jour(s) ».
  it("dit aujourd'hui, hier, demain", () => {
    expect(dateRelative(T, T)).toBe("aujourd'hui");
    expect(dateRelative(jours(-1), T)).toBe("hier");
    expect(dateRelative(jours(1), T)).toBe("demain");
  });

  it("compte en jours au-dela", () => {
    expect(dateRelative(jours(-3), T)).toBe("il y a 3 jours");
    expect(dateRelative(jours(-2), T)).toBe("il y a 2 jours");
  });

  // Les JOURS CALENDAIRES, pas 24 h : 23h hier et 1h ce matin ne sont
  // separes que de deux heures, et pourtant « hier » et « aujourd'hui ».
  it("compare des jours calendaires, pas des tranches de 24 h", () => {
    const hier23h = new Date("2026-10-12T23:00:00");
    const ceMatin1h = new Date("2026-10-13T01:00:00");
    expect(dateRelative(hier23h, ceMatin1h)).toBe("hier");
    expect(dateRelative(ceMatin1h, ceMatin1h)).toBe("aujourd'hui");
  });

  it("bascule sur une date complete au-dela d'un mois", () => {
    const vieux = dateRelative(jours(-60), T);
    expect(vieux).not.toContain("il y a");
    expect(vieux).toMatch(/août|aout/i);
  });
});

describe("dateCourte", () => {
  it("rend un tiret sans date", () => {
    expect(dateCourte(null)).toBe("—");
  });

  it("rend jour et mois abrege", () => {
    expect(dateCourte(new Date("2026-10-02T10:00:00"))).toMatch(/2.*oct/i);
  });
});

describe("dateHeure", () => {
  it("prefixe « Auj. » le jour meme", () => {
    expect(dateHeure(new Date("2026-10-13T10:05:00"), T)).toMatch(/^Auj\. 10:05$/);
  });

  it("prefixe « Hier »", () => {
    expect(dateHeure(new Date("2026-10-12T18:40:00"), T)).toMatch(/^Hier 18:40$/);
  });

  it("donne la date au-dela", () => {
    const s = dateHeure(new Date("2026-10-07T09:12:00"), T);
    expect(s).toMatch(/oct/i);
    expect(s).toContain("09:12");
  });
});

describe("depuisJours", () => {
  it("rend un tiret sans date", () => {
    expect(depuisJours(null, T)).toBe("—");
  });

  it("dit depuis aujourd'hui / hier", () => {
    expect(depuisJours(T, T)).toBe("depuis aujourd'hui");
    expect(depuisJours(jours(-1), T)).toBe("depuis hier");
  });

  it("compte les jours au-dela", () => {
    expect(depuisJours(jours(-6), T)).toBe("depuis 6 jours");
  });

  // Une date future ne doit pas produire « depuis -2 jours ».
  it("ne descend jamais sous zero", () => {
    expect(depuisJours(jours(2), T)).toBe("depuis aujourd'hui");
  });
});
