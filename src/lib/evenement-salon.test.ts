import { describe, it, expect } from "vitest";
import {
  RETENTION_JOURS,
  limitePurge,
  EVENEMENTS,
  ECRANS_SUIVIS,
  FENETRE_VISITE_MINUTES,
  DELAI_ABANDON_MINUTES,
  SEUIL_ECHECS_ALERTE,
  estEcranSuivi,
  doitEnregistrerVisite,
  compterPaniersAbandonnes,
  aUneAlerteSecurite,
  libelleEvenement,
  TYPES_ALERTE,
} from "./evenement-salon";

const T0 = new Date("2026-10-13T10:00:00.000Z");
const min = (n: number) => new Date(T0.getTime() + n * 60_000);

describe("types d'evenements", () => {
  it("aucun type ne laisse deviner un secret", () => {
    // Le nom d'un type finit dans le cockpit et dans la base : il ne doit
    // jamais contenir de quoi reconstituer un identifiant.
    for (const t of Object.values(EVENEMENTS)) {
      expect(t).not.toMatch(/mot_de_passe=|pin=|email=|@/);
    }
  });

  it("les types sont tous distincts", () => {
    const vus = Object.values(EVENEMENTS);
    expect(new Set(vus).size).toBe(vus.length);
  });

  it("libelleEvenement retombe sur le type brut s'il est inconnu", () => {
    expect(libelleEvenement(EVENEMENTS.PIN_VERROUILLAGE)).toBe("PIN verrouillé");
    expect(libelleEvenement("type.inconnu")).toBe("type.inconnu");
  });
});

describe("estEcranSuivi", () => {
  it("accepte les trois ecrans suivis", () => {
    for (const e of ECRANS_SUIVIS) expect(estEcranSuivi(e)).toBe(true);
  });

  it("refuse tout le reste", () => {
    expect(estEcranSuivi("agenda")).toBe(false);
    expect(estEcranSuivi("")).toBe(false);
    expect(estEcranSuivi(null)).toBe(false);
    expect(estEcranSuivi(42)).toBe(false);
    expect(estEcranSuivi(undefined)).toBe(false);
  });
});

describe("doitEnregistrerVisite", () => {
  it("enregistre la toute premiere visite", () => {
    expect(doitEnregistrerVisite(null, T0)).toBe(true);
  });

  it("n'enregistre pas deux visites dans la meme fenetre", () => {
    expect(doitEnregistrerVisite(T0, min(1))).toBe(false);
    expect(doitEnregistrerVisite(T0, min(FENETRE_VISITE_MINUTES - 1))).toBe(false);
  });

  it("enregistre de nouveau une fois la fenetre ecoulee", () => {
    expect(doitEnregistrerVisite(T0, min(FENETRE_VISITE_MINUTES))).toBe(true);
    expect(doitEnregistrerVisite(T0, min(FENETRE_VISITE_MINUTES + 1))).toBe(true);
  });

  // Une tablette de comptoir peut avoir l'horloge devant celle du serveur.
  it("n'ecrit pas sur un ecart negatif", () => {
    expect(doitEnregistrerVisite(min(10), T0)).toBe(false);
  });
});

