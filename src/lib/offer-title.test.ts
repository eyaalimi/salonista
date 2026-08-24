import { describe, it, expect } from "vitest";
import { refusTitreOffre, TITRE_MIN } from "./offer-title";

describe("refusTitreOffre", () => {
  it("accepte un titre normal", () => {
    expect(refusTitreOffre("Brushing cheveux longs")).toBe(null);
  });

  it("accepte un titre court mais reel", () => {
    expect(refusTitreOffre("Gel")).toBe(null);
  });

  it("refuse un titre trop court", () => {
    expect(refusTitreOffre("ab")?.status).toBe(400);
    expect(refusTitreOffre("")?.status).toBe(400);
  });

  it("compte la longueur apres avoir retire les espaces", () => {
    expect(refusTitreOffre("  a  ")?.status).toBe(400);
  });

  it("accepte exactement la longueur minimale", () => {
    expect(refusTitreOffre("a".repeat(TITRE_MIN))).toBe(null);
  });

  /**
   * Le cas constate en production : trois des six offres de l'accueil
   * s'appelaient « test » ou « test0 », indexees par Google.
   */
  it("refuse « test » et ses variantes numerotees", () => {
    expect(refusTitreOffre("test")?.status).toBe(400);
    expect(refusTitreOffre("test0")?.status).toBe(400);
    expect(refusTitreOffre("test12")?.status).toBe(400);
    expect(refusTitreOffre("Test 3")?.status).toBe(400);
  });

  it("ignore la casse", () => {
    expect(refusTitreOffre("TEST")?.status).toBe(400);
  });

  /**
   * Un vrai service dont le nom CONTIENT « test » doit passer : sinon on
   * bloquerait des prestations legitimes.
   */
  it("accepte un vrai titre contenant le mot test", () => {
    expect(refusTitreOffre("Test de coloration")).toBe(null);
    expect(refusTitreOffre("Protest hair")).toBe(null);
  });

  it("rend des messages en francais", () => {
    expect(refusTitreOffre("ab")?.message).toMatch(/caractères/);
    expect(refusTitreOffre("test")?.message).toMatch(/titre de test/i);
  });
});
