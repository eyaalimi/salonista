import { describe, it, expect } from "vitest";
import {
  verifierAccesSuperadmin,
  motifRecevable,
  suiteEchecTotp,
  FRAICHEUR_TOTP_MS,
  TOTP_ECHECS_MAX,
  TOTP_VERROU_MS,
  type EtatSession,
} from "./superadmin-acces";

/** Une session superadmin parfaitement valide, a moduler par test. */
function sessionValide(sur: Partial<EtatSession> = {}): EtatSession {
  return {
    connecte: true,
    role: "SUPERADMIN",
    totpConfirme: true,
    totpValideeA: 1_000_000,
    verrouJusqua: null,
    ...sur,
  };
}

const T = 1_000_000;

describe("verifierAccesSuperadmin — le controle d'acces", () => {
  it("accepte une session superadmin a jour", () => {
    expect(verifierAccesSuperadmin(sessionValide(), T)).toEqual({ ok: true });
  });

  it("refuse un visiteur non connecte", () => {
    const v = verifierAccesSuperadmin({ connecte: false, totpConfirme: false }, T);
    expect(v).toEqual({ ok: false, raison: "non-connecte" });
  });

  /*
   * LE TEST QUI COMPTE LE PLUS. Le role ADMIN existe depuis le debut du
   * projet et plusieurs comptes le portent. Si SUPERADMIN devenait un ADMIN
   * « superieur », chacun de ces comptes deviendrait un acces fondateur.
   */
  it("refuse un ADMIN — les deux roles sont disjoints", () => {
    const v = verifierAccesSuperadmin(sessionValide({ role: "ADMIN" }), T);
    expect(v).toEqual({ ok: false, raison: "mauvais-role" });
  });

  it("refuse un PROVIDER (un salon)", () => {
    const v = verifierAccesSuperadmin(sessionValide({ role: "PROVIDER" }), T);
    expect(v).toEqual({ ok: false, raison: "mauvais-role" });
  });

  it("refuse une CLIENT et une INFLUENCER", () => {
    for (const role of ["CLIENT", "INFLUENCER"]) {
      expect(verifierAccesSuperadmin(sessionValide({ role }), T)).toEqual({
        ok: false,
        raison: "mauvais-role",
      });
    }
  });

  it("refuse un role absent ou nul", () => {
    expect(verifierAccesSuperadmin(sessionValide({ role: null }), T).ok).toBe(false);
    expect(verifierAccesSuperadmin(sessionValide({ role: undefined }), T).ok).toBe(false);
  });

  it("ne distingue pas un ADMIN verrouille d'un ADMIN ordinaire", () => {
    // Le role est tranche AVANT le verrou : un ADMIN ne doit pas pouvoir
    // deduire qu'un compte superadmin est verrouille, ni meme qu'il existe.
    const v = verifierAccesSuperadmin(
      sessionValide({ role: "ADMIN", verrouJusqua: T + 60_000 }),
      T,
    );
    expect(v).toEqual({ ok: false, raison: "mauvais-role" });
  });

  it("refuse un superadmin sans 2FA enrolee", () => {
    const v = verifierAccesSuperadmin(
      sessionValide({ totpConfirme: false, totpValideeA: null }),
      T,
    );
    expect(v).toEqual({ ok: false, raison: "totp-a-enroler" });
  });

  it("refuse une 2FA enrolee mais jamais validee dans cette session", () => {
    const v = verifierAccesSuperadmin(sessionValide({ totpValideeA: null }), T);
    expect(v).toEqual({ ok: false, raison: "totp-a-valider" });
  });

  it("accepte une validation juste a la limite de fraicheur", () => {
    const v = verifierAccesSuperadmin(
      sessionValide({ totpValideeA: T - FRAICHEUR_TOTP_MS }),
      T,
    );
    expect(v).toEqual({ ok: true });
  });

  it("refuse une validation d'une milliseconde trop vieille", () => {
    const v = verifierAccesSuperadmin(
      sessionValide({ totpValideeA: T - FRAICHEUR_TOTP_MS - 1 }),
      T,
    );
    expect(v).toEqual({ ok: false, raison: "totp-perimee" });
  });

  it("refuse un compte verrouille et annonce le temps restant", () => {
    const v = verifierAccesSuperadmin(sessionValide({ verrouJusqua: T + 90_000 }), T);
    expect(v).toEqual({ ok: false, raison: "verrouille", resteMs: 90_000 });
  });

  it("laisse passer une fois le verrou expire", () => {
    const v = verifierAccesSuperadmin(sessionValide({ verrouJusqua: T - 1 }), T);
    expect(v).toEqual({ ok: true });
  });
});

describe("motifRecevable — le motif obligatoire du journal", () => {
  it("accepte un motif explicite", () => {
    expect(motifRecevable("Appel du salon Nour, mot de passe perdu")).toBe(true);
  });

  it("refuse le vide, les espaces et les motifs creux", () => {
    for (const m of ["", "   ", "\n\t ", "ok", "rien", "support"]) {
      expect(motifRecevable(m)).toBe(false);
    }
  });

  it("refuse ce qui n'est pas une chaine", () => {
    for (const m of [undefined, null, 0, 42, {}, [], true]) {
      expect(motifRecevable(m)).toBe(false);
    }
  });

  it("ne compte pas les espaces de bordure dans la longueur", () => {
    // 9 caracteres utiles entoures d'espaces : insuffisant.
    expect(motifRecevable("   test123   ")).toBe(false);
  });
});

describe("suiteEchecTotp — le verrouillage apres echecs", () => {
  it("incremente sans verrouiller sous le seuil", () => {
    expect(suiteEchecTotp(0, T)).toEqual({ echecs: 1, verrouJusqua: null });
    expect(suiteEchecTotp(3, T)).toEqual({ echecs: 4, verrouJusqua: null });
  });

  it("verrouille au seuil et remet le compteur a zero", () => {
    const r = suiteEchecTotp(TOTP_ECHECS_MAX - 1, T);
    expect(r.echecs).toBe(0);
    expect(r.verrouJusqua).toEqual(new Date(T + TOTP_VERROU_MS));
  });

  it("reverrouille si le compteur depasse le seuil", () => {
    const r = suiteEchecTotp(TOTP_ECHECS_MAX + 2, T);
    expect(r.verrouJusqua).not.toBeNull();
  });
});
