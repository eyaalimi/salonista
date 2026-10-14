import { describe, it, expect } from "vitest";
import {
  CATEGORIES,
  estCategorie,
  basculerType,
  choisirPrincipale,
  typesOrdonnes,
  choixInitial,
  refusLocalisationInscription,
  reparerAdresse,
  type ChoixTypes,
} from "./inscription-salon";
import { refusAdresseSalon } from "./tunisie-geo";

const VIDE: ChoixTypes = { types: [], principale: null };

describe("estCategorie", () => {
  it("accepte les six categories de la base", () => {
    for (const c of CATEGORIES) expect(estCategorie(c)).toBe(true);
  });

  // La route ecrivait `category` sans verification : une valeur hors liste
  // faisait planter l'enregistrement en base.
  it("refuse tout le reste", () => {
    expect(estCategorie("Coiffure")).toBe(false);
    expect(estCategorie("SPA")).toBe(false);
    expect(estCategorie("")).toBe(false);
    expect(estCategorie(null)).toBe(false);
  });
});

describe("basculerType — la categorie principale", () => {
  it("le premier type coche devient principal", () => {
    expect(basculerType(VIDE, "ONGLERIE")).toEqual({
      types: ["ONGLERIE"],
      principale: "ONGLERIE",
    });
  });

  it("cocher un second type ne change pas la principale", () => {
    const c = basculerType(basculerType(VIDE, "ONGLERIE"), "COIFFURE");
    expect(c.types).toEqual(["ONGLERIE", "COIFFURE"]);
    expect(c.principale).toBe("ONGLERIE");
  });

  // Sans cette regle, la principale pointerait sur un type decoche : le
  // profil recevrait une categorie que le salon ne propose plus.
  it("decocher la principale la transmet au type suivant", () => {
    const deux: ChoixTypes = { types: ["ONGLERIE", "COIFFURE"], principale: "ONGLERIE" };
    expect(basculerType(deux, "ONGLERIE")).toEqual({
      types: ["COIFFURE"],
      principale: "COIFFURE",
    });
  });

  it("decocher un type secondaire garde la principale", () => {
    const deux: ChoixTypes = { types: ["ONGLERIE", "COIFFURE"], principale: "ONGLERIE" };
    expect(basculerType(deux, "COIFFURE").principale).toBe("ONGLERIE");
  });

  it("decocher le dernier type vide la principale", () => {
    expect(basculerType({ types: ["ONGLERIE"], principale: "ONGLERIE" }, "ONGLERIE")).toEqual(
      VIDE,
    );
  });

  it("la principale fait toujours partie des types coches", () => {
    let c = VIDE;
    for (const t of ["ONGLERIE", "COIFFURE", "ONGLERIE", "MASSAGE", "COIFFURE"]) {
      c = basculerType(c, t);
      if (c.principale !== null) expect(c.types).toContain(c.principale);
    }
  });
});

describe("choisirPrincipale", () => {
  it("change la principale parmi les types coches", () => {
    const deux: ChoixTypes = { types: ["ONGLERIE", "COIFFURE"], principale: "ONGLERIE" };
    expect(choisirPrincipale(deux, "COIFFURE").principale).toBe("COIFFURE");
  });

  // Une categorie de profil doit correspondre a une prestation proposee.
  it("refuse un type non coche", () => {
    const un: ChoixTypes = { types: ["ONGLERIE"], principale: "ONGLERIE" };
    expect(choisirPrincipale(un, "MASSAGE")).toEqual(un);
  });
});

describe("typesOrdonnes", () => {
  it("place la principale en tete, pour l'etape 2", () => {
    expect(
      typesOrdonnes({ types: ["ONGLERIE", "COIFFURE", "MASSAGE"], principale: "COIFFURE" }),
    ).toEqual(["COIFFURE", "ONGLERIE", "MASSAGE"]);
  });

  it("ne perd ni ne duplique aucun type", () => {
    const o = typesOrdonnes({ types: ["ONGLERIE", "COIFFURE"], principale: "COIFFURE" });
    expect(o).toHaveLength(2);
    expect(new Set(o).size).toBe(2);
  });
});

