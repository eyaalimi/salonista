import { describe, it, expect } from "vitest";
import { heuresPossibles, optionsPour, PAS_MINUTES } from "./heures-choix";

describe("heuresPossibles", () => {
  /*
   * LE POINT DE TOUT CE MODULE.
   *
   * `<input type="time">` suit la LOCALE DU NAVIGATEUR : sur un Chrome regle
   * en anglais, il affiche « 09:00 AM » — constate en production, alors que
   * `<html lang="fr">` est declare a la racine. Aucun attribut HTML ne permet
   * d'imposer le cycle horaire d'un champ natif. On fabrique donc la liste.
   */
  it("n'affiche jamais AM ni PM", () => {
    for (const h of heuresPossibles()) {
      expect(h).not.toMatch(/[AP]M/i);
    }
  });

  it("tient sur 24 heures, de 00:00 a 23:45", () => {
    const l = heuresPossibles();
    expect(l[0]).toBe("00:00");
    expect(l[l.length - 1]).toBe("23:45");
    expect(l).toContain("18:00");
    // 18:00 et non 06:00 une seconde fois : chaque heure n'apparait qu'UNE
    // fois dans la journee, contrairement a un affichage sur 12 heures.
    expect(l.filter((h) => h === "06:00")).toHaveLength(1);
  });

  it("garde le zero initial, pour que la liste s'aligne", () => {
    expect(heuresPossibles()).toContain("09:00");
    expect(heuresPossibles()).not.toContain("9:00");
  });

  it("respecte le pas de 15 minutes", () => {
    const l = heuresPossibles();
    expect(l).toHaveLength((24 * 60) / PAS_MINUTES);
    expect(l.slice(0, 5)).toEqual(["00:00", "00:15", "00:30", "00:45", "01:00"]);
  });

  it("accepte un autre pas", () => {
    expect(heuresPossibles(30)).toHaveLength(48);
    expect(heuresPossibles(60)).toHaveLength(24);
  });

  it("produit toujours le format « HH:MM » attendu en base", () => {
    for (const h of heuresPossibles()) {
      expect(h).toMatch(/^\d{2}:\d{2}$/);
    }
  });
});

describe("optionsPour", () => {
  it("rend la liste telle quelle pour une heure du pas", () => {
    expect(optionsPour("09:00")).toEqual(heuresPossibles());
  });

  // Sans ce rattrapage, un horaire « 09:20 » enregistre avant ce changement
  // afficherait du vide et serait efface au premier enregistrement.
  it("ajoute une heure hors du pas plutot que de la perdre", () => {
    const o = optionsPour("09:20");
    expect(o).toContain("09:20");
    expect(o).toHaveLength(heuresPossibles().length + 1);
  });

  it("insere l'heure hors pas au bon endroit", () => {
    const o = optionsPour("09:20");
    expect(o.indexOf("09:15")).toBeLessThan(o.indexOf("09:20"));
    expect(o.indexOf("09:20")).toBeLessThan(o.indexOf("09:30"));
  });

  it("ne cree jamais de doublon", () => {
    const o = optionsPour("18:00");
    expect(new Set(o).size).toBe(o.length);
  });
});