describe("compterPaniersAbandonnes", () => {
  // Le cas nominal : l'ecran s'ouvre, la vente suit. Aucun abandon.
  it("ne compte pas une ouverture suivie d'une vente", () => {
    const n = compterPaniersAbandonnes(
      [{ a: T0 }],
      [min(2)],
      min(120),
    );
    expect(n).toBe(0);
  });

  it("compte une ouverture sans vente apres le delai", () => {
    const n = compterPaniersAbandonnes([{ a: T0 }], [], min(120));
    expect(n).toBe(1);
  });

  // Le garde-fou qui compte : sans lui, tout encaissement observe en direct
  // serait signale comme un abandon.
  it("ne compte PAS une ouverture encore trop recente", () => {
    const n = compterPaniersAbandonnes(
      [{ a: T0 }],
      [],
      min(DELAI_ABANDON_MINUTES - 1),
    );
    expect(n).toBe(0);
  });

  it("compte une vente arrivee juste avant la limite", () => {
    const n = compterPaniersAbandonnes(
      [{ a: T0 }],
      [min(DELAI_ABANDON_MINUTES)],
      min(120),
    );
    expect(n).toBe(0);
  });

  it("une vente arrivee APRES le delai ne sauve pas l'ouverture", () => {
    const n = compterPaniersAbandonnes(
      [{ a: T0 }],
      [min(DELAI_ABANDON_MINUTES + 1)],
      min(120),
    );
    expect(n).toBe(1);
  });

  it("une vente ANTERIEURE a l'ouverture ne compte pas", () => {
    const n = compterPaniersAbandonnes([{ a: min(30) }], [T0], min(120));
    expect(n).toBe(1);
  });

  it("compte plusieurs abandons parmi des ouvertures melangees", () => {
    const n = compterPaniersAbandonnes(
      [{ a: T0 }, { a: min(60) }, { a: min(120) }],
      [min(61)], // seule la deuxieme aboutit
      min(300),
    );
    expect(n).toBe(2);
  });

  it("rend 0 sans aucune ouverture", () => {
    expect(compterPaniersAbandonnes([], [min(5)], min(120))).toBe(0);
  });

  it("ne depend pas de l'ordre des ventes fournies", () => {
    const desordre = compterPaniersAbandonnes(
      [{ a: T0 }, { a: min(60) }],
      [min(61), min(2)],
      min(300),
    );
    expect(desordre).toBe(0);
  });
});

describe("aUneAlerteSecurite", () => {
  const vide = { verrouillages: 0, pinIncorrects: 0, mdpIncorrects: 0 };

  it("un seul verrouillage suffit — quelqu'un est dehors maintenant", () => {
    expect(aUneAlerteSecurite({ ...vide, verrouillages: 1 })).toBe(true);
  });

  it("quelques fautes de frappe ne declenchent rien", () => {
    expect(aUneAlerteSecurite({ ...vide, pinIncorrects: 2 })).toBe(false);
    expect(aUneAlerteSecurite({ ...vide, mdpIncorrects: 2 })).toBe(false);
  });

  it("additionne PIN et mot de passe pour atteindre le seuil", () => {
    expect(
      aUneAlerteSecurite({ ...vide, pinIncorrects: 3, mdpIncorrects: 2 }),
    ).toBe(true);
  });

  it("declenche pile au seuil", () => {
    expect(
      aUneAlerteSecurite({ ...vide, pinIncorrects: SEUIL_ECHECS_ALERTE }),
    ).toBe(true);
    expect(
      aUneAlerteSecurite({ ...vide, pinIncorrects: SEUIL_ECHECS_ALERTE - 1 }),
    ).toBe(false);
  });

  it("ne declenche rien sur un salon sans incident", () => {
    expect(aUneAlerteSecurite(vide)).toBe(false);
  });

  it("TYPES_ALERTE ne contient que des types connus", () => {
    const connus = Object.values(EVENEMENTS) as string[];
    for (const t of TYPES_ALERTE) expect(connus).toContain(t);
  });
});

describe("limitePurge", () => {
  it("recule de la duree de retention", () => {
    const limite = limitePurge(T0);
    const ecartJours = Math.round((T0.getTime() - limite.getTime()) / 86_400_000);
    expect(ecartJours).toBe(RETENTION_JOURS);
  });

  // La borne doit depasser la plus large fenetre que le cockpit interroge
  // (90 jours d'inscription), sinon la purge effacerait des evenements que la
  // page affiche encore.
  it("couvre la plus large fenetre du cockpit", () => {
    expect(RETENTION_JOURS).toBeGreaterThanOrEqual(90);
  });

  it("ne modifie pas la date qu'on lui passe", () => {
    const avant = new Date(T0);
    limitePurge(T0);
    expect(T0.getTime()).toBe(avant.getTime());
  });
});
