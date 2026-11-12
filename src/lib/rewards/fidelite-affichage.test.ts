import { describe, it, expect } from "vitest";
import {
  RECOMPENSE_MIN_PCT,
  RECOMPENSE_MAX_PCT,
  EXEMPLE_PCT,
  pctDansLesBornes,
  serrerDansLesBornes,
  etatRecompense,
  lireSaisiePct,
  pointsGagnes,
  pointsEnDinars,
  apercuRecompense,
  fractionLisible,
  exempleDeuxVisites,
  cagnotteEnDinars,
  ratiosDepuisPct,
  programToDinarPerPoint,
  DINAR_PAR_POINT_DEFAUT,
} from "./fidelite-affichage";
import { computeEarnedPoints, type SaleForEarn } from "./earn";
import { validateRedemption } from "./redeem";

describe("bornes de la reglette", () => {
  it("accepte les bornes elles-memes", () => {
    expect(pctDansLesBornes(RECOMPENSE_MIN_PCT)).toBe(true);
    expect(pctDansLesBornes(RECOMPENSE_MAX_PCT)).toBe(true);
  });

  // Les bornes sont celles d'un pourcentage : 1 a 100. Le taux est le CHOIX
  // du salon, plus une recommandation imposee.
  it("accepte tout le pourcentage, de 1 a 100", () => {
    expect(RECOMPENSE_MIN_PCT).toBe(1);
    expect(RECOMPENSE_MAX_PCT).toBe(100);
    for (const pct of [1, 3, 10, 15, 50, 100]) expect(pctDansLesBornes(pct)).toBe(true);
  });

  it("refuse sous 1 % et au-dessus de 100 %", () => {
    expect(pctDansLesBornes(0)).toBe(false);
    expect(pctDansLesBornes(0.5)).toBe(false);
    expect(pctDansLesBornes(100.1)).toBe(false);
    expect(pctDansLesBornes(-5)).toBe(false);
  });

  it("refuse une valeur non finie", () => {
    expect(pctDansLesBornes(NaN)).toBe(false);
    expect(pctDansLesBornes(Infinity)).toBe(false);
  });

  it("serre vers la borne la plus proche, au pas de 1", () => {
    expect(serrerDansLesBornes(0)).toBe(1);
    expect(serrerDansLesBornes(0.4)).toBe(1);
    expect(serrerDansLesBornes(250)).toBe(100);
    expect(serrerDansLesBornes(5.4)).toBe(5);
    expect(serrerDansLesBornes(5.6)).toBe(6);
  });

  it("serre une valeur non finie sur le minimum", () => {
    expect(serrerDansLesBornes(NaN)).toBe(1);
  });
});

describe("etatRecompense", () => {
  // Le defaut du schema (1 %) et les salons crees par l'ancien assistant
  // etaient signales « hors limites ». Ils sont desormais dans les bornes.
  it("ne signale plus un salon a 1 %", () => {
    const etat = etatRecompense(1);
    expect(etat.horsBornes).toBe(false);
    expect(etat.curseur).toBe(1);
  });

  it("accepte un taux eleve choisi par le salon", () => {
    expect(etatRecompense(40)).toEqual({ curseur: 40, reel: 40, horsBornes: false });
  });

  it("signale encore une valeur impossible, sans la reecrire", () => {
    const etat = etatRecompense(0.5);
    expect(etat.horsBornes).toBe(true);
    expect(etat.reel).toBe(0.5);
    expect(etat.curseur).toBe(1);
  });
});

describe("pointsGagnes", () => {
  it("applique la meme formule que la caisse", () => {
    expect(pointsGagnes(100, 10)).toBe(1000);
    expect(pointsGagnes(150, 10)).toBe(1500);
    expect(pointsGagnes(100, 3)).toBe(300);
  });

  it("arrondit vers le BAS, comme computeEarnedPoints", () => {
    // 10,5 DT a 3 pts/DT = 31,5 -> 31, pas 32.
    expect(pointsGagnes(10.5, 3)).toBe(31);
  });

  it("rend 0 sur une entree vide ou absurde", () => {
    expect(pointsGagnes(0, 10)).toBe(0);
    expect(pointsGagnes(-50, 10)).toBe(0);
    expect(pointsGagnes(100, 0)).toBe(0);
    expect(pointsGagnes(NaN, 10)).toBe(0);
  });

  // Le garde-fou qui compte : si earn.ts change de formule, ce test tombe.
  it("concorde avec computeEarnedPoints sur les memes entrees", () => {
    const montants = [40, 100, 150, 10.5, 33.333];
    for (const pct of [3, 5, 10]) {
      for (const montant of montants) {
        const vente: SaleForEarn = {
          id: "s",
          customerId: "c",
          subtotal: montant.toFixed(3),
          discountAmount: "0.000",
          total: montant.toFixed(3),
          items: [{ kind: "SERVICE", lineTotal: montant.toFixed(3) }],
          payments: [],
        };
        const attendu = computeEarnedPoints(vente, {
          active: true,
          eligibleOn: "BOTH",
          pointsPerDinar: String(pct),
        });
        expect(pointsGagnes(montant, pct)).toBe(attendu);
      }
    }
  });
});

