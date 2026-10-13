import { describe, expect, it } from "vitest";
import {
  ajouterMois,
  calculerPlan,
  compterDansLimite,
  nouvelleEcheancePremium,
  dateCourteFr,
  joindreFr,
  decalagePauseMs,
  finEssaiDepuis,
  fonctionDisponible,
  lignesPerteFinEssai,
  peutAjouterEmployee,
  repartirEquipe,
  type EmployeeEquipe,
} from "./plan";

const JOUR = 24 * 60 * 60 * 1000;
const VENTE = new Date("2026-10-01T10:00:00Z");
const plus = (d: Date, jours: number) => new Date(d.getTime() + jours * JOUR);

describe("calculerPlan — un mois offert a partir de la premiere vente", () => {
  it("aucune vente, aucune ligne : tout est debloque, le compteur ne tourne pas", () => {
    expect(
      calculerPlan({ premium: null, premiereVenteAt: null, maintenant: plus(VENTE, 400) }),
    ).toEqual({ etat: "AVANT_PREMIERE_VENTE" });
  });

  it("premiere vente sans ligne encore posee : essai depuis la vente", () => {
    expect(
      calculerPlan({ premium: null, premiereVenteAt: VENTE, maintenant: plus(VENTE, 2) }),
    ).toEqual({ etat: "ESSAI", finEssai: plus(VENTE, 30), joursRestants: 28 });
  });

  it("salon qui vend depuis plus d'un mois : il a eu son mois, version gratuite", () => {
    expect(
      calculerPlan({ premium: null, premiereVenteAt: VENTE, maintenant: plus(VENTE, 90) }),
    ).toEqual({ etat: "GRATUIT", depuis: plus(VENTE, 30) });
  });

  it("l'essai dure exactement 30 jours a partir de la vente", () => {
    expect(finEssaiDepuis(VENTE)).toEqual(plus(VENTE, 30));
  });

  it("ligne TRIAL non echue : essai, avec les jours restants", () => {
    expect(
      calculerPlan({
        premium: { status: "TRIAL", expiresAt: finEssaiDepuis(VENTE) },
        premiereVenteAt: VENTE,
        maintenant: plus(VENTE, 27),
      }),
    ).toEqual({ etat: "ESSAI", finEssai: plus(VENTE, 30), joursRestants: 3 });
  });

  it("une milliseconde avant l'echeance : encore en essai, 1 jour restant", () => {
    const fin = finEssaiDepuis(VENTE);
    expect(
      calculerPlan({
        premium: { status: "TRIAL", expiresAt: fin },
        premiereVenteAt: VENTE,
        maintenant: new Date(fin.getTime() - 1),
      }),
    ).toMatchObject({ etat: "ESSAI", joursRestants: 1 });
  });

  it("a l'instant exact de l'echeance : version gratuite depuis l'echeance", () => {
    const fin = finEssaiDepuis(VENTE);
    expect(
      calculerPlan({ premium: { status: "TRIAL", expiresAt: fin }, premiereVenteAt: VENTE, maintenant: fin }),
    ).toEqual({ etat: "GRATUIT", depuis: fin });
  });

  it("ACTIVE non echue : Premium jusqu'a l'echeance", () => {
    const jusquAu = plus(VENTE, 60);
    expect(
      calculerPlan({ premium: { status: "ACTIVE", expiresAt: jusquAu }, premiereVenteAt: VENTE, maintenant: VENTE }),
    ).toEqual({ etat: "PREMIUM", jusquAu });
  });

  it("ACTIVE sans echeance : Premium illimite (demo), meme sans vente", () => {
    expect(
      calculerPlan({ premium: { status: "ACTIVE", expiresAt: null }, premiereVenteAt: null, maintenant: VENTE }),
    ).toEqual({ etat: "PREMIUM", jusquAu: null });
  });

  it("ACTIVE echue : version gratuite depuis l'echeance", () => {
    const fin = plus(VENTE, 10);
    expect(
      calculerPlan({ premium: { status: "ACTIVE", expiresAt: fin }, premiereVenteAt: VENTE, maintenant: plus(VENTE, 11) }),
    ).toEqual({ etat: "GRATUIT", depuis: fin });
  });

  it("SUSPENDED, meme avec une echeance future : version gratuite", () => {
    const fin = plus(VENTE, 60);
    expect(
      calculerPlan({ premium: { status: "SUSPENDED", expiresAt: fin }, premiereVenteAt: VENTE, maintenant: VENTE }),
    ).toEqual({ etat: "GRATUIT", depuis: fin });
  });

  it("EXPIRED (Premium retire) : version gratuite", () => {
    expect(
      calculerPlan({ premium: { status: "EXPIRED", expiresAt: null }, premiereVenteAt: VENTE, maintenant: VENTE }),
    ).toEqual({ etat: "GRATUIT", depuis: null });
  });

  it("essai ecoule puis Premium paye : Premium", () => {
    const maintenant = plus(VENTE, 45);
    const jusquAu = plus(maintenant, 30);
    expect(
      calculerPlan({ premium: { status: "ACTIVE", expiresAt: jusquAu }, premiereVenteAt: VENTE, maintenant }),
    ).toEqual({ etat: "PREMIUM", jusquAu });
  });
});

