import { describe, it, expect } from "vitest";
import {
  estActif,
  dernierSigneDeVie,
  joursDInactivite,
  statutSalon,
  joursDeLaPeriode,
  champCsv,
  construireCsv,
} from "./campagne-tableau";

const J = (n: number) => new Date(2026, 9, n, 12, 0, 0);

describe("estActif — la definition d'un salon actif", () => {
  const depuis = J(1);
  const jusqua = J(10);

  it("une vente dans la periode suffit", () => {
    expect(
      estActif({ derniereVenteAt: J(5), derniereConnexionAt: null }, depuis, jusqua),
    ).toBe(true);
  });

  /*
   * Une connexion SANS vente compte aussi : un salon qui ouvre sa caisse
   * chaque matin pour consulter son agenda est vivant, meme sans encaissement
   * ce jour-la. Ne compter que les ventes ferait passer pour perdus des
   * salons parfaitement installes.
   */
  it("une connexion sans vente suffit aussi", () => {
    expect(
      estActif({ derniereVenteAt: null, derniereConnexionAt: J(5) }, depuis, jusqua),
    ).toBe(true);
  });

  it("rien du tout = inactif", () => {
    expect(
      estActif({ derniereVenteAt: null, derniereConnexionAt: null }, depuis, jusqua),
    ).toBe(false);
  });

  it("une activite ANTERIEURE a la periode ne compte pas", () => {
    expect(
      estActif({ derniereVenteAt: J(-5), derniereConnexionAt: null }, depuis, jusqua),
    ).toBe(false);
  });

  it("une activite POSTERIEURE a la periode ne compte pas", () => {
    expect(
      estActif({ derniereVenteAt: J(20), derniereConnexionAt: null }, depuis, jusqua),
    ).toBe(false);
  });

  it("les bornes sont inclusives", () => {
    expect(estActif({ derniereVenteAt: depuis, derniereConnexionAt: null }, depuis, jusqua)).toBe(true);
    expect(estActif({ derniereVenteAt: jusqua, derniereConnexionAt: null }, depuis, jusqua)).toBe(true);
  });
});

describe("dernierSigneDeVie", () => {
  it("prend le plus recent des deux", () => {
    expect(
      dernierSigneDeVie({ derniereVenteAt: J(3), derniereConnexionAt: J(7) }),
    ).toEqual(J(7));
    expect(
      dernierSigneDeVie({ derniereVenteAt: J(9), derniereConnexionAt: J(2) }),
    ).toEqual(J(9));
  });

  it("supporte qu'un seul existe", () => {
    expect(dernierSigneDeVie({ derniereVenteAt: J(3), derniereConnexionAt: null })).toEqual(J(3));
    expect(dernierSigneDeVie({ derniereVenteAt: null, derniereConnexionAt: J(4) })).toEqual(J(4));
  });

  it("rend null quand le salon n'a jamais rien fait", () => {
    expect(dernierSigneDeVie({ derniereVenteAt: null, derniereConnexionAt: null })).toBeNull();
  });
});

describe("joursDInactivite", () => {
  it("compte les jours pleins", () => {
    expect(
      joursDInactivite({ derniereVenteAt: J(1), derniereConnexionAt: null }, J(11)),
    ).toBe(10);
  });

  it("rend 0 le jour meme", () => {
    expect(
      joursDInactivite({ derniereVenteAt: J(5), derniereConnexionAt: null }, J(5)),
    ).toBe(0);
  });

  it("rend null sans aucun signe de vie", () => {
    expect(
      joursDInactivite({ derniereVenteAt: null, derniereConnexionAt: null }, J(5)),
    ).toBeNull();
  });
});

describe("statutSalon", () => {
  /*
   * « Jamais vendu » PRIME sur « actif » : un salon inscrit qui ouvre son
   * agenda sans jamais encaisser n'est pas installe, et c'est precisement
   * celui qu'il faut rappeler. Le ranger parmi les actifs le rendrait
   * invisible dans le tableau de bord.
   */
  it("classe « jamais vendu » meme si le salon se connecte", () => {
    expect(
      statutSalon({ derniereVenteAt: null, derniereConnexionAt: J(10) }, J(10)),
    ).toBe("jamais-vendu");
  });

  it("classe actif une vente recente", () => {
    expect(
      statutSalon({ derniereVenteAt: J(8), derniereConnexionAt: null }, J(10)),
    ).toBe("actif");
  });

  it("classe inactif au-dela du seuil", () => {
    expect(
      statutSalon({ derniereVenteAt: J(1), derniereConnexionAt: null }, J(30)),
    ).toBe("inactif");
  });

  it("respecte le seuil, bornes comprises", () => {
    const s = { derniereVenteAt: J(1), derniereConnexionAt: null };
    expect(statutSalon(s, J(15), 14)).toBe("actif");   // exactement 14 jours
    expect(statutSalon(s, J(16), 14)).toBe("inactif"); // 15 jours
  });

  it("une connexion recente maintient actif un salon qui a deja vendu", () => {
    expect(
      statutSalon({ derniereVenteAt: J(1), derniereConnexionAt: J(29) }, J(30)),
    ).toBe("actif");
  });
});