describe("pointsEnDinars", () => {
  // Le coeur du probleme corrige par ce lot : 1 point ne vaut PAS 1 dinar.
  it("convertit 100 points en 1 dinar avec les ratios canoniques", () => {
    expect(pointsEnDinars(100, 0.01)).toBe("1.000");
    expect(pointsEnDinars(1000, 0.01)).toBe("10.000");
    expect(pointsEnDinars(600, 0.01)).toBe("6.000");
  });

  it("rend une chaine a 3 decimales, jamais un nombre", () => {
    expect(pointsEnDinars(1, 0.01)).toBe("0.010");
    expect(pointsEnDinars(0, 0.01)).toBe("0.000");
  });

  it("rend 0 sur une entree non finie", () => {
    expect(pointsEnDinars(NaN, 0.01)).toBe("0.000");
    expect(pointsEnDinars(100, NaN)).toBe("0.000");
  });

  it("cagnotteEnDinars est le meme calcul", () => {
    expect(cagnotteEnDinars(600, 0.01)).toBe(pointsEnDinars(600, 0.01));
  });
});

describe("programToDinarPerPoint", () => {
  it("lit le ratio renvoye par l'API, qui est une chaine", () => {
    expect(programToDinarPerPoint("0.010")).toBe(0.01);
    expect(programToDinarPerPoint("0.100")).toBe(0.1);
  });

  it("accepte un Decimal de Prisma, via toString", () => {
    expect(programToDinarPerPoint({ toString: () => "0.010" })).toBe(0.01);
  });

  // Sans ce garde-fou, toute la page afficherait « 0,000 DT » — y compris la
  // cagnotte de clientes qui ont vraiment des points.
  it("retombe sur le ratio canonique plutot que d'afficher zero partout", () => {
    expect(programToDinarPerPoint("0")).toBe(DINAR_PAR_POINT_DEFAUT);
    expect(programToDinarPerPoint("-0.5")).toBe(DINAR_PAR_POINT_DEFAUT);
    expect(programToDinarPerPoint("n'importe quoi")).toBe(DINAR_PAR_POINT_DEFAUT);
    expect(programToDinarPerPoint(null)).toBe(DINAR_PAR_POINT_DEFAUT);
    expect(programToDinarPerPoint(undefined)).toBe(DINAR_PAR_POINT_DEFAUT);
  });
});

describe("apercuRecompense — l'exemple en direct de la reglette", () => {
  it("rend la valeur attendue a chaque cran de la reglette", () => {
    // A 10 %, 100 DT doivent rendre exactement 10 DT de cagnotte.
    expect(apercuRecompense(10)).toEqual({
      montant: 100,
      points: 1000,
      valeurDT: "10.000",
    });
    expect(apercuRecompense(3)).toEqual({
      montant: 100,
      points: 300,
      valeurDT: "3.000",
    });
    expect(apercuRecompense(7)).toEqual({
      montant: 100,
      points: 700,
      valeurDT: "7.000",
    });
  });

  it("la valeur en dinars egale le pourcentage du montant, a tous les crans", () => {
    for (let pct = RECOMPENSE_MIN_PCT; pct <= RECOMPENSE_MAX_PCT; pct++) {
      const apercu = apercuRecompense(pct, 100);
      expect(Number(apercu.valeurDT)).toBeCloseTo(pct, 3);
    }
  });

  it("accepte un autre montant de reference", () => {
    expect(apercuRecompense(10, 40)).toEqual({
      montant: 40,
      points: 400,
      valeurDT: "4.000",
    });
  });

  it("ratiosDepuisPct garde dinarPerPoint canonique", () => {
    expect(ratiosDepuisPct(10)).toEqual({ pointsPerDinar: 10, dinarPerPoint: 0.01 });
  });
});

describe("fractionLisible", () => {
  it("nomme les fractions courantes", () => {
    expect(fractionLisible(50)).toBe("½");
    expect(fractionLisible(25)).toBe("¼");
    expect(fractionLisible(75)).toBe("¾");
    expect(fractionLisible(100)).toBe("tout");
  });

  it("retombe sur le pourcentage quand la fraction n'a pas de nom courant", () => {
    expect(fractionLisible(35)).toBe("35 %");
    expect(fractionLisible(0)).toBe("0 %");
  });

  it("ne casse pas sur une valeur non finie", () => {
    expect(fractionLisible(NaN)).toBe("—");
  });
});

