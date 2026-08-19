import { describe, it, expect } from "vitest";
import { bookingClientName } from "./booking-client-name";

describe("bookingClientName", () => {
  it("prefere la fiche client du salon", () => {
    expect(
      bookingClientName(
        { firstName: "Manel", lastName: "Manoula" },
        { name: "Autre nom", email: "autre@example.com" },
        "Sans client",
      ),
    ).toBe("Manel Manoula");
  });

  it("accepte une fiche client sans nom de famille", () => {
    expect(bookingClientName({ firstName: "Manel" }, null, "Sans client")).toBe("Manel");
  });

  it("retombe sur le telephone quand la fiche n'a pas de nom", () => {
    expect(
      bookingClientName({ firstName: null, lastName: null, phone: "20123456" }, null, "Sans client"),
    ).toBe("20123456");
  });

  it("utilise le compte marketplace quand il n'y a pas de fiche client", () => {
    expect(
      bookingClientName(null, { name: "Manel Manoula", email: "manel@example.com" }, "Sans client"),
    ).toBe("Manel Manoula");
  });

  it("utilise l'identifiant de l'e-mail quand le compte n'a pas de nom", () => {
    expect(
      bookingClientName(null, { name: null, email: "manel.manoula@example.com" }, "Sans client"),
    ).toBe("manel.manoula");
  });

  it("ignore une fiche client vide et passe au compte", () => {
    expect(
      bookingClientName(
        { firstName: "", lastName: "  " },
        { name: "Manel", email: "manel@example.com" },
        "Sans client",
      ),
    ).toBe("Manel");
  });

  it("ignore un nom de compte fait uniquement d'espaces", () => {
    expect(
      bookingClientName(null, { name: "   ", email: "manel@example.com" }, "Sans client"),
    ).toBe("manel");
  });

  it("retombe sur le libelle fourni quand rien n'est connu", () => {
    expect(bookingClientName(null, null, "Sans client")).toBe("Sans client");
  });

  it("laisse chaque ecran choisir son libelle de repli", () => {
    expect(bookingClientName(null, null, "Client passager")).toBe("Client passager");
  });
});
