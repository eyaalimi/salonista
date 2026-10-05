import { describe, it, expect } from "vitest";
import {
  expirationLienSupport,
  lienEncoreValide,
  genererMotDePasseTemporaire,
  LONGUEUR_MDP_TEMPORAIRE,
  LIEN_SUPPORT_MINUTES,
  termeRecherchable,
  normaliserTerme,
  expirationVueLecture,
  vueLectureActive,
  VUE_LECTURE_MINUTES,
  masquerEmail,
  masquerTelephone,
  VERIFICATIONS_IDENTITE,
  ACTIONS,
  estEcriture,
} from "./support-salon";

const T = new Date("2026-10-05T12:00:00.000Z");

describe("lien de reinitialisation — usage unique et expiration", () => {
  it("expire 30 minutes apres sa creation", () => {
    const e = expirationLienSupport(T);
    expect(e.getTime() - T.getTime()).toBe(LIEN_SUPPORT_MINUTES * 60 * 1000);
    expect(LIEN_SUPPORT_MINUTES).toBe(30);
  });

  it("est valide avant l'echeance", () => {
    expect(lienEncoreValide(new Date(T.getTime() + 60_000), T)).toBe(true);
  });

  it("est perime apres l'echeance", () => {
    expect(lienEncoreValide(new Date(T.getTime() - 1), T)).toBe(false);
  });

  it("est perime pile a l'echeance", () => {
    expect(lienEncoreValide(T, T)).toBe(false);
  });

  /*
   * Une expiration absente vaut PERIME, jamais « valide pour toujours ». Une
   * donnee manquante ne doit pas ouvrir un acces.
   */
  it("traite une expiration absente comme perimee", () => {
    expect(lienEncoreValide(null, T)).toBe(false);
    expect(lienEncoreValide(undefined, T)).toBe(false);
  });
});

describe("mot de passe temporaire", () => {
  it("fait la longueur annoncee", () => {
    expect(genererMotDePasseTemporaire()).toHaveLength(LONGUEUR_MDP_TEMPORAIRE);
    expect(genererMotDePasseTemporaire(20)).toHaveLength(20);
  });

  /*
   * Ce mot de passe est DICTE AU TELEPHONE. Confondre 0 et O, ou 1 et l,
   * fait echouer la connexion et rappeler le salon — exactement ce qu'on
   * voulait eviter.
   */
  it("n'utilise aucun caractere ambigu a l'oral", () => {
    const interdits = /[0O1lI]/;
    for (let i = 0; i < 200; i++) {
      expect(genererMotDePasseTemporaire()).not.toMatch(interdits);
    }
  });

  it("n'utilise que des caracteres alphanumeriques", () => {
    for (let i = 0; i < 50; i++) {
      expect(genererMotDePasseTemporaire()).toMatch(/^[A-Za-z2-9]+$/);
    }
  });

  it("ne produit jamais deux fois le meme", () => {
    const vus = new Set<string>();
    for (let i = 0; i < 500; i++) vus.add(genererMotDePasseTemporaire());
    expect(vus.size).toBe(500);
  });

  it("melange les casses et les chiffres sur un echantillon", () => {
    // Un generateur casse qui ne tirerait qu'une seule classe de caracteres
    // passerait les tests precedents.
    const grand = Array.from({ length: 50 }, () => genererMotDePasseTemporaire()).join("");
    expect(grand).toMatch(/[a-z]/);
    expect(grand).toMatch(/[A-Z]/);
    expect(grand).toMatch(/[2-9]/);
  });
});

describe("recherche de salon", () => {
  it("accepte deux caracteres ou plus", () => {
    expect(termeRecherchable("No")).toBe(true);
    expect(termeRecherchable("Salon Nour")).toBe(true);
  });

  it("refuse ce qui est trop court — sinon la recherche rend la moitie de la base", () => {
    expect(termeRecherchable("a")).toBe(false);
    expect(termeRecherchable(" ")).toBe(false);
    expect(termeRecherchable("")).toBe(false);
  });

  it("refuse ce qui n'est pas une chaine", () => {
    for (const v of [null, undefined, 42, {}, []]) {
      expect(termeRecherchable(v)).toBe(false);
    }
  });

  it("conserve les espaces internes, retire ceux des bords", () => {
    expect(normaliserTerme("  Salon Nour  ")).toBe("Salon Nour");
  });

  it("borne la longueur", () => {
    expect(normaliserTerme("a".repeat(500))).toHaveLength(100);
  });
});

