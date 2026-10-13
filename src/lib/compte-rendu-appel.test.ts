import { describe, it, expect } from "vitest";
import {
  RESULTATS_APPEL,
  LIBELLE_RESULTAT,
  CONTENU_MIN,
  CONTENU_MAX,
  estResultatAppel,
  validerCompteRendu,
  estErreur,
  rappelEstDu,
  faitAujourdhui,
} from "./compte-rendu-appel";

const MAINTENANT = new Date("2026-10-13T14:00:00.000Z");
const heures = (n: number) => new Date(MAINTENANT.getTime() + n * 3_600_000);
const jours = (n: number) => new Date(MAINTENANT.getTime() + n * 86_400_000);

describe("estResultatAppel", () => {
  it("accepte les quatre issues", () => {
    for (const r of Object.values(RESULTATS_APPEL)) {
      expect(estResultatAppel(r)).toBe(true);
    }
  });

  it("refuse tout le reste", () => {
    expect(estResultatAppel("OCCUPE")).toBe(false);
    expect(estResultatAppel("")).toBe(false);
    expect(estResultatAppel(null)).toBe(false);
    expect(estResultatAppel(42)).toBe(false);
  });

  // Un objet JS herite de `toString`, `constructor`... Sans `hasOwnProperty`,
  // `estResultatAppel("toString")` renverrait vrai et laisserait passer une
  // valeur impossible jusqu'en base.
  it("ne se laisse pas abuser par les proprietes heritees", () => {
    expect(estResultatAppel("toString")).toBe(false);
    expect(estResultatAppel("constructor")).toBe(false);
    expect(estResultatAppel("__proto__")).toBe(false);
  });

  it("chaque issue a un libelle lisible", () => {
    for (const r of Object.values(RESULTATS_APPEL)) {
      expect(LIBELLE_RESULTAT[r]).toBeTruthy();
    }
  });
});

describe("validerCompteRendu — le contenu", () => {
  it("refuse une note trop courte", () => {
    const r = validerCompteRendu({ contenu: "ok" }, MAINTENANT);
    expect(estErreur(r) && r.erreur).toBe("Note trop courte");
  });

  it("refuse une note vide ou faite d'espaces", () => {
    expect(estErreur(validerCompteRendu({ contenu: "   " }, MAINTENANT))).toBe(true);
    expect(estErreur(validerCompteRendu({}, MAINTENANT))).toBe(true);
    expect(estErreur(validerCompteRendu({ contenu: 42 }, MAINTENANT))).toBe(true);
  });

  it("accepte une note au minimum requis", () => {
    const r = validerCompteRendu({ contenu: "a".repeat(CONTENU_MIN) }, MAINTENANT);
    expect(estErreur(r)).toBe(false);
  });

  it("tronque une note trop longue au lieu de la refuser", () => {
    const r = validerCompteRendu({ contenu: "a".repeat(CONTENU_MAX + 500) }, MAINTENANT);
    expect(estErreur(r)).toBe(false);
    if (!estErreur(r)) expect(r.contenu.length).toBe(CONTENU_MAX);
  });

  it("retire les espaces autour", () => {
    const r = validerCompteRendu({ contenu: "  rappelé  " }, MAINTENANT);
    if (!estErreur(r)) expect(r.contenu).toBe("rappelé");
  });
});

describe("validerCompteRendu — le resultat", () => {
  // Les notes ecrites avant ce lot n'ont pas de resultat : ce n'est pas une
  // anomalie, et l'absence doit rester permise.
  it("accepte une note SANS resultat", () => {
    const r = validerCompteRendu({ contenu: "note libre" }, MAINTENANT);
    expect(estErreur(r)).toBe(false);
    if (!estErreur(r)) expect(r.resultat).toBeNull();
  });

  it("traite la chaine vide comme une absence", () => {
    const r = validerCompteRendu({ contenu: "note", resultat: "" }, MAINTENANT);
    if (!estErreur(r)) expect(r.resultat).toBeNull();
  });

  it("refuse un resultat inconnu", () => {
    const r = validerCompteRendu({ contenu: "note", resultat: "OCCUPE" }, MAINTENANT);
    expect(estErreur(r) && r.erreur).toBe("Résultat d'appel inconnu");
  });

  it("accepte un resultat valide", () => {
    const r = validerCompteRendu({ contenu: "note", resultat: "JOINT" }, MAINTENANT);
    if (!estErreur(r)) expect(r.resultat).toBe("JOINT");
  });
});