describe("fonctionDisponible", () => {
  const gratuit = { etat: "GRATUIT", depuis: null } as const;

  it("tout est disponible hors version gratuite", () => {
    for (const plan of [
      { etat: "AVANT_PREMIERE_VENTE" } as const,
      { etat: "ESSAI", finEssai: VENTE, joursRestants: 3 } as const,
      { etat: "PREMIUM", jusquAu: null } as const,
    ]) {
      expect(fonctionDisponible(plan, "FIDELITE")).toBe(true);
      expect(fonctionDisponible(plan, "EQUIPE")).toBe(true);
      expect(fonctionDisponible(plan, "COMMISSIONS")).toBe(true);
    }
  });

  it("rien n'est disponible en version gratuite", () => {
    expect(fonctionDisponible(gratuit, "FIDELITE")).toBe(false);
    expect(fonctionDisponible(gratuit, "EQUIPE")).toBe(false);
    expect(fonctionDisponible(gratuit, "COMMISSIONS")).toBe(false);
  });
});

function emp(id: string, role: string, opts: Partial<EmployeeEquipe> = {}): EmployeeEquipe {
  return { id, role, active: true, lastLoginAt: null, createdAt: VENTE, ...opts };
}

describe("equipe", () => {
  it("la gerante ne compte jamais, une employee inactive non plus", () => {
    const equipe = [emp("g", "OWNER"), emp("a", "CASHIER"), emp("b", "STYLIST", { active: false })];
    expect(compterDansLimite(equipe).map((e) => e.id)).toEqual(["a"]);
  });

  it("en gratuit : une employee en plus de la gerante, pas deux", () => {
    expect(peutAjouterEmployee(false, 0)).toBe(true);
    expect(peutAjouterEmployee(false, 1)).toBe(false);
    expect(peutAjouterEmployee(true, 12)).toBe(true);
  });

  it("garde la derniere connectee et suspend les autres, jamais la gerante", () => {
    const equipe = [
      emp("g", "OWNER", { lastLoginAt: plus(VENTE, 9) }),
      emp("a", "CASHIER", { lastLoginAt: plus(VENTE, 1) }),
      emp("b", "STYLIST", { lastLoginAt: plus(VENTE, 5) }),
      emp("c", "MANAGER"),
    ];
    const { garder, suspendre } = repartirEquipe(equipe);
    expect(garder.map((e) => e.id)).toEqual(["b"]);
    expect(suspendre.map((e) => e.id)).toEqual(["a", "c"]);
  });

  it("aucune connexion : garde la plus recemment creee", () => {
    const { garder } = repartirEquipe([
      emp("a", "CASHIER", { createdAt: plus(VENTE, 1) }),
      emp("b", "CASHIER", { createdAt: plus(VENTE, 2) }),
    ]);
    expect(garder.map((e) => e.id)).toEqual(["b"]);
  });

  it("deja dans la limite : personne n'est suspendu", () => {
    expect(repartirEquipe([emp("g", "OWNER"), emp("a", "CASHIER")]).suspendre).toEqual([]);
  });
});

