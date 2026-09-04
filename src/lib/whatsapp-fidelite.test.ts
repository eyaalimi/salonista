import { describe, it, expect } from "vitest";
import {
  MESSAGE_PAR_DEFAUT,
  composerMessage,
  lienWhatsappFidelite,
  numeroPourWhatsapp,
} from "./whatsapp-fidelite";

describe("composerMessage", () => {
  const vars = { name: "Amal", earned: 12, balance: 340 };

  it("remplace les trois variables", () => {
    expect(composerMessage("Bonjour {name}, +{earned} pts, total {balance}", vars)).toBe(
      "Bonjour Amal, +12 pts, total 340",
    );
  });

  it("remplace toutes les occurrences d'une meme variable", () => {
    expect(composerMessage("{name} {name}", vars)).toBe("Amal Amal");
  });

  it("retombe sur le gabarit par defaut", () => {
    expect(composerMessage(null, vars)).toContain("Amal");
    expect(composerMessage("   ", vars)).toBe(composerMessage(MESSAGE_PAR_DEFAUT, vars));
  });

  /**
   * Un salon qui se trompe de nom de variable doit VOIR son erreur dans
   * l'apercu, plutot que d'envoyer un message troue a ses clientes.
   */
  it("laisse intacte une variable inconnue", () => {
    expect(composerMessage("Bonjour {prenom}", vars)).toBe("Bonjour {prenom}");
  });

  /** « Bonjour  💖 » — deux espaces quand le prenom est inconnu. */
  it("nettoie les espaces doubles laisses par un nom vide", () => {
    expect(
      composerMessage("Bonjour {name} merci", { ...vars, name: "" }),
    ).toBe("Bonjour merci");
  });

  it("accepte zero point sans planter", () => {
    expect(composerMessage("+{earned}", { ...vars, earned: 0 })).toBe("+0");
  });
});

describe("numeroPourWhatsapp", () => {
  it("ne garde que les chiffres", () => {
    expect(numeroPourWhatsapp("+216 20 123 456")).toBe("21620123456");
    expect(numeroPourWhatsapp("20123456")).toBe("20123456");
  });

  it("refuse un numero trop court ou absent", () => {
    expect(numeroPourWhatsapp("123")).toBe(null);
    expect(numeroPourWhatsapp("")).toBe(null);
    expect(numeroPourWhatsapp(null)).toBe(null);
    expect(numeroPourWhatsapp(undefined)).toBe(null);
  });
});

describe("lienWhatsappFidelite", () => {
  const base = {
    phone: "+216 20 123 456",
    gabarit: "Bonjour {name}, +{earned} pts",
    name: "Amal",
    earned: 12,
    balance: 340,
  };

  it("construit un lien wa.me avec le texte encode", () => {
    const lien = lienWhatsappFidelite(base);
    expect(lien).toContain("https://wa.me/21620123456?text=");
    expect(decodeURIComponent(lien!)).toContain("Bonjour Amal, +12 pts");
  });

  /** Un « + » non encode couperait le message a cet endroit. */
  it("encode les caracteres speciaux", () => {
    const lien = lienWhatsappFidelite(base)!;
    expect(lien).not.toContain(" ");
    expect(lien.split("?text=")[1]).not.toContain("+pts");
  });

  /** « Vous avez gagne 0 points » dessert le programme. */
  it("ne propose rien sans point gagne", () => {
    expect(lienWhatsappFidelite({ ...base, earned: 0 })).toBe(null);
    expect(lienWhatsappFidelite({ ...base, earned: -5 })).toBe(null);
  });

  it("ne propose rien sans numero exploitable", () => {
    expect(lienWhatsappFidelite({ ...base, phone: null })).toBe(null);
    expect(lienWhatsappFidelite({ ...base, phone: "12" })).toBe(null);
  });

  it("fonctionne sans nom connu", () => {
    const lien = lienWhatsappFidelite({ ...base, name: null });
    expect(lien).not.toBe(null);
    expect(decodeURIComponent(lien!)).not.toContain("{name}");
  });
});
