import { describe, it, expect } from "vitest";
import {
  ETAPES,
  decomptesVides,
  construireEntonnoir,
  coutParInscription,
  compterUniques,
  estRobot,
  type Decomptes,
} from "./campagne-entonnoir";

function decomptes(sur: Partial<Decomptes>): Decomptes {
  return { ...decomptesVides(), ...sur };
}

describe("construireEntonnoir — les taux de conversion", () => {
  it("rend une ligne par etape, dans l'ordre", () => {
    const lignes = construireEntonnoir(decomptesVides());
    expect(lignes).toHaveLength(ETAPES.length);
    expect(lignes.map((l) => l.etape)).toEqual([...ETAPES]);
  });

  it("n'a pas de taux « depuis la precedente » sur la premiere etape", () => {
    const lignes = construireEntonnoir(decomptes({ CLIC: 100 }));
    expect(lignes[0].tauxDepuisPrecedente).toBeNull();
  });

  it("calcule le taux de passage entre deux etapes", () => {
    const lignes = construireEntonnoir(decomptes({ CLIC: 200, VISITE: 50 }));
    expect(lignes[1].tauxDepuisPrecedente).toBe(25);
  });

  it("calcule le taux depuis la premiere etape non nulle", () => {
    const l = construireEntonnoir(
      decomptes({ CLIC: 1000, VISITE: 500, INSCRIPTION_FIN: 25 }),
    );
    expect(l.find((x) => x.etape === "INSCRIPTION_FIN")!.tauxDepuisDebut).toBe(2.5);
  });

  it("ne divise jamais par zero", () => {
    const l = construireEntonnoir(decomptes({ VISITE: 10 }));
    // CLIC vaut 0 : le taux de VISITE depuis CLIC est indefini, pas Infinity.
    expect(l.find((x) => x.etape === "VISITE")!.tauxDepuisPrecedente).toBeNull();
  });

  it("rend des taux nuls quand tout est a zero", () => {
    for (const l of construireEntonnoir(decomptesVides())) {
      expect(l.nombre).toBe(0);
      expect(l.tauxDepuisDebut).toBeNull();
    }
  });

  /*
   * Un taux au-dessus de 100 % revele un VRAI probleme : des inscriptions
   * arrivees sans passer par le lien de campagne, ou des clics perdus. Le
   * plafonner a 100 rendrait le tableau de bord rassurant et faux.
   */
  it("conserve un taux superieur a 100 % au lieu de le plafonner", () => {
    const l = construireEntonnoir(decomptes({ CLIC: 10, VISITE: 15 }));
    expect(l[1].tauxDepuisPrecedente).toBe(150);
  });

  it("arrondit a une decimale", () => {
    const l = construireEntonnoir(decomptes({ CLIC: 3, VISITE: 1 }));
    expect(l[1].tauxDepuisPrecedente).toBe(33.3);
  });
});

describe("coutParInscription", () => {
  it("divise le budget par les inscriptions", () => {
    // 300 000 millimes = 300 DT, pour 12 inscrits -> 25 000 millimes = 25 DT
    expect(coutParInscription(300_000, 12)).toBe(25_000);
  });

  it("rend null sans budget — il est optionnel", () => {
    expect(coutParInscription(null, 10)).toBeNull();
    expect(coutParInscription(undefined, 10)).toBeNull();
  });

  it("rend null sans inscription, plutot que l'infini", () => {
    expect(coutParInscription(300_000, 0)).toBeNull();
    expect(coutParInscription(300_000, -1)).toBeNull();
  });

  it("rend un entier : la monnaie ne flotte pas", () => {
    const r = coutParInscription(100_000, 3);
    expect(Number.isInteger(r)).toBe(true);
    expect(r).toBe(33_333);
  });

  it("accepte un budget nul", () => {
    expect(coutParInscription(0, 5)).toBe(0);
  });
});

describe("compterUniques — la deduplication", () => {
  it("compte une personne une seule fois, quels que soient ses clics", () => {
    const d = compterUniques([
      { etape: "CLIC", visitorId: "v1" },
      { etape: "CLIC", visitorId: "v1" },
      { etape: "CLIC", visitorId: "v1" },
    ]);
    expect(d.CLIC).toBe(1);
  });

  it("distingue deux visiteurs", () => {
    const d = compterUniques([
      { etape: "CLIC", visitorId: "v1" },
      { etape: "CLIC", visitorId: "v2" },
    ]);
    expect(d.CLIC).toBe(2);
  });

  it("deduplique aussi par salon apres l'inscription", () => {
    const d = compterUniques([
      { etape: "CAISSE_ACTIVEE", providerId: "p1" },
      { etape: "CAISSE_ACTIVEE", providerId: "p1" },
    ]);
    expect(d.CAISSE_ACTIVEE).toBe(1);
  });

  it("ignore un evenement sans visiteur ni salon", () => {
    // Il ne peut pas etre deduplique : le compter gonflerait les chiffres.
    const d = compterUniques([{ etape: "CLIC" }, { etape: "CLIC", visitorId: null }]);
    expect(d.CLIC).toBe(0);
  });

  it("separe bien les etapes", () => {
    const d = compterUniques([
      { etape: "CLIC", visitorId: "v1" },
      { etape: "VISITE", visitorId: "v1" },
    ]);
    expect(d.CLIC).toBe(1);
    expect(d.VISITE).toBe(1);
  });

  it("rend toutes les etapes, meme a zero", () => {
    const d = compterUniques([]);
    for (const e of ETAPES) expect(d[e]).toBe(0);
  });
});

describe("estRobot — le filtre", () => {
  it("laisse passer un vrai navigateur", () => {
    expect(
      estRobot(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1",
      ),
    ).toBe(false);
    expect(
      estRobot("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36"),
    ).toBe(false);
  });

  it("attrape les robots qui s'annoncent", () => {
    for (const ua of [
      "Googlebot/2.1 (+http://www.google.com/bot.html)",
      "facebookexternalhit/1.1",
      "WhatsApp/2.23",
      "curl/8.4.0",
      "python-requests/2.31 bot",
      "HeadlessChrome/120",
    ]) {
      expect(estRobot(ua), ua).toBe(true);
    }
  });

  it("traite l'absence d'agent comme un automate", () => {
    expect(estRobot(null)).toBe(true);
    expect(estRobot(undefined)).toBe(true);
    expect(estRobot("")).toBe(true);
  });

  it("ignore la casse", () => {
    expect(estRobot("GOOGLEBOT")).toBe(true);
  });
});
