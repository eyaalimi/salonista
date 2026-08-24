import { describe, it, expect } from "vitest";
import {
  CODE_ESSAIS_MAX,
  CODE_VALIDITE_MS,
  couleurTuile,
  expirationCode,
  formatCodeValide,
  refusCode,
} from "./device-pairing";

const T = new Date("2026-08-23T12:00:00Z");
const vivant = {
  attempts: 0,
  expiresAt: new Date("2026-08-23T12:10:00Z"),
  usedAt: null,
};

describe("formatCodeValide", () => {
  it("accepte six chiffres", () => {
    expect(formatCodeValide("012345")).toBe(true);
  });

  it("ignore les espaces autour", () => {
    expect(formatCodeValide("  123456  ")).toBe(true);
  });

  it("refuse une longueur differente", () => {
    expect(formatCodeValide("12345")).toBe(false);
    expect(formatCodeValide("1234567")).toBe(false);
  });

  it("refuse ce qui n'est pas un chiffre", () => {
    expect(formatCodeValide("12345a")).toBe(false);
    expect(formatCodeValide("")).toBe(false);
  });
});

describe("refusCode", () => {
  it("laisse passer un code vivant et bien forme", () => {
    expect(refusCode(vivant, "123456", T)).toBe(null);
  });

  it("refuse un code mal forme avant tout le reste", () => {
    expect(refusCode(vivant, "abc", T)?.raison).toBe("format");
  });

  /**
   * Un code inconnu et un code expire donnent le MEME message : distinguer
   * les deux dirait a un attaquant qu'un appairage est en cours.
   */
  it("refuse un code introuvable comme un code expire", () => {
    const inconnu = refusCode(null, "123456", T);
    const expire = refusCode(
      { ...vivant, expiresAt: new Date("2026-08-23T11:59:00Z") },
      "123456",
      T,
    );
    expect(inconnu?.raison).toBe("expire");
    expect(expire?.raison).toBe("expire");
    expect(inconnu?.message).toBe(expire?.message);
  });

  it("refuse un code deja utilise", () => {
    const r = refusCode({ ...vivant, usedAt: T }, "123456", T);
    expect(r?.raison).toBe("deja-utilise");
  });

  it("refuse apres cinq essais", () => {
    const r = refusCode({ ...vivant, attempts: CODE_ESSAIS_MAX }, "123456", T);
    expect(r?.raison).toBe("trop-d-essais");
  });

  it("laisse passer le cinquieme essai", () => {
    const r = refusCode({ ...vivant, attempts: CODE_ESSAIS_MAX - 1 }, "123456", T);
    expect(r).toBe(null);
  });

  it("expire a l'instant exact", () => {
    expect(refusCode({ ...vivant, expiresAt: T }, "123456", T)?.raison).toBe("expire");
  });

  it("rend des messages en francais", () => {
    expect(refusCode(null, "123456", T)?.message).toMatch(/expiré/i);
  });
});

describe("expirationCode", () => {
  it("expire un quart d'heure plus tard", () => {
    expect(expirationCode(T)).toEqual(new Date(T.getTime() + CODE_VALIDITE_MS));
  });
});

describe("couleurTuile", () => {
  it("rend la meme couleur pour le meme identifiant", () => {
    expect(couleurTuile("emp1")).toBe(couleurTuile("emp1"));
  });

  it("rend une couleur de la charte", () => {
    expect(couleurTuile("emp1")).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it("supporte une chaine vide sans jeter", () => {
    expect(() => couleurTuile("")).not.toThrow();
  });
});