describe("vue « voir comme le salon »", () => {
  it("dure 15 minutes", () => {
    const e = expirationVueLecture(T);
    expect(e.getTime() - T.getTime()).toBe(VUE_LECTURE_MINUTES * 60 * 1000);
    expect(VUE_LECTURE_MINUTES).toBe(15);
  });

  it("est active avant l'echeance, fermee apres", () => {
    expect(vueLectureActive(new Date(T.getTime() + 1000), T)).toBe(true);
    expect(vueLectureActive(new Date(T.getTime() - 1000), T)).toBe(false);
  });

  it("est fermee sans echeance", () => {
    expect(vueLectureActive(null, T)).toBe(false);
    expect(vueLectureActive(undefined, T)).toBe(false);
  });
});

describe("masquage des coordonnees", () => {
  it("masque l'email en gardant de quoi le reconnaitre", () => {
    const m = masquerEmail("salon.nour@gmail.com");
    expect(m).toBe("s*********@gmail.com");
    expect(m).not.toContain("nour");
  });

  it("masque toujours au moins trois caracteres", () => {
    expect(masquerEmail("ab@x.tn")).toBe("a***@x.tn");
  });

  it("rend un tiret pour un email absent ou malforme", () => {
    expect(masquerEmail(null)).toBe("—");
    expect(masquerEmail(undefined)).toBe("—");
    expect(masquerEmail("pas-un-email")).toBe("—");
  });

  it("garde les quatre derniers chiffres du telephone", () => {
    expect(masquerTelephone("+21620123456")).toBe("••• 3456");
  });

  it("masque un numero de client passager", () => {
    expect(masquerTelephone("walk-in-abc123")).toBe("—");
  });

  it("rend un tiret sans numero", () => {
    expect(masquerTelephone(null)).toBe("—");
  });
});

describe("garde-fous du support", () => {
  it("affiche trois verifications d'identite", () => {
    expect(VERIFICATIONS_IDENTITE).toHaveLength(3);
    for (const v of VERIFICATIONS_IDENTITE) expect(v.length).toBeGreaterThan(20);
  });

  it("nomme chaque action de maniere lisible dans le journal", () => {
    for (const a of Object.values(ACTIONS)) {
      expect(a).toMatch(/^support\.[a-z_]+$/);
    }
  });

  it("n'a pas deux actions portant le meme nom", () => {
    const noms = Object.values(ACTIONS);
    expect(new Set(noms).size).toBe(noms.length);
  });
});

describe("estEcriture — ce que la lecture seule doit bloquer", () => {
  it("laisse passer les lectures", () => {
    for (const p of ["bookings.view", "customers.view", "inventory.view", "analytics.view"]) {
      expect(estEcriture(p), p).toBe(false);
    }
  });

  it("bloque les ecritures et les operations d'argent", () => {
    for (const p of [
      "pos.sell",
      "pos.refund",
      "pos.discount",
      "pos.void",
      "pos.cash_drawer",
      "bookings.create",
      "bookings.edit",
      "bookings.cancel",
      "customers.edit",
      "inventory.edit",
      "products.manage",
      "rewards.adjust",
      "employees.manage",
      "settings.manage",
    ]) {
      expect(estEcriture(p), p).toBe(true);
    }
  });

  /*
   * LE DEFAUT EST LE REFUS. Une permission ajoutee demain sera bloquee en
   * lecture seule sans que personne ait a y penser — l'inverse laisserait un
   * trou silencieux.
   */
  it("traite une permission inconnue comme une ecriture", () => {
    expect(estEcriture("permission.inventee.demain")).toBe(true);
    expect(estEcriture("")).toBe(true);
  });
});