describe("exempleDeuxVisites", () => {
  const reglagesCourants = { minPointsToRedeem: 100, maxRedemptionPctPerSale: 50 };

  it("se joue avec les reglages par defaut du schema", () => {
    const ex = exempleDeuxVisites(reglagesCourants);
    // 150 DT a 10 % = 1500 points = 15 DT. Mais le plafond de 50 % sur une
    // prestation de 40 DT ne laisse que 20 DT : 15 DT passe.
    expect(ex.visite1.pointsGagnes).toBe(1500);
    expect(ex.visite2.reductionDT).toBe("15.000");
    expect(ex.visite2.payeDT).toBe("25.000");
    expect(ex.economieDT).toBe("15.000");
    expect(ex.impossible).toBeNull();
  });

  it("la reduction annoncee passe validateRedemption pour de vrai", () => {
    const ex = exempleDeuxVisites(reglagesCourants);
    expect(() =>
      validateRedemption({
        walletBalance: ex.visite1.pointsGagnes,
        pointsToRedeem: ex.visite2.pointsUtilises,
        saleTotal: ex.visite2.montant.toFixed(3),
        program: {
          active: true,
          minPointsToRedeem: reglagesCourants.minPointsToRedeem,
          maxRedemptionPctPerSale: reglagesCourants.maxRedemptionPctPerSale,
          dinarPerPoint: "0.010",
        },
      }),
    ).not.toThrow();
  });

  it("explique quand le minimum du salon rend l'exemple injouable", () => {
    const ex = exempleDeuxVisites({
      minPointsToRedeem: 5000,
      maxRedemptionPctPerSale: 50,
    });
    expect(ex.impossible).toContain("5000");
    expect(ex.impossible).toContain("minimum");
  });

  it("explique quand le plafond du salon mord sur la reduction", () => {
    const ex = exempleDeuxVisites({
      minPointsToRedeem: 100,
      maxRedemptionPctPerSale: 10,
    });
    expect(ex.impossible).toContain("10 %");
    // La reduction affichee reste celle que le salon accorderait vraiment :
    // 10 % de 40 DT = 4 DT, pas les 15 DT de la cagnotte.
    expect(ex.visite2.reductionDT).toBe("4.000");
    expect(ex.visite2.payeDT).toBe("36.000");
  });

  it("la visite 1 ne consomme aucun point", () => {
    const ex = exempleDeuxVisites(reglagesCourants);
    expect(ex.visite1.pointsUtilises).toBe(0);
    expect(ex.visite1.reductionDT).toBe("0.000");
  });

  it("les points regagnes en visite 2 ne portent pas sur la part payee en points", () => {
    const ex = exempleDeuxVisites(reglagesCourants);
    // 40 DT - 15 DT de points = 25 DT eligibles, a 10 % = 250 points.
    expect(ex.visite2.pointsGagnes).toBe(250);
  });

  it("accepte des montants personnalises", () => {
    const ex = exempleDeuxVisites({
      ...reglagesCourants,
      montantVisite1: 200,
      montantVisite2: 100,
    });
    expect(ex.visite1.pointsGagnes).toBe(2000);
    expect(ex.visite2.reductionDT).toBe("20.000");
  });

  it("EXEMPLE_PCT reste dans les bornes de la reglette", () => {
    expect(pctDansLesBornes(EXEMPLE_PCT)).toBe(true);
  });
});

describe("lireSaisiePct — le champ de saisie exacte", () => {
  // Une reglette de 100 crans ne permet plus de viser 5 % plutot que 6 % au
  // doigt : le champ chiffre la complete.
  it("lit un entier dans les bornes", () => {
    expect(lireSaisiePct("5")).toBe(5);
    expect(lireSaisiePct("100")).toBe(100);
    expect(lireSaisiePct(" 12 ")).toBe(12);
  });

  it("ramene une saisie hors bornes a la borne la plus proche", () => {
    expect(lireSaisiePct("0")).toBe(1);
    expect(lireSaisiePct("250")).toBe(100);
    expect(lireSaisiePct("-3")).toBe(1);
  });

  it("arrondit au pas d'un point", () => {
    expect(lireSaisiePct("7.6")).toBe(8);
    expect(lireSaisiePct("7,4")).toBe(7);
  });

  // Un champ vide pendant la frappe ne doit pas etre pris pour « 1 % ».
  it("rend null pour une saisie vide ou illisible", () => {
    expect(lireSaisiePct("")).toBeNull();
    expect(lireSaisiePct("   ")).toBeNull();
    expect(lireSaisiePct("abc")).toBeNull();
  });
});
