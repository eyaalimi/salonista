import { describe, expect, it } from "vitest";
import {
  MESSAGE_CREDIT_PAR_DEFAUT,
  composerMessageCredit,
  lienRappelCredit,
  montantPourMessage,
} from "./whatsapp-credit";

describe("montantPourMessage", () => {
  it("trois décimales, virgule", () => {
    expect(montantPourMessage("65")).toBe("65,000");
    expect(montantPourMessage("95.5")).toBe("95,500");
    expect(montantPourMessage("0.007")).toBe("0,007");
  });
});

describe("composerMessageCredit", () => {
  const vars = { name: "Amira", montant: "65,000", salon: "Salon Yasmine" };

  it("message par défaut en darija, variables remplacées", () => {
    expect(composerMessageCredit(null, vars)).toBe(
      "Aslema Amira ! Ya3tik essa7a. Ena Salon Yasmine, n7eb nfakrek elli 3andek 65,000 DT mazelou. Ki tet3adda 3lina, merci barcha !",
    );
  });

  it("un gabarit vide retombe sur le défaut", () => {
    expect(composerMessageCredit("   ", vars)).toBe(composerMessageCredit(MESSAGE_CREDIT_PAR_DEFAUT, vars));
  });

  it("variable inconnue laissée telle quelle", () => {
    expect(composerMessageCredit("Salut {prenom}, {montant} DT", vars)).toBe("Salut {prenom}, 65,000 DT");
  });

  it("prénom absent : pas d'espace double", () => {
    expect(composerMessageCredit(null, { ...vars, name: "" })).toMatch(/^Aslema ! Ya3tik/);
    expect(composerMessageCredit(null, { ...vars, name: "" })).not.toMatch(/ {2}/);
  });
});

describe("lienRappelCredit", () => {
  const base = { phone: "+216 56 549 547", name: "Amira", salon: "Salon Yasmine", montant: "65.000" };

  it("lien wa.me avec le texte encodé", () => {
    const lien = lienRappelCredit(base);
    expect(lien).toMatch(/^https:\/\/wa\.me\/21656549547\?text=/);
    expect(decodeURIComponent(lien!.split("text=")[1])).toContain("65,000 DT");
  });

  it("rien sans numéro joignable, pour une fiche passage, ou sans montant dû", () => {
    expect(lienRappelCredit({ ...base, phone: null })).toBeNull();
    expect(lienRappelCredit({ ...base, phone: "123" })).toBeNull();
    expect(lienRappelCredit({ ...base, phone: "walk-in-12345678" })).toBeNull();
    expect(lienRappelCredit({ ...base, montant: "0" })).toBeNull();
  });
});
