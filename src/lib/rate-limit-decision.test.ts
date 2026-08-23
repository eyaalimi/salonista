import { describe, it, expect } from "vitest";
import {
  LIMITE_PIN,
  deciderLimite,
  messageLimite,
  type Limite,
} from "./rate-limit-decision";

const T = new Date("2026-08-23T12:00:00Z");
const LIMITE: Limite = { max: 10, fenetreMs: 10 * 60 * 1000 };

describe("deciderLimite", () => {
  it("laisse passer une cle inconnue", () => {
    const d = deciderLimite(null, LIMITE, T);
    expect(d.ok).toBe(true);
    expect(d.fenetreAReinitialiser).toBe(false);
  });

  it("laisse passer sous la limite", () => {
    const d = deciderLimite({ count: 5, windowStart: T }, LIMITE, T);
    expect(d.ok).toBe(true);
  });

  it("laisse passer le dernier appel autorise", () => {
    const d = deciderLimite({ count: LIMITE.max, windowStart: T }, LIMITE, T);
    expect(d.ok).toBe(true);
  });

  it("refuse au premier appel de trop", () => {
    const d = deciderLimite({ count: LIMITE.max + 1, windowStart: T }, LIMITE, T);
    expect(d.ok).toBe(false);
  });

  /**
   * Sans cette remise a zero, une cle bloquee une fois le resterait pour
   * toujours : le compteur ne redescend jamais tout seul.
   */
  it("rouvre quand la fenetre a expire, meme au-dela de la limite", () => {
    const vieux = new Date(T.getTime() - LIMITE.fenetreMs - 1000);
    const d = deciderLimite({ count: 999, windowStart: vieux }, LIMITE, T);
    expect(d.ok).toBe(true);
    expect(d.fenetreAReinitialiser).toBe(true);
  });

  it("rouvre a l'instant exact de la fin de fenetre", () => {
    const debut = new Date(T.getTime() - LIMITE.fenetreMs);
    const d = deciderLimite({ count: 999, windowStart: debut }, LIMITE, T);
    expect(d.ok).toBe(true);
    expect(d.fenetreAReinitialiser).toBe(true);
  });

  it("annonce le temps restant avant reouverture", () => {
    const debut = new Date(T.getTime() - 4 * 60 * 1000);
    const d = deciderLimite({ count: 999, windowStart: debut }, LIMITE, T);
    expect(d.resetDansMs).toBe(6 * 60 * 1000);
  });

  it("borne les tentatives de PIN a dix par cinq minutes", () => {
    expect(LIMITE_PIN.max).toBe(10);
    expect(LIMITE_PIN.fenetreMs).toBe(5 * 60 * 1000);
  });
});

describe("messageLimite", () => {
  it("dit « une minute » pour un delai court", () => {
    expect(messageLimite(30_000)).toMatch(/une minute/);
  });

  it("annonce le nombre de minutes", () => {
    expect(messageLimite(10 * 60 * 1000)).toBe(
      "Trop de tentatives. Réessayez dans 10 minutes.",
    );
  });
});
