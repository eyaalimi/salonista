import { describe, it, expect } from "vitest";
import { decideFicheClient, placeholderTelephone } from "./booking-customer";

describe("decideFicheClient", () => {
  it("cree une fiche pour un nom saisi sans telephone", () => {
    // Le cas du bug : sans fiche, le rendez-vous retombait sur le compte du
    // salon et le calendrier affichait le nom du SALON.
    expect(decideFicheClient(null, "eya")).toEqual({
      action: "creer",
      firstName: "eya",
      lastName: null,
    });
  });

  it("separe prenom et nom de famille", () => {
    expect(decideFicheClient(null, "Manel Ayadi")).toEqual({
      action: "creer",
      firstName: "Manel",
      lastName: "Ayadi",
    });
  });

  it("garde les noms composes dans le nom de famille", () => {
    expect(decideFicheClient(null, "Eya Ben Ali")).toEqual({
      action: "creer",
      firstName: "Eya",
      lastName: "Ben Ali",
    });
  });

  it("absorbe les espaces multiples et de bordure", () => {
    expect(decideFicheClient(null, "  Manel   Ayadi  ")).toEqual({
      action: "creer",
      firstName: "Manel",
      lastName: "Ayadi",
    });
  });

  it("ne cree rien quand une fiche est deja choisie", () => {
    // Sinon on creerait un doublon et on ecraserait le nom enregistre.
    expect(decideFicheClient("cus_123", "eya")).toEqual({ action: "aucune" });
  });

  it("ne cree rien sans nom", () => {
    expect(decideFicheClient(null, "")).toEqual({ action: "aucune" });
    expect(decideFicheClient(null, "   ")).toEqual({ action: "aucune" });
    expect(decideFicheClient(null, null)).toEqual({ action: "aucune" });
    expect(decideFicheClient(null, undefined)).toEqual({ action: "aucune" });
  });
});

describe("placeholderTelephone", () => {
  it("porte le prefixe que les lectures reconnaissent", () => {
    // `phone.startsWith("walk-in-")` est le test utilise partout pour masquer
    // le faux numero : le prefixe ne doit pas changer.
    expect(placeholderTelephone()).toMatch(/^walk-in-/);
  });

  it("ne ressemble jamais a un numero tunisien", () => {
    const numero = placeholderTelephone();
    expect(numero).not.toMatch(/^\+?[0-9\s]+$/);
  });

  it("produit une valeur differente a chaque appel", () => {
    // `Customer.phone` est @unique : deux clientes sans telephone creees la
    // meme milliseconde ne doivent pas se heurter.
    const valeurs = new Set(Array.from({ length: 50 }, () => placeholderTelephone()));
    expect(valeurs.size).toBe(50);
  });
});
