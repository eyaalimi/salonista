import { describe, it, expect } from "vitest";
import { consoliderRevenu, ticketMoyen } from "./revenu-salon";

describe("consoliderRevenu", () => {
  it("compte les ventes quand le salon a la caisse", () => {
    const r = consoliderRevenu([{ total: "80.000" }, { total: "45.500" }], [], []);
    expect(r.netRevenue).toBe("125.500");
    expect(r.paidCount).toBe(2);
    expect(r.depuisRendezVous).toBe(false);
  });

  /**
   * Le coeur du correctif : sans le module caisse, aucune vente ne peut
   * exister — la route repond 403. Le salon voyait donc 0 TND en permanence.
   */
  it("compte les rendez-vous termines quand le salon n'a pas de caisse", () => {
    const r = consoliderRevenu(
      [],
      [
        { totalPrice: "25.000", aUneVente: false },
        { totalPrice: "60.000", aUneVente: false },
      ],
      [],
    );
    expect(r.netRevenue).toBe("85.000");
    expect(r.paidCount).toBe(2);
    expect(r.depuisRendezVous).toBe(true);
  });

  /**
   * Quand la caisse encaisse un rendez-vous, elle pose `Sale.bookingId` et
   * passe le rendez-vous a COMPLETED. Le compter des deux cotes doublerait
   * la recette du salon.
   */
  it("ne compte pas deux fois un rendez-vous deja encaisse", () => {
    const r = consoliderRevenu(
      [{ total: "25.000" }],
      [{ totalPrice: "25.000", aUneVente: true }],
      [],
    );
    expect(r.netRevenue).toBe("25.000");
    expect(r.paidCount).toBe(1);
    expect(r.depuisRendezVous).toBe(false);
  });

  it("melange ventes et rendez-vous sans vente", () => {
    const r = consoliderRevenu(
      [{ total: "100.000" }],
      [
        { totalPrice: "25.000", aUneVente: false },
        { totalPrice: "30.000", aUneVente: true },
      ],
      [],
    );
    // 100 (vente) + 25 (rdv seul). Le rdv a 30 est deja dans une vente.
    expect(r.netRevenue).toBe("125.000");
    expect(r.paidCount).toBe(2);
    expect(r.depuisRendezVous).toBe(true);
  });

  it("deduit les remboursements", () => {
    const r = consoliderRevenu(
      [{ total: "80.000" }],
      [],
      [{ totalAmount: "20.000" }],
    );
    expect(r.netRevenue).toBe("60.000");
    expect(r.refundTotal).toBe("20.000");
  });

  it("rend 0 quand il n'y a rien", () => {
    const r = consoliderRevenu([], [], []);
    expect(r.netRevenue).toBe("0.000");
    expect(r.paidCount).toBe(0);
    expect(r.depuisRendezVous).toBe(false);
  });

  /**
   * Le dinar tunisien a trois decimales. Additionner en `number` perdrait des
   * millimes ; les aides de money.ts travaillent en entiers.
   */
  it("garde les millimes exacts", () => {
    const r = consoliderRevenu(
      [{ total: "0.001" }, { total: "0.002" }],
      [{ totalPrice: "0.003", aUneVente: false }],
      [],
    );
    expect(r.netRevenue).toBe("0.006");
  });

  it("accepte une recette nette negative si les remboursements depassent", () => {
    // Un remboursement peut porter sur une vente d'une periode anterieure.
    const r = consoliderRevenu([{ total: "10.000" }], [], [{ totalAmount: "30.000" }]);
    expect(r.netRevenue).toBe("-20.000");
  });
});

describe("ticketMoyen", () => {
  it("divise la recette par le nombre de prestations", () => {
    const r = consoliderRevenu([{ total: "80.000" }, { total: "40.000" }], [], []);
    expect(ticketMoyen(r)).toBe("60.000"); // 120 / 2
  });

  it("rend null sans prestation — l'interface affiche « — »", () => {
    expect(ticketMoyen(consoliderRevenu([], [], []))).toBe(null);
  });

  it("compte aussi les rendez-vous sans vente", () => {
    const r = consoliderRevenu([], [{ totalPrice: "50.000", aUneVente: false }], []);
    expect(ticketMoyen(r)).toBe("50.000");
  });
});
