import { describe, it, expect, afterEach } from "vitest";
import { publicOrigin } from "./public-origin";

const initial = process.env.NEXTAUTH_URL;
afterEach(() => {
  if (initial === undefined) delete process.env.NEXTAUTH_URL;
  else process.env.NEXTAUTH_URL = initial;
});

describe("publicOrigin", () => {
  it("rend NEXTAUTH_URL", () => {
    process.env.NEXTAUTH_URL = "https://salonista.tn";
    expect(publicOrigin()).toBe("https://salonista.tn");
  });

  it("retire la barre oblique finale", () => {
    process.env.NEXTAUTH_URL = "https://salonista.tn/";
    expect(publicOrigin()).toBe("https://salonista.tn");
  });

  it("ignore les espaces autour", () => {
    process.env.NEXTAUTH_URL = "  https://salonista.tn  ";
    expect(publicOrigin()).toBe("https://salonista.tn");
  });

  /**
   * Le repli est local, JAMAIS l'en-tete de la requete : un lien casse en
   * developpement vaut mieux qu'une redirection ouverte en production.
   */
  it("retombe sur localhost quand la variable manque", () => {
    delete process.env.NEXTAUTH_URL;
    expect(publicOrigin()).toBe("http://localhost:3000");
  });

  it("retombe sur localhost quand la variable est vide", () => {
    process.env.NEXTAUTH_URL = "   ";
    expect(publicOrigin()).toBe("http://localhost:3000");
  });

  it("ne prend AUCUN argument — la requete ne doit plus l'influencer", () => {
    expect(publicOrigin.length).toBe(0);
  });
});