describe("choixInitial — a la reouverture de l'assistant", () => {
  // Si la gerante a change sa categorie dans le profil, l'assistant doit le
  // refleter : la valeur ENREGISTREE fait foi, pas le souvenir du navigateur.
  it("la categorie du profil fait foi", () => {
    const c = choixInitial("COIFFURE", ["ONGLERIE", "COIFFURE"]);
    expect(c.principale).toBe("COIFFURE");
    expect(c.types[0]).toBe("COIFFURE");
    expect(c.types).toContain("ONGLERIE");
  });

  it("ecarte les valeurs memorisees invalides", () => {
    const c = choixInitial("ONGLERIE", ["ONGLERIE", "n'importe quoi"]);
    expect(c.types).toEqual(["ONGLERIE"]);
  });

  it("sans categorie de profil, reprend les types memorises", () => {
    expect(choixInitial(null, ["MASSAGE", "ONGLERIE"])).toEqual({
      types: ["MASSAGE", "ONGLERIE"],
      principale: "MASSAGE",
    });
  });

  it("sans rien, part de zero", () => {
    expect(choixInitial(undefined, [])).toEqual(VIDE);
  });
});

describe("refusLocalisationInscription", () => {
  it("accepte un couple existant", () => {
    expect(refusLocalisationInscription("Tunis", "Carthage")).toBeNull();
    expect(refusLocalisationInscription("Sousse", "Hammam Sousse")).toBeNull();
  });

  it("exige le gouvernorat", () => {
    expect(refusLocalisationInscription("", "Carthage")).not.toBeNull();
    expect(refusLocalisationInscription(null, null)).not.toBeNull();
  });

  it("exige la delegation", () => {
    expect(refusLocalisationInscription("Tunis", "")).not.toBeNull();
  });

  // Le defaut d'origine : « Tunis » tape en texte libre comme ville. Ce
  // n'est PAS une delegation, et le profil le refusait ensuite.
  it("refuse une ville libre qui n'est pas une delegation", () => {
    expect(refusLocalisationInscription("Tunis", "Tunis")).not.toBeNull();
  });

  it("refuse une delegation d'un autre gouvernorat", () => {
    expect(refusLocalisationInscription("Sousse", "Carthage")).not.toBeNull();
  });

  // Ce que l'inscription accepte, le profil doit l'accepter aussi : sinon la
  // gerante serait bloquee en ouvrant son profil avec une adresse validee.
  it("concorde avec la validation du profil sur le couple", () => {
    for (const [g, d] of [
      ["Tunis", "Carthage"],
      ["Sousse", "Hammam Sousse"],
      ["Tunis", "Tunis"],
      ["Sousse", "Carthage"],
    ] as const) {
      const inscription = refusLocalisationInscription(g, d) === null;
      const profil = refusAdresseSalon(g, d, "12 rue de la Liberté") === null;
      expect(inscription).toBe(profil);
    }
  });
});

describe("reparerAdresse — les salons inscrits avant ce correctif", () => {
  it("range une ville qui est un gouvernorat a sa place", () => {
    expect(reparerAdresse({ city: "Tunis", governorate: null })).toEqual({
      action: "gouvernorat",
      gouvernorat: "Tunis",
    });
  });

  it("ne touche pas une adresse deja coherente", () => {
    expect(reparerAdresse({ city: "Carthage", governorate: "Tunis" })).toEqual({
      action: "aucune",
    });
  });

  it("ne touche pas une adresse vide", () => {
    expect(reparerAdresse({ city: null, governorate: null }).action).toBe("aucune");
    expect(reparerAdresse({ city: "  ", governorate: null }).action).toBe("aucune");
  });

  // Deviner une delegation depuis une saisie libre ecrirait une adresse fausse
  // avec l'apparence d'une adresse juste : on signale, on ne touche pas.
  it("signale sans modifier une saisie ininterpretable", () => {
    expect(reparerAdresse({ city: "Menzah 6", governorate: null })).toEqual({
      action: "ambigu",
      valeur: "Menzah 6",
    });
    expect(reparerAdresse({ city: "tunis centre", governorate: null }).action).toBe("ambigu");
  });

  // La casse compte : « tunis » n'est pas exactement « Tunis ». On ne devine
  // pas — un humain tranchera.
  it("n'interprete pas une casse differente", () => {
    expect(reparerAdresse({ city: "tunis", governorate: null }).action).toBe("ambigu");
  });
});
