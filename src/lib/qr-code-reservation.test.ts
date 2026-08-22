import { describe, it, expect } from "vitest";
import { extraireCodeReservation } from "./qr-code-reservation";

const CODE = "BT-aB3dE5gH7jK9mN1p";

describe("extraireCodeReservation", () => {
  it("lit le code dans l'URL du QR", () => {
    expect(
      extraireCodeReservation(`https://salonista.tn/verification?code=${CODE}`),
    ).toBe(CODE);
  });

  it("accepte le code nu, tel que le lirait une douchette", () => {
    expect(extraireCodeReservation(CODE)).toBe(CODE);
  });

  it("ignore les espaces autour", () => {
    expect(extraireCodeReservation(`  ${CODE}  `)).toBe(CODE);
  });

  it("accepte une URL locale — le developpement scanne aussi", () => {
    expect(
      extraireCodeReservation(`http://localhost:3000/verification?code=${CODE}`),
    ).toBe(CODE);
  });

  it("accepte d'autres parametres dans l'URL", () => {
    expect(
      extraireCodeReservation(
        `https://salonista.tn/verification?utm=insta&code=${CODE}`,
      ),
    ).toBe(CODE);
  });

  it("rejette un QR qui n'est pas une URL", () => {
    expect(extraireCodeReservation("WIFI:S:MonSalon;T:WPA;P:motdepasse;;")).toBe(
      null,
    );
  });

  it("rejette une URL sans code", () => {
    expect(extraireCodeReservation("https://salonista.tn/verification")).toBe(null);
  });

  /**
   * Une autre page du site qui porterait un `?code=` — un lien de parrainage,
   * une verification d'email — ne doit pas passer pour un QR de reservation.
   */
  it("rejette un ?code= sur une autre page du site", () => {
    expect(
      extraireCodeReservation(`https://salonista.tn/verify-email?code=${CODE}`),
    ).toBe(null);
  });

  it("rejette un code au mauvais format", () => {
    expect(
      extraireCodeReservation("https://salonista.tn/verification?code=XX-court"),
    ).toBe(null);
  });

  it("rejette un code trop long", () => {
    expect(extraireCodeReservation("BT-aB3dE5gH7jK9mN1pQQQQ")).toBe(null);
  });

  it("rejette une chaine vide", () => {
    expect(extraireCodeReservation("")).toBe(null);
    expect(extraireCodeReservation("   ")).toBe(null);
  });

  it("ne jette jamais, quoi que voie la camera", () => {
    const entrees = ["<html>", "javascript:alert(1)", "0000", "https://", "é@#"];
    for (const e of entrees) {
      expect(() => extraireCodeReservation(e)).not.toThrow();
    }
  });
});
