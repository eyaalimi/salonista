import { describe, it, expect } from "vitest";
import {
  formatHeure,
  formatDateLongue,
  formatDateHeure,
  formatDateHeureComplete,
  formatDateHeureLongue,
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

describe("formatDateHeureLongue", () => {
  it("porte le jour de la semaine, l'annee ET l'heure sur 24h", () => {
    const s = formatDateHeureLongue(APRES_MIDI);
    // Le jour vient de `APRES_MIDI`, defini en haut du fichier.
    expect(s).toMatch(/jeudi/i);
    expect(s).toContain("2026");
    expect(s).toContain("18:30");
    expect(s).not.toMatch(/PM|AM/i);
  });
});

describe("aucune fonction ne laisse passer AM/PM", () => {
  /*
   * Un balayage de TOUTES les fonctions d'un coup, en plus des cas
   * individuels ci-dessus : une fonction ajoutee demain sans `hourCycle`
   * tombera ici meme si personne ne pense a lui ecrire son propre test.
   *
   * Le piege est reel — `fr-TN` est sur douze heures, et c'est la locale
   * qu'on ecrit spontanement pour la Tunisie.
   */
  it("sur le matin, l'apres-midi et minuit", () => {
    const fonctions = [
      ["formatHeure", formatHeure],
      ["formatDateHeure", formatDateHeure],
      ["formatDateHeureComplete", formatDateHeureComplete],
      ["formatDateHeureLongue", formatDateHeureLongue],
    ] as const;
    const instants = [
      new Date("2026-10-14T09:05:00"),
      new Date("2026-10-14T18:30:00"),
      new Date("2026-10-14T00:00:00"),
    ];
    for (const [nom, fn] of fonctions) {
      for (const d of instants) {
        expect(fn(d), `${nom} sur ${d.toISOString()}`).not.toMatch(/[AP]M/i);
      }
    }
  });
});
