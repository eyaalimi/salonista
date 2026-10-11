import { describe, it, expect } from "vitest";
import {
  hacher,
  normaliserTelephone,
  construireEvenement,
  evenementExploitable,
  lireCookiesMeta,
  EVENEMENT_INSCRIPTION,
} from "./meta-conversions";

/*
 * Ces tests portent sur la PREPARATION des donnees, jamais sur le reseau.
 * Un hachage faux ne provoque aucune erreur visible : Meta accepte
 * l'evenement, ne trouve aucune correspondance, et l'inscription n'est
 * simplement jamais attribuee a la publicite. C'est une panne silencieuse,
 * d'ou ces verrous.
 */

describe("hacher", () => {
  it("rend le SHA-256 connu d'une adresse normalisee", () => {
    // Valeur de reference calculee independamment (node -e createHash) :
    // si la normalisation ou l'encodage changeait, ce test tomberait.
    expect(hacher("eya@gmail.com")).toBe(
      "6f90efffcd7559e965679b958d25cfc9d533784b8db2108df5d76447c0779682",
    );
  });

  it("donne le MEME hachage quelle que soit la casse ou les espaces", () => {
    // Le coeur du sujet : « Eya@Gmail.com » tape a l'inscription doit
    // correspondre a « eya@gmail.com » cote Meta.
    const attendu = hacher("eya@gmail.com");
    expect(hacher("  Eya@Gmail.COM  ")).toBe(attendu);
    expect(hacher("EYA@GMAIL.COM")).toBe(attendu);
  });

  it("ne hache pas le vide", () => {
    // Envoyer le hachage de "" ferait croire a Meta qu'on transmet une
    // donnee reelle.
    expect(hacher("")).toBeUndefined();
    expect(hacher("   ")).toBeUndefined();
    expect(hacher(null)).toBeUndefined();
    expect(hacher(undefined)).toBeUndefined();
  });
});

describe("normaliserTelephone", () => {
  it("retire tout ce qui n'est pas un chiffre", () => {
    expect(normaliserTelephone("+216 20 123 456")).toBe("21620123456");
    expect(normaliserTelephone("(216) 20-123-456")).toBe("21620123456");
  });

  it("refuse un numero de client passager", () => {
    // `walk-in-…` est un identifiant interne, pas un numero : il ne
    // correspondrait a personne chez Meta.
    expect(normaliserTelephone("walk-in-abc123")).toBeUndefined();
  });

  it("refuse un numero trop court pour etre vrai", () => {
    expect(normaliserTelephone("123")).toBeUndefined();
    expect(normaliserTelephone("")).toBeUndefined();
  });
});

