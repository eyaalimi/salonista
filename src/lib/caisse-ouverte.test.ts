import { describe, it, expect } from "vitest";
import { alerteCaisseFermee, refusVenteSansTiroir } from "./caisse-ouverte";

describe("refusVenteSansTiroir", () => {
  /**
   * Le cas constate : une vente en especes passait tiroir ferme. Son paiement
   * n'etait rattache a aucune session, donc invisible du rapport Z — l'attendu
   * en caisse etait faux, et l'ecart retombait sur la caissiere suivante.
   */
  it("refuse une vente en especes sans tiroir ouvert", () => {
    const refus = refusVenteSansTiroir(["CASH"], false, false);
    expect(refus?.status).toBe(409);
    expect(refus?.message).toMatch(/Ouvre la caisse/i);
  });

  it("accepte une vente en especes avec un tiroir ouvert", () => {
    expect(refusVenteSansTiroir(["CASH"], true, false)).toBe(null);
  });

  /**
   * Une carte ne touche pas le tiroir. L'exiger empecherait d'encaisser par
   * carte hors des heures de caisse, sans rien proteger.
   */
  it("laisse passer les paiements qui ne touchent pas le tiroir", () => {
    expect(refusVenteSansTiroir(["CARD"], false, false)).toBe(null);
    expect(refusVenteSansTiroir(["TRANSFER"], false, false)).toBe(null);
    expect(refusVenteSansTiroir(["OTHER"], false, false)).toBe(null);
    expect(refusVenteSansTiroir(["LOYALTY_POINTS"], false, false)).toBe(null);
  });

  it("refuse un paiement mixte des qu'il contient des especes", () => {
    expect(refusVenteSansTiroir(["CARD", "CASH"], false, false)).not.toBe(null);
    expect(refusVenteSansTiroir(["LOYALTY_POINTS", "CASH"], false, false)).not.toBe(
      null,
    );
  });

  /**
   * Une vente hors ligne a DEJA ete encaissee aupres d'une cliente. La refuser
   * a la synchronisation la perdrait — c'est pire que l'ecart comptable.
   */
  it("ne refuse jamais une vente issue d'une synchronisation", () => {
    expect(refusVenteSansTiroir(["CASH"], false, true)).toBe(null);
  });

  it("accepte une vente sans paiement", () => {
    expect(refusVenteSansTiroir([], false, false)).toBe(null);
  });

  it("rend un message en francais qui dit quoi faire", () => {
    const refus = refusVenteSansTiroir(["CASH"], false, false);
    expect(refus?.message).toMatch(/rapport de fin de journée/i);
  });
});

describe("alerteCaisseFermee", () => {
  /**
   * Prevenir AVANT que le panier soit compose : bloquer au moment de valider
   * arrive trop tard, la cliente attend devant le comptoir.
   */
  it("alerte quand la caisse est fermee", () => {
    expect(alerteCaisseFermee(false)).toMatch(/caisse est fermée/i);
  });

  it("ne dit rien quand elle est ouverte", () => {
    expect(alerteCaisseFermee(true)).toBe(null);
  });
});