describe("champCsv — l'export", () => {
  it("entoure de guillemets", () => {
    expect(champCsv("Salon Nour")).toBe('"Salon Nour"');
  });

  it("double les guillemets internes", () => {
    expect(champCsv('Salon "Chez Nour"')).toBe('"Salon ""Chez Nour"""');
  });

  it("supporte le point-virgule, separateur du fichier", () => {
    expect(champCsv("Sousse; Monastir")).toBe('"Sousse; Monastir"');
  });

  it("supporte un retour a la ligne", () => {
    expect(champCsv("a\nb")).toBe('"a\nb"');
  });

  /*
   * INJECTION DE FORMULE. Sans l'apostrophe, Excel executerait la cellule a
   * l'ouverture du fichier. Un nom de salon suffit a declencher l'attaque.
   */
  it("neutralise les formules Excel", () => {
    expect(champCsv("=1+1")).toBe("\"'=1+1\"");
    expect(champCsv("+41791234567")).toBe("\"'+41791234567\"");
    expect(champCsv("-2+3")).toBe("\"'-2+3\"");
    expect(champCsv("@SUM(A1)")).toBe("\"'@SUM(A1)\"");
    expect(champCsv('=cmd|"/c calc"!A1')).toContain("'=");
  });

  it("rend une cellule vide pour null et undefined", () => {
    expect(champCsv(null)).toBe('""');
    expect(champCsv(undefined)).toBe('""');
  });

  it("serialise les nombres", () => {
    expect(champCsv(42)).toBe('"42"');
    expect(champCsv(0)).toBe('"0"');
  });
});

describe("construireCsv", () => {
  it("assemble entetes et lignes", () => {
    const csv = construireCsv(["Salon", "Ville"], [["Nour", "Sousse"]]);
    expect(csv).toContain('"Salon";"Ville"');
    expect(csv).toContain('"Nour";"Sousse"');
  });

  it("commence par un BOM UTF-8, sinon Excel casse les accents", () => {
    expect(construireCsv(["a"], [])).toMatch(/^﻿/);
  });

  it("separe les lignes en CRLF", () => {
    const csv = construireCsv(["a"], [["b"], ["c"]]);
    expect(csv.split("\r\n")).toHaveLength(3);
  });

  it("supporte un tableau vide", () => {
    expect(construireCsv(["a", "b"], [])).toBe('﻿"a";"b"');
  });
});

describe("joursDeLaPeriode — la courbe jour par jour", () => {
  /*
   * REGRESSION REELLE, trouvee en verifiant la courbe sur de vraies donnees :
   * les clics du jour n'apparaissaient sur AUCUNE barre. `depuis` etant a
   * minuit heure LOCALE (22h UTC la veille en Tunisie), la boucle s'arretait
   * la veille et le jour courant sortait de la periode.
   */
  it("inclut le jour courant, meme non termine", () => {
    // Minuit heure locale Tunisie le 5 = 22h UTC le 4.
    const depuis = new Date("2026-10-04T22:00:00.000Z");
    const jusqua = new Date("2026-10-05T11:20:00.000Z");
    expect(joursDeLaPeriode(depuis, jusqua)).toContain("2026-10-05");
  });

  it("inclut les deux bornes", () => {
    const j = joursDeLaPeriode(
      new Date("2026-10-01T00:00:00.000Z"),
      new Date("2026-10-03T23:59:59.000Z"),
    );
    expect(j).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
  });

  it("rend un seul jour quand depuis et jusqua tombent le meme jour", () => {
    const j = joursDeLaPeriode(
      new Date("2026-10-05T01:00:00.000Z"),
      new Date("2026-10-05T23:00:00.000Z"),
    );
    expect(j).toEqual(["2026-10-05"]);
  });

  it("traverse un changement de mois", () => {
    const j = joursDeLaPeriode(
      new Date("2026-09-29T00:00:00.000Z"),
      new Date("2026-10-02T12:00:00.000Z"),
    );
    expect(j).toEqual(["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
  });

  it("ne boucle pas a l'infini si jusqua precede depuis", () => {
    expect(
      joursDeLaPeriode(new Date("2026-10-05T00:00:00Z"), new Date("2026-10-01T00:00:00Z")),
    ).toEqual([]);
  });
});
