import { describe, it, expect } from "vitest";
import { TOTP, Secret } from "otpauth";
import {
  creerSecretTotp,
  validerCodeTotp,
  pasDuCode,
  estRejeu,
} from "./superadmin-totp";

const EMAIL = "fondateur@salonista.tn";

/** Calcule le code attendu a un instant donne, comme le ferait le telephone. */
function codeAttendu(secret: string, quand: Date): string {
  const totp = new TOTP({
    issuer: "Salonista",
    label: EMAIL,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secret),
  });
  return totp.generate({ timestamp: quand.getTime() });
}

describe("creerSecretTotp — l'enrolement", () => {
  it("produit un secret base32 et un URI otpauth exploitable", () => {
    const { secret, uri } = creerSecretTotp(EMAIL);
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(uri).toContain("otpauth://totp/");
    expect(uri).toContain("Salonista");
    expect(uri).toContain("secret=");
  });

  it("ne produit jamais deux fois le meme secret", () => {
    const a = creerSecretTotp(EMAIL).secret;
    const b = creerSecretTotp(EMAIL).secret;
    expect(a).not.toBe(b);
  });

  it("produit un secret de 160 bits (32 caracteres base32)", () => {
    // 20 octets -> 32 caracteres base32. Un secret plus court affaiblirait
    // le TOTP sans rien simplifier.
    expect(creerSecretTotp(EMAIL).secret).toHaveLength(32);
  });
});

describe("validerCodeTotp — la verification", () => {
  const { secret } = creerSecretTotp(EMAIL);
  const T = new Date("2026-10-05T12:00:00.000Z");

  it("accepte le code du pas courant", () => {
    const code = codeAttendu(secret, T);
    expect(validerCodeTotp(secret, code, EMAIL, T)).toBe(0);
  });

  it("accepte le code du pas precedent (horloge en retard)", () => {
    const code = codeAttendu(secret, new Date(T.getTime() - 30_000));
    expect(validerCodeTotp(secret, code, EMAIL, T)).toBe(-1);
  });

  it("accepte le code du pas suivant (horloge en avance)", () => {
    const code = codeAttendu(secret, new Date(T.getTime() + 30_000));
    expect(validerCodeTotp(secret, code, EMAIL, T)).toBe(1);
  });

  it("refuse un code trop vieux (2 pas en arriere)", () => {
    const code = codeAttendu(secret, new Date(T.getTime() - 60_000));
    expect(validerCodeTotp(secret, code, EMAIL, T)).toBeNull();
  });

  it("refuse un code trop avance (2 pas en avant)", () => {
    const code = codeAttendu(secret, new Date(T.getTime() + 60_000));
    expect(validerCodeTotp(secret, code, EMAIL, T)).toBeNull();
  });

  it("refuse un code faux", () => {
    expect(validerCodeTotp(secret, "000000", EMAIL, T)).toBeNull();
  });

  it("refuse les saisies mal formees sans planter", () => {
    for (const mauvais of ["", "   ", "abc", "12345", "1234567", "12-34-56", "٠١٢٣٤٥"]) {
      expect(validerCodeTotp(secret, mauvais, EMAIL, T)).toBeNull();
    }
  });

  it("tolere les espaces de saisie", () => {
    const code = codeAttendu(secret, T);
    const espace = `${code.slice(0, 3)} ${code.slice(3)}`;
    expect(validerCodeTotp(secret, espace, EMAIL, T)).toBe(0);
  });

  it("refuse le code d'un AUTRE secret", () => {
    const autre = creerSecretTotp(EMAIL).secret;
    const code = codeAttendu(autre, T);
    expect(validerCodeTotp(secret, code, EMAIL, T)).toBeNull();
  });
});

describe("estRejeu — un code ne sert qu'une fois", () => {
  const T = new Date("2026-10-05T12:00:00.000Z");

  it("laisse passer la premiere utilisation", () => {
    expect(estRejeu(pasDuCode(0, T), null)).toBe(false);
  });

  it("refuse le rejeu du meme pas", () => {
    const pas = pasDuCode(0, T);
    expect(estRejeu(pas, pas)).toBe(true);
  });

  it("refuse un pas anterieur au dernier consomme", () => {
    // Accepter un code plus vieux rouvrirait la fenetre qu'on vient de fermer.
    const pas = pasDuCode(0, T);
    expect(estRejeu(pas - 1, pas)).toBe(true);
  });

  it("laisse passer le pas suivant", () => {
    const pas = pasDuCode(0, T);
    expect(estRejeu(pas + 1, pas)).toBe(false);
  });

  it("derive des pas coherents avec le decalage", () => {
    expect(pasDuCode(1, T)).toBe(pasDuCode(0, T) + 1);
    expect(pasDuCode(-1, T)).toBe(pasDuCode(0, T) - 1);
  });
});