describe("validerCompteRendu — la date de rappel", () => {
  // La regle qui donne son sens au champ : sans date, le salon ne ressort
  // dans aucune liste et n'est jamais rappele.
  it("refuse « À rappeler » sans date", () => {
    const r = validerCompteRendu({ contenu: "note", resultat: "A_RAPPELER" }, MAINTENANT);
    expect(estErreur(r) && r.erreur).toBe("Indiquez quand rappeler ce salon");
  });

  it("accepte « À rappeler » avec une date", () => {
    const r = validerCompteRendu(
      { contenu: "note", resultat: "A_RAPPELER", rappelLe: jours(2).toISOString() },
      MAINTENANT,
    );
    expect(estErreur(r)).toBe(false);
  });

  // L'inverse est legitime : « il m'a demande de le reprendre lundi ».
  it("accepte une date sur un appel « Joint »", () => {
    const r = validerCompteRendu(
      { contenu: "note", resultat: "JOINT", rappelLe: jours(5).toISOString() },
      MAINTENANT,
    );
    expect(estErreur(r)).toBe(false);
  });

  it("refuse une date passee — faute de frappe sur l'annee", () => {
    const r = validerCompteRendu(
      { contenu: "note", rappelLe: jours(-1).toISOString() },
      MAINTENANT,
    );
    expect(estErreur(r) && r.erreur).toBe("La date de rappel est déjà passée");
  });

  it("refuse une date illisible", () => {
    expect(
      estErreur(validerCompteRendu({ contenu: "note", rappelLe: "lundi" }, MAINTENANT)),
    ).toBe(true);
    expect(
      estErreur(validerCompteRendu({ contenu: "note", rappelLe: 42 }, MAINTENANT)),
    ).toBe(true);
  });

  it("accepte un objet Date directement", () => {
    const r = validerCompteRendu({ contenu: "note", rappelLe: jours(1) }, MAINTENANT);
    expect(estErreur(r)).toBe(false);
  });
});

describe("validerCompteRendu — blocage leve", () => {
  it("vaut faux par defaut", () => {
    const r = validerCompteRendu({ contenu: "note" }, MAINTENANT);
    if (!estErreur(r)) expect(r.blocageLeve).toBe(false);
  });

  it("n'est vrai que sur un booleen vrai, jamais sur une chaine", () => {
    const vrai = validerCompteRendu({ contenu: "note", blocageLeve: true }, MAINTENANT);
    if (!estErreur(vrai)) expect(vrai.blocageLeve).toBe(true);

    const chaine = validerCompteRendu({ contenu: "note", blocageLeve: "oui" }, MAINTENANT);
    if (!estErreur(chaine)) expect(chaine.blocageLeve).toBe(false);
  });
});

describe("rappelEstDu", () => {
  it("un rappel sans date n'est jamais du", () => {
    expect(rappelEstDu(null, MAINTENANT)).toBe(false);
  });

  it("un rappel en retard est du", () => {
    expect(rappelEstDu(jours(-3), MAINTENANT)).toBe(true);
  });

  it("un rappel pour demain ne l'est pas", () => {
    expect(rappelEstDu(jours(1), MAINTENANT)).toBe(false);
  });

  // La regle qui evite un bug subtil : un rappel pose « pour le 13 » a 9h
  // doit rester visible a 14h, pas disparaitre parce que l'heure est passee.
  it("un rappel du jour reste du toute la journee", () => {
    expect(rappelEstDu(heures(-5), MAINTENANT)).toBe(true);
    expect(rappelEstDu(heures(5), MAINTENANT)).toBe(true);
  });
});

describe("faitAujourdhui", () => {
  it("une note SANS resultat n'est pas un appel passe", () => {
    expect(
      faitAujourdhui({ resultat: null, createdAt: MAINTENANT }, MAINTENANT),
    ).toBe(false);
  });

  it("une note avec resultat, datee du jour, compte", () => {
    expect(
      faitAujourdhui({ resultat: "JOINT", createdAt: heures(-2) }, MAINTENANT),
    ).toBe(true);
  });

  it("une note d'hier ne compte pas", () => {
    expect(
      faitAujourdhui({ resultat: "JOINT", createdAt: jours(-1) }, MAINTENANT),
    ).toBe(false);
  });

  it("couvre le tout debut et la toute fin de journee", () => {
    const debut = new Date(MAINTENANT);
    debut.setHours(0, 0, 0, 0);
    const fin = new Date(MAINTENANT);
    fin.setHours(23, 59, 59, 999);
    expect(faitAujourdhui({ resultat: "JOINT", createdAt: debut }, MAINTENANT)).toBe(true);
    expect(faitAujourdhui({ resultat: "JOINT", createdAt: fin }, MAINTENANT)).toBe(true);
  });
});