describe("construireEvenement", () => {
  const base = { providerId: "prov_1", donnees: { email: "eya@gmail.com" } };

  it("envoie l'heure en SECONDES, pas en millisecondes", () => {
    // Des millisecondes placeraient l'evenement en l'an 56000 et Meta le
    // rejetterait.
    const e = construireEvenement({ ...base, maintenant: new Date("2026-10-10T12:00:00Z") });
    expect(e.event_time).toBe(Math.floor(new Date("2026-10-10T12:00:00Z").getTime() / 1000));
    expect(String(e.event_time)).toHaveLength(10);
  });

  it("utilise l'identifiant du salon pour la deduplication", () => {
    expect(construireEvenement(base).event_id).toBe("prov_1");
  });

  it("nomme l'evenement CompleteRegistration", () => {
    expect(construireEvenement(base).event_name).toBe(EVENEMENT_INSCRIPTION);
    expect(EVENEMENT_INSCRIPTION).toBe("CompleteRegistration");
  });

  it("hache l'e-mail et le telephone, mais jamais l'IP ni l'agent", () => {
    const e = construireEvenement({
      providerId: "prov_1",
      donnees: {
        email: "eya@gmail.com",
        phone: "+216 20 123 456",
        ip: "41.226.1.1",
        userAgent: "Mozilla/5.0",
      },
    });
    expect(e.user_data.em).toMatch(/^[0-9a-f]{64}$/);
    expect(e.user_data.ph).toMatch(/^[0-9a-f]{64}$/);
    // Meta veut ces deux-la en clair : c'est sa specification.
    expect(e.user_data.client_ip_address).toBe("41.226.1.1");
    expect(e.user_data.client_user_agent).toBe("Mozilla/5.0");
  });

  it("ne contient JAMAIS l'e-mail ou le telephone en clair", () => {
    // La verification qui compte vraiment : aucune donnee personnelle ne
    // doit sortir lisible.
    const e = construireEvenement({
      providerId: "prov_1",
      donnees: { email: "eya@gmail.com", phone: "+216 20 123 456" },
    });
    const brut = JSON.stringify(e);
    expect(brut).not.toContain("eya@gmail.com");
    expect(brut).not.toContain("gmail");
    expect(brut).not.toContain("20123456");
    expect(brut).not.toContain("21620123456");
  });

  it("transmet fbc et fbp tels quels", () => {
    // Deja des identifiants Meta : les hacher les rendrait inutilisables.
    const e = construireEvenement({
      providerId: "prov_1",
      donnees: { fbc: "fb.1.1699.AbCd", fbp: "fb.1.1699.1234" },
    });
    expect(e.user_data.fbc).toBe("fb.1.1699.AbCd");
    expect(e.user_data.fbp).toBe("fb.1.1699.1234");
  });

  it("omet les champs absents au lieu de les envoyer vides", () => {
    const e = construireEvenement({ providerId: "prov_1", donnees: { email: "eya@gmail.com" } });
    expect(e.user_data).not.toHaveProperty("ph");
    expect(e.user_data).not.toHaveProperty("client_ip_address");
    expect(Object.values(e.user_data)).not.toContain("");
  });

  it("omet event_source_url quand l'URL est inconnue", () => {
    expect(construireEvenement(base)).not.toHaveProperty("event_source_url");
    expect(
      construireEvenement({ ...base, urlSource: "https://salonista.tn/pos-start" })
        .event_source_url,
    ).toBe("https://salonista.tn/pos-start");
  });
});

describe("evenementExploitable", () => {
  it("refuse un evenement sans aucune donnee de correspondance", () => {
    // Meta rejette ces appels ; les repeter degrade la reputation du compte
    // publicitaire.
    expect(evenementExploitable(construireEvenement({ providerId: "p", donnees: {} }))).toBe(false);
  });

  it("accepte un evenement avec le seul e-mail", () => {
    expect(
      evenementExploitable(
        construireEvenement({ providerId: "p", donnees: { email: "eya@gmail.com" } }),
      ),
    ).toBe(true);
  });

  it("accepte un evenement avec le seul fbc", () => {
    expect(
      evenementExploitable(construireEvenement({ providerId: "p", donnees: { fbc: "fb.1.1.x" } })),
    ).toBe(true);
  });
});

describe("lireCookiesMeta", () => {
  it("extrait _fbc et _fbp d'un en-tete reel", () => {
    expect(lireCookiesMeta("_fbp=fb.1.1699.1234; _fbc=fb.1.1699.AbCd; autre=x")).toEqual({
      fbp: "fb.1.1699.1234",
      fbc: "fb.1.1699.AbCd",
    });
  });

  it("rend un objet vide sans en-tete ou sans cookie Meta", () => {
    expect(lireCookiesMeta(null)).toEqual({});
    expect(lireCookiesMeta("")).toEqual({});
    expect(lireCookiesMeta("session=abc")).toEqual({ fbc: undefined, fbp: undefined });
  });

  it("ne se laisse pas desorienter par un en-tete malforme", () => {
    // Un cookie absent ne doit jamais faire echouer une inscription.
    expect(() => lireCookiesMeta("=;;;x")).not.toThrow();
  });
});
