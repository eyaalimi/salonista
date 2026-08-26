import { describe, it, expect } from "vitest";
import {
  TVA_TAUX_DEFAUT,
  TVA_TAUX_EXONERE,
  afficherTva,
  refusRegimeTva,
  tauxTvaApplicable,
} from "./tva-salon";

describe("tauxTvaApplicable", () => {
  /**
   * Le coeur de la regle : un salon non assujetti ne facture RIEN, quel que
   * soit le taux propose. Sans cela, un chemin de creation oublie (caisse,
   * assistant, import) reintroduirait une TVA fantome.
   */
  it("impose 0 % a un salon non assujetti, quoi qu'on demande", () => {
    expect(tauxTvaApplicable(false)).toBe(TVA_TAUX_EXONERE);
    expect(tauxTvaApplicable(false, 19)).toBe(0);
    expect(tauxTvaApplicable(false, "7")).toBe(0);
    expect(tauxTvaApplicable(false, 100)).toBe(0);
  });

  it("applique le taux demande a un salon assujetti", () => {
    expect(tauxTvaApplicable(true, 7)).toBe(7);
    expect(tauxTvaApplicable(true, "13")).toBe(13);
    expect(tauxTvaApplicable(true, 0)).toBe(0);
  });

  it("retombe sur 19 % quand un assujetti ne precise rien", () => {
    expect(tauxTvaApplicable(true)).toBe(TVA_TAUX_DEFAUT);
    expect(tauxTvaApplicable(true, null)).toBe(19);
    expect(tauxTvaApplicable(true, "")).toBe(19);
  });

  it("ignore un taux aberrant plutot que de l'enregistrer", () => {
    expect(tauxTvaApplicable(true, -5)).toBe(19);
    expect(tauxTvaApplicable(true, 150)).toBe(19);
    expect(tauxTvaApplicable(true, "abc")).toBe(19);
  });
});

describe("afficherTva", () => {
  /** « TVA incluse : 0% » laisse croire a un oubli de configuration. */
  it("ne montre la TVA qu'aux assujettis", () => {
    expect(afficherTva(true)).toBe(true);
    expect(afficherTva(false)).toBe(false);
  });
});

describe("refusRegimeTva", () => {
  it("accepte un non-assujetti sans matricule", () => {
    expect(refusRegimeTva(false, null)).toBe(null);
    expect(refusRegimeTva(false, "")).toBe(null);
  });

  it("accepte un assujetti avec matricule", () => {
    expect(refusRegimeTva(true, "1234567/A/M/000")).toBe(null);
  });

  /**
   * Le matricule est la mention qui rend une facture valable : declarer la
   * TVA sans lui produit des tickets inexploitables.
   */
  it("refuse un assujetti sans matricule", () => {
    expect(refusRegimeTva(true, null)?.message).toMatch(/matricule/i);
    expect(refusRegimeTva(true, "   ")).not.toBe(null);
  });

  it("refuse un regime qui n'est pas un booleen", () => {
    expect(refusRegimeTva("oui", "123")?.message).toMatch(/invalide/i);
    expect(refusRegimeTva(null, "123")).not.toBe(null);
  });

  it("rend des messages en francais", () => {
    expect(refusRegimeTva(true, "")?.message).toMatch(/assujetti/i);
  });
});
