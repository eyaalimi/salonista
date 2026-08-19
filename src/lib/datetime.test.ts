import { describe, it, expect } from "vitest";
import {
  formatHeure,
  formatDateLongue,
  formatDateHeure,
  formatDateHeureComplete,
} from "./datetime";

// 20 aout 2026, 18h30 — heure locale, pas UTC : c'est ce que voit la cliente.
const APRES_MIDI = new Date(2026, 7, 20, 18, 30);
const MATIN = new Date(2026, 7, 20, 9, 5);
const MINUIT = new Date(2026, 7, 20, 0, 15);

describe("formatHeure", () => {
  it("affiche 18:30 et jamais 6:30 PM", () => {
    const s = formatHeure(APRES_MIDI);
    expect(s).toBe("18:30");
    expect(s).not.toMatch(/PM|AM/i);
  });

  it("garde le zero initial le matin", () => {
    expect(formatHeure(MATIN)).toBe("09:05");
  });

  it("affiche minuit en 00 et non en 12 AM", () => {
    expect(formatHeure(MINUIT)).toBe("00:15");
  });

  it("accepte une chaine ISO", () => {
    expect(formatHeure(APRES_MIDI.toISOString())).toBe("18:30");
  });
});

describe("formatDateLongue", () => {
  it("donne le jour et le mois en francais", () => {
    expect(formatDateLongue(APRES_MIDI)).toBe("jeudi 20 août");
  });
});

describe("formatDateHeure", () => {
  it("combine la date courte et l'heure sur 24h", () => {
    const s = formatDateHeure(APRES_MIDI);
    expect(s).toContain("20");
    expect(s).toContain("18:30");
    expect(s).not.toMatch(/PM|AM/i);
  });
});

describe("formatDateHeureComplete", () => {
  it("inclut l'annee et l'heure sur 24h", () => {
    const s = formatDateHeureComplete(APRES_MIDI);
    expect(s).toContain("2026");
    expect(s).toContain("18:30");
    expect(s).not.toMatch(/PM|AM/i);
  });
});
