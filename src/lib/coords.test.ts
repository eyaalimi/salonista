import { describe, it, expect } from "vitest";
import { isValidCoords, parseCoords } from "./coords";

describe("isValidCoords", () => {
  it("accepte un point tunisien plausible (Tunis)", () => {
    expect(isValidCoords(36.8065, 10.1815)).toBe(true);
  });

  it("accepte les bornes exactes", () => {
    expect(isValidCoords(90, 180)).toBe(true);
    expect(isValidCoords(-90, -180)).toBe(true);
  });

  it("refuse une latitude hors bornes", () => {
    expect(isValidCoords(91, 10)).toBe(false);
    expect(isValidCoords(-91, 10)).toBe(false);
  });

  it("refuse une longitude hors bornes", () => {
    expect(isValidCoords(36, 181)).toBe(false);
    expect(isValidCoords(36, -181)).toBe(false);
  });

  it("refuse (0, 0) — Null Island, symptome d'un parsing rate", () => {
    expect(isValidCoords(0, 0)).toBe(false);
  });

  it("accepte une seule des deux coordonnees a zero", () => {
    // Le meridien de Greenwich et l'equateur sont des lieux reels.
    expect(isValidCoords(36.8, 0)).toBe(true);
    expect(isValidCoords(0, 10.18)).toBe(true);
  });

  it("refuse NaN et Infinity", () => {
    expect(isValidCoords(NaN, 10)).toBe(false);
    expect(isValidCoords(36, NaN)).toBe(false);
    expect(isValidCoords(Infinity, 10)).toBe(false);
    expect(isValidCoords(36, -Infinity)).toBe(false);
  });
});

describe("parseCoords", () => {
  it("renvoie un point valide depuis des nombres", () => {
    expect(parseCoords(36.8065, 10.1815)).toEqual({ lat: 36.8065, lng: 10.1815 });
  });

  it("renvoie un point valide depuis des chaines", () => {
    expect(parseCoords("36.8065", "10.1815")).toEqual({ lat: 36.8065, lng: 10.1815 });
  });

  it("renvoie null si l'un des deux manque", () => {
    expect(parseCoords(36.8065, null)).toBeNull();
    expect(parseCoords(null, 10.1815)).toBeNull();
    expect(parseCoords(null, null)).toBeNull();
    expect(parseCoords(undefined, undefined)).toBeNull();
  });

  it("renvoie null pour une chaine vide — Number('') vaut 0, piege classique", () => {
    expect(parseCoords("", "")).toBeNull();
  });

  it("renvoie null pour des coordonnees invalides", () => {
    expect(parseCoords(91, 10)).toBeNull();
    expect(parseCoords(0, 0)).toBeNull();
    expect(parseCoords("abc", "def")).toBeNull();
  });
});
