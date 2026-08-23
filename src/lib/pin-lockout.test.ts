import { describe, it, expect } from "vitest";
import {
  PIN_ECHECS_MAX,
  PIN_VERROU_MS,
  apresEchec,
  apresSucces,
  essaisRestants,
  estVerrouille,
  messageVerrou,
  secondesRestantes,
} from "./pin-lockout";

const T = new Date("2026-08-23T12:00:00Z");
const ouvert = { pinFailedAttempts: 0, pinLockedUntil: null };

describe("estVerrouille", () => {
  it("laisse passer un compte sans verrou", () => {
    expect(estVerrouille(ouvert, T)).toBe(false);
  });

  it("bloque un verrou encore valide", () => {
    const etat = {
      pinFailedAttempts: 0,
      pinLockedUntil: new Date("2026-08-23T12:03:00Z"),
    };
    expect(estVerrouille(etat, T)).toBe(true);
  });

  /**
   * Un verrou expire est traite comme absent : inutile de nettoyer la
   * colonne en base, la comparaison suffit.
   */
  it("traite un verrou expire comme ouvert", () => {
    const etat = {
      pinFailedAttempts: 0,
      pinLockedUntil: new Date("2026-08-23T11:59:00Z"),
    };
    expect(estVerrouille(etat, T)).toBe(false);
  });

  it("ouvre a l'instant exact de l'expiration", () => {
    expect(estVerrouille({ pinFailedAttempts: 0, pinLockedUntil: T }, T)).toBe(false);
  });
});

describe("apresEchec", () => {
  it("incremente sous le seuil, sans verrouiller", () => {
    expect(apresEchec(ouvert, T)).toEqual({
      pinFailedAttempts: 1,
      pinLockedUntil: null,
    });
  });

  it("incremente jusqu'a l'avant-dernier essai", () => {
    const etat = { pinFailedAttempts: PIN_ECHECS_MAX - 2, pinLockedUntil: null };
    expect(apresEchec(etat, T).pinLockedUntil).toBe(null);
    expect(apresEchec(etat, T).pinFailedAttempts).toBe(PIN_ECHECS_MAX - 1);
  });

  it("verrouille au cinquieme echec", () => {
    const etat = { pinFailedAttempts: PIN_ECHECS_MAX - 1, pinLockedUntil: null };
    const r = apresEchec(etat, T);
    expect(r.pinLockedUntil).toEqual(new Date(T.getTime() + PIN_VERROU_MS));
  });

  /**
   * Le compteur repart de zero avec le verrou : sinon, apres expiration, le
   * premier faux pas reverrouillerait aussitot.
   */
  it("remet le compteur a zero en posant le verrou", () => {
    const etat = { pinFailedAttempts: PIN_ECHECS_MAX - 1, pinLockedUntil: null };
    expect(apresEchec(etat, T).pinFailedAttempts).toBe(0);
  });
});

describe("apresSucces", () => {
  it("efface compteur et verrou", () => {
    expect(apresSucces()).toEqual({ pinFailedAttempts: 0, pinLockedUntil: null });
  });
});

describe("secondesRestantes", () => {
  it("rend zero sans verrou", () => {
    expect(secondesRestantes(ouvert, T)).toBe(0);
  });

  it("compte les secondes restantes", () => {
    const etat = {
      pinFailedAttempts: 0,
      pinLockedUntil: new Date(T.getTime() + 90_000),
    };
    expect(secondesRestantes(etat, T)).toBe(90);
  });

  it("arrondit au superieur", () => {
    const etat = {
      pinFailedAttempts: 0,
      pinLockedUntil: new Date(T.getTime() + 1_500),
    };
    expect(secondesRestantes(etat, T)).toBe(2);
  });
});

describe("messageVerrou", () => {
  it("dit « une minute » pour un delai court", () => {
    expect(messageVerrou(30)).toMatch(/une minute/);
  });

  it("annonce le nombre de minutes", () => {
    expect(messageVerrou(300)).toMatch(/5 minutes/);
  });

  /**
   * Le delai est annonce : « reessayez plus tard » laisse taper
   * indefiniment, une duree chiffree fait patienter.
   */
  it("est en francais et chiffre le delai", () => {
    expect(messageVerrou(180)).toBe("Trop d'essais. Réessayez dans 3 minutes.");
  });
});

describe("essaisRestants", () => {
  it("annonce cinq essais sur un compte neuf", () => {
    expect(essaisRestants(ouvert)).toBe(PIN_ECHECS_MAX);
  });

  it("decompte les echecs", () => {
    expect(essaisRestants({ pinFailedAttempts: 3, pinLockedUntil: null })).toBe(2);
  });

  it("ne descend jamais sous zero", () => {
    expect(essaisRestants({ pinFailedAttempts: 99, pinLockedUntil: null })).toBe(0);
  });
});