describe("decalagePauseMs — les mois de pause ne font pas expirer les points", () => {
  it("pause de 3 mois puis retour : un portefeuille qui aurait expire ne l'est pas", () => {
    const debutPause = new Date("2026-01-01T00:00:00Z");
    const retour = new Date("2026-04-01T00:00:00Z");
    const derniereActivite = new Date("2025-08-01T00:00:00Z");
    const expirationMois = 6;

    const decale = new Date(derniereActivite.getTime() + decalagePauseMs(debutPause, retour));
    const seuil = new Date(retour);
    seuil.setUTCMonth(seuil.getUTCMonth() - expirationMois);

    // Sans decalage, 8 mois d'inactivite : le portefeuille expirerait.
    expect(derniereActivite < seuil).toBe(true);
    // Avec decalage, il ne reste que les 5 mois d'inactivite reelle.
    expect(decale < seuil).toBe(false);
  });

  it("pas de pause connue : aucun decalage", () => {
    expect(decalagePauseMs(null, VENTE)).toBe(0);
  });

  it("Premium prolonge avant son echeance : aucun decalage", () => {
    expect(decalagePauseMs(plus(VENTE, 5), VENTE)).toBe(0);
  });
});

describe("lignesPerteFinEssai", () => {
  it("annonce les vrais chiffres", () => {
    expect(
      lignesPerteFinEssai({
        clientesAvecPoints: 23,
        totalPoints: 1450,
        employeesHorsOwner: 3,
        commissionsNonReglees: "120.500",
      }),
    ).toEqual([
      "23 clientes ne pourront plus utiliser leurs 1 450 points",
      "2 de vos 3 employées perdront leur accès",
      "vos commissions seront verrouillées (120,500 DT non réglés)",
    ]);
  });

  it("n'affiche que les lignes non nulles", () => {
    expect(
      lignesPerteFinEssai({
        clientesAvecPoints: 0,
        totalPoints: 0,
        employeesHorsOwner: 1,
        commissionsNonReglees: "0.000",
      }),
    ).toEqual([]);
  });
});

describe("textes du bandeau", () => {
  it("joint une liste a la francaise", () => {
    expect(joindreFr([])).toBe("");
    expect(joindreFr(["a"])).toBe("a");
    expect(joindreFr(["a", "b"])).toBe("a et b");
    expect(joindreFr(["a", "b", "c"])).toBe("a, b et c");
  });

  it("date courte a l'heure de Tunis, meme tard le soir en UTC", () => {
    // 23h30 UTC le 14/11 = 00h30 le 15/11 a Tunis (UTC+1).
    expect(dateCourteFr(new Date("2026-11-14T23:30:00Z"))).toBe("15/11");
  });
});

describe("activation par l'administration", () => {
  it("un mois apres le 31 janvier : dernier jour de fevrier, pas le 3 mars", () => {
    expect(ajouterMois(new Date("2027-01-31T10:00:00Z"), 1)).toEqual(new Date("2027-02-28T10:00:00Z"));
    expect(ajouterMois(new Date("2028-01-31T10:00:00Z"), 1)).toEqual(new Date("2028-02-29T10:00:00Z"));
  });

  it("douze mois : meme jour l'annee suivante", () => {
    expect(ajouterMois(new Date("2026-10-12T08:00:00Z"), 12)).toEqual(new Date("2027-10-12T08:00:00Z"));
  });

  it("echeance future : on prolonge a partir d'elle", () => {
    const maintenant = new Date("2026-10-12T00:00:00Z");
    const echeance = new Date("2026-10-20T00:00:00Z");
    expect(nouvelleEcheancePremium(echeance, maintenant, 3)).toEqual(new Date("2027-01-20T00:00:00Z"));
  });

  it("echeance passee ou absente : on part d'aujourd'hui", () => {
    const maintenant = new Date("2026-10-12T00:00:00Z");
    expect(nouvelleEcheancePremium(new Date("2026-09-01T00:00:00Z"), maintenant, 1)).toEqual(
      new Date("2026-11-12T00:00:00Z"),
    );
    expect(nouvelleEcheancePremium(null, maintenant, 1)).toEqual(new Date("2026-11-12T00:00:00Z"));
  });
});
