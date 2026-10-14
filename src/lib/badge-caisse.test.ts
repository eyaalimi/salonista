import { describe, it, expect } from "vitest";
import { etatCaisse, badgeCaisse, type EtatCaisse } from "./badge-caisse";

const TOUS: EtatCaisse[] = ["sans-module", "jamais-utilisee", "demarree", "active"];

describe("etatCaisse", () => {
  /*
   * LE BUG VU EN PRODUCTION. Un salon abonne, tiroir ouvert, mais pas encore
   * de vente, s'affichait « Caisse inactive ». Le badge testait
   * `ventesEncaissees > 0` : il disait « a deja vendu », pas « a la caisse ».
   */
  it("un salon abonne qui n'a pas encore vendu N'EST PAS sans caisse", () => {
    const e = etatCaisse({
      aLeModule: true,
      tiroirDejaOuvert: true,
      ventesEncaissees: 0,
    });
    expect(e).not.toBe("sans-module");
    expect(e).toBe("demarree");
    expect(badgeCaisse(e).libelle).toContain("activée");
  });

  it("distingue abonne-sans-usage de non-abonne", () => {
    const abonne = etatCaisse({
      aLeModule: true,
      tiroirDejaOuvert: false,
      ventesEncaissees: 0,
    });
    const nonAbonne = etatCaisse({
      aLeModule: false,
      tiroirDejaOuvert: false,
      ventesEncaissees: 0,
    });
    expect(abonne).toBe("jamais-utilisee");
    expect(nonAbonne).toBe("sans-module");
    // Deux conversations telephoniques opposees : les melanger etait le defaut.
    expect(badgeCaisse(abonne).libelle).not.toBe(badgeCaisse(nonAbonne).libelle);
  });

  it("des ventes donnent une caisse active", () => {
    expect(
      etatCaisse({ aLeModule: true, tiroirDejaOuvert: true, ventesEncaissees: 12 }),
    ).toBe("active");
  });

  // Sans module, rien d'autre ne doit compter : un salon non abonne ne peut
  // ni ouvrir de tiroir ni vendre, et l'accuser de ne pas s'en servir serait
  // absurde.
  it("sans module, l'usage n'est jamais reproche", () => {
    for (const tiroir of [true, false]) {
      for (const ventes of [0, 5]) {
        expect(
          etatCaisse({ aLeModule: false, tiroirDejaOuvert: tiroir, ventesEncaissees: ventes }),
        ).toBe("sans-module");
      }
    }
  });
});

describe("badgeCaisse", () => {
  it("chaque etat a un libelle non vide", () => {
    for (const e of TOUS) {
      expect(badgeCaisse(e).libelle.length).toBeGreaterThan(0);
    }
  });

  it("« Caisse activée » apparait des que le module est la", () => {
    for (const e of ["jamais-utilisee", "demarree", "active"] as const) {
      expect(badgeCaisse(e).libelle).toContain("Caisse activée");
    }
    expect(badgeCaisse("sans-module").libelle).not.toContain("activée");
  });

  // Le mot « inactive » etait ambigu — « pas abonnee » ou « pas utilisee » ?
  it("n'emploie plus jamais le mot « inactive »", () => {
    for (const e of TOUS) {
      expect(badgeCaisse(e).libelle).not.toMatch(/inactive/i);
    }
  });

  it("seul un usage reel est vert", () => {
    expect(badgeCaisse("active").ton).toBe("ok");
    expect(badgeCaisse("demarree").ton).toBe("alerte");
    expect(badgeCaisse("jamais-utilisee").ton).toBe("alerte");
    // Sans module, il n'y a rien a signaler : c'est un fait, pas un probleme.
    expect(badgeCaisse("sans-module").ton).toBe("neutre");
  });
});
