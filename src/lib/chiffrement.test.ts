import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { CleChiffrementManquante, chiffrer, cleChiffrementPresente, dechiffrer, lireCle } from "./chiffrement";

const cle = randomBytes(32);

describe("chiffrement AES-256-GCM", () => {
  it("aller-retour", () => {
    const jeton = "EAAG-jeton-tres-secret-éàü";
    expect(dechiffrer(chiffrer(jeton, cle), cle)).toBe(jeton);
  });

  it("format iv:tag:donnees, IV différent à chaque fois", () => {
    const a = chiffrer("x", cle);
    const b = chiffrer("x", cle);
    expect(a.split(":")).toHaveLength(3);
    expect(a).not.toBe(b);
    expect(a).not.toContain("x");
  });

  it("refuse un blob altéré", () => {
    const [iv, tag, donnees] = chiffrer("jeton", cle).split(":");
    const altere = Buffer.from(donnees, "base64");
    altere[0] ^= 1;
    expect(() => dechiffrer([iv, tag, altere.toString("base64")].join(":"), cle)).toThrow();
  });

  it("refuse une autre clé et un format invalide", () => {
    expect(() => dechiffrer(chiffrer("jeton", cle), randomBytes(32))).toThrow();
    expect(() => dechiffrer("pas-un-blob", cle)).toThrow(/illisible/);
  });

  it("clé absente ou de mauvaise taille : erreur explicite", () => {
    expect(() => lireCle(undefined)).toThrow(CleChiffrementManquante);
    expect(() => lireCle(randomBytes(16).toString("base64"))).toThrow(CleChiffrementManquante);
    expect(cleChiffrementPresente(undefined)).toBe(false);
    expect(cleChiffrementPresente(cle.toString("base64"))).toBe(true);
  });
});
