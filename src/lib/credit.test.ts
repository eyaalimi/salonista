import { describe, expect, it } from "vitest";
import {
  JOURS_AVANT_RETARD,
  ancienneteJours,
  calculerCredit,
  correspondRecherche,
  echeancesProposees,
  estEnRetard,
  filtrerCredits,
  formatDateCourte,
  formatJourMois,
  grouperCreditsParCliente,
  jourTunis,
  lireEcheance,
  lireMotifEffacement,
  repartirVersement,
  totauxCredits,
  type VenteACredit,
} from "./credit";

describe("calculerCredit", () => {
  it("85 DT, 20 payés → 65 dus", () => {
    expect(calculerCredit({ total: "85.000", payeAujourdhui: "20.000" })).toEqual({
      ok: true,
      amountDue: "65.000",
      status: "CREDIT",
    });
  });

  it("rien payé aujourd'hui → tout est dû", () => {
    expect(calculerCredit({ total: "85.000", payeAujourdhui: "0" })).toMatchObject({
      ok: true,
      amountDue: "85.000",
    });
  });

  it("calcule au millime, sans dérive flottante", () => {
    expect(calculerCredit({ total: "0.300", payeAujourdhui: "0.100" })).toMatchObject({
      amountDue: "0.200",
    });
    expect(calculerCredit({ total: "33.333", payeAujourdhui: "11.111" })).toMatchObject({
      amountDue: "22.222",
    });
  });

  it("refuse de tout payer : c'est une vente normale", () => {
    const r = calculerCredit({ total: "85.000", payeAujourdhui: "85.000" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreur).toMatch(/pas un crédit/);
    expect(calculerCredit({ total: "85.000", payeAujourdhui: "90" }).ok).toBe(false);
  });

  it("refuse un montant négatif", () => {
    const r = calculerCredit({ total: "85.000", payeAujourdhui: "-1" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreur).toMatch(/négatif/);
  });

  it("refuse un total nul", () => {
    expect(calculerCredit({ total: "0", payeAujourdhui: "0" }).ok).toBe(false);
  });
});

describe("repartirVersement", () => {
  const credits = [
    { saleId: "b", createdAt: new Date("2026-11-05T10:00:00Z"), amountDue: "40.000" },
    { saleId: "a", createdAt: new Date("2026-10-28T10:00:00Z"), amountDue: "30.000" },
    { saleId: "c", createdAt: new Date("2026-11-10T10:00:00Z"), amountDue: "25.000" },
  ];

  it("règle la plus ancienne d'abord", () => {
    const r = repartirVersement({ montant: "50.000", credits });
    expect(r).toEqual({
      ok: true,
      imputations: [
        { saleId: "a", montantImpute: "30.000", resteApres: "0.000", soldee: true },
        { saleId: "b", montantImpute: "20.000", resteApres: "20.000", soldee: false },
      ],
    });
  });

  it("versement partiel sur une seule vente", () => {
    const r = repartirVersement({ montant: "10.500", credits });
    expect(r).toEqual({
      ok: true,
      imputations: [{ saleId: "a", montantImpute: "10.500", resteApres: "19.500", soldee: false }],
    });
  });

  it("versement exact : les trois ventes soldées", () => {
    const r = repartirVersement({ montant: "95.000", credits });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.imputations.map((i) => i.saleId)).toEqual(["a", "b", "c"]);
      expect(r.imputations.every((i) => i.soldee)).toBe(true);
    }
  });

  it("30 puis 35 sur un crédit de 65 : retombe exactement à zéro", () => {
    const un = [{ saleId: "x", createdAt: new Date(), amountDue: "65.000" }];
    const r1 = repartirVersement({ montant: "30.000", credits: un });
    expect(r1.ok && r1.imputations[0].resteApres).toBe("35.000");
    const r2 = repartirVersement({
      montant: "35.000",
      credits: [{ ...un[0], amountDue: "35.000" }],
    });
    expect(r2.ok && r2.imputations[0]).toMatchObject({ resteApres: "0.000", soldee: true });
  });

  it("refuse un versement supérieur au total dû", () => {
    const r = repartirVersement({ montant: "95.001", credits });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreur).toMatch(/dépasse/);
  });

  it("refuse 0 et un montant négatif", () => {
    expect(repartirVersement({ montant: "0", credits }).ok).toBe(false);
    expect(repartirVersement({ montant: "-5", credits }).ok).toBe(false);
  });

  it("ignore les ventes déjà soldées, refuse s'il n'y a plus rien à régler", () => {
    const r = repartirVersement({
      montant: "5",
      credits: [{ saleId: "z", createdAt: new Date(), amountDue: "0" }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreur).toMatch(/aucun crédit/);
  });

  it("ordre stable à date égale", () => {
    const meme = new Date("2026-11-01T10:00:00Z");
    const r = repartirVersement({
      montant: "1",
      credits: [
        { saleId: "z", createdAt: meme, amountDue: "1" },
        { saleId: "m", createdAt: meme, amountDue: "1" },
      ],
    });
    expect(r.ok && r.imputations[0].saleId).toBe("m");
  });
});

describe("dates de calendrier à Tunis", () => {
  it("une vente à 23h30 heure de Tunis reste du jour même", () => {
    // 23h30 à Tunis (UTC+1) = 22h30 UTC
    expect(jourTunis(new Date("2026-10-28T22:30:00Z"))).toBe("2026-10-28");
    expect(jourTunis(new Date("2026-10-28T23:30:00Z"))).toBe("2026-10-29");
  });

  it("ancienneté en jours de calendrier, 0 le jour même", () => {
    const vente = new Date("2026-10-28T09:00:00Z");
    expect(ancienneteJours(vente, new Date("2026-10-28T20:00:00Z"))).toBe(0);
    expect(ancienneteJours(vente, new Date("2026-10-29T07:00:00Z"))).toBe(1);
    expect(ancienneteJours(vente, new Date("2026-11-12T10:00:00Z"))).toBe(15);
  });

  it("formats jj/mm et jj/mm/aaaa", () => {
    const d = new Date("2026-11-19T12:00:00Z");
    expect(formatJourMois(d)).toBe("19/11");
    expect(formatDateCourte(d)).toBe("19/11/2026");
  });
});

describe("estEnRetard", () => {
  const vente = new Date("2026-10-28T10:00:00Z");

  it(`sans date promise : en retard après ${JOURS_AVANT_RETARD} jours, pas avant`, () => {
    expect(estEnRetard({ createdAt: vente, dueDate: null, maintenant: new Date("2026-11-12T10:00:00Z") })).toBe(false);
    expect(estEnRetard({ createdAt: vente, dueDate: null, maintenant: new Date("2026-11-13T10:00:00Z") })).toBe(true);
  });

  it("avec date promise : payer le jour promis n'est pas un retard", () => {
    const due = new Date("2026-11-19T12:00:00Z");
    expect(estEnRetard({ createdAt: vente, dueDate: due, maintenant: new Date("2026-11-19T21:00:00Z") })).toBe(false);
    expect(estEnRetard({ createdAt: vente, dueDate: due, maintenant: new Date("2026-11-20T08:00:00Z") })).toBe(true);
  });

  it("la date promise l'emporte sur les 15 jours", () => {
    const due = new Date("2026-12-31T12:00:00Z");
    expect(estEnRetard({ createdAt: vente, dueDate: due, maintenant: new Date("2026-12-01T10:00:00Z") })).toBe(false);
  });
});

describe("echeancesProposees", () => {
  it("un jeudi : samedi dans 2 jours, une semaine, fin du mois", () => {
    // 12/11/2026 est un jeudi
    expect(echeancesProposees(new Date("2026-11-12T10:00:00Z"))).toEqual({
      samedi: "2026-11-14",
      uneSemaine: "2026-11-19",
      finDuMois: "2026-11-30",
    });
  });

  it("un samedi : le samedi suivant, pas aujourd'hui", () => {
    expect(echeancesProposees(new Date("2026-11-14T10:00:00Z")).samedi).toBe("2026-11-21");
  });

  it("le dernier jour du mois : fin du mois suivant", () => {
    expect(echeancesProposees(new Date("2026-11-30T10:00:00Z")).finDuMois).toBe("2026-12-31");
    expect(echeancesProposees(new Date("2026-12-31T10:00:00Z")).finDuMois).toBe("2027-01-31");
  });
});

describe("lireEcheance", () => {
  const maintenant = new Date("2026-11-12T10:00:00Z");

  it("« Sans date » est accepté", () => {
    expect(lireEcheance(null, maintenant)).toEqual({ ok: true, dueDate: null });
    expect(lireEcheance(undefined, maintenant)).toEqual({ ok: true, dueDate: null });
  });

  it("un jour AAAA-MM-JJ devient midi UTC de ce jour", () => {
    const r = lireEcheance("2026-11-19", maintenant);
    expect(r.ok && r.dueDate?.toISOString()).toBe("2026-11-19T12:00:00.000Z");
  });

  it("aujourd'hui est accepté, hier refusé", () => {
    expect(lireEcheance("2026-11-12", maintenant).ok).toBe(true);
    expect(lireEcheance("2026-11-11", maintenant).ok).toBe(false);
  });

  it("refuse une date invalide ou à plus d'un an", () => {
    expect(lireEcheance("pas une date", maintenant).ok).toBe(false);
    expect(lireEcheance("2028-01-01", maintenant).ok).toBe(false);
  });
});

describe("lireMotifEffacement", () => {
  it("exige au moins 5 caractères utiles", () => {
    expect(lireMotifEffacement("   abc  ").ok).toBe(false);
    expect(lireMotifEffacement(undefined).ok).toBe(false);
    expect(lireMotifEffacement("  partie   à l'étranger ")).toEqual({ ok: true, motif: "partie à l'étranger" });
  });
});

describe("grouperCreditsParCliente / filtres / totaux", () => {
  const maintenant = new Date("2026-11-12T10:00:00Z");
  const vente = (o: Partial<VenteACredit> & Pick<VenteACredit, "id" | "customerId" | "createdAt" | "amountDue">): VenteACredit => ({
    receiptNumber: o.id.toUpperCase(),
    total: "100.000",
    dueDate: null,
    resume: "Brushing",
    ...o,
  });
  const ventes: VenteACredit[] = [
    vente({ id: "a1", customerId: "amira", createdAt: new Date("2026-10-20T10:00:00Z"), amountDue: "30.000" }),
    vente({ id: "a2", customerId: "amira", createdAt: new Date("2026-11-10T10:00:00Z"), amountDue: "65.000", dueDate: new Date("2026-11-17T12:00:00Z") }),
    vente({ id: "s1", customerId: "sana", createdAt: new Date("2026-11-08T10:00:00Z"), amountDue: "20.000" }),
    vente({ id: "x1", customerId: "sana", createdAt: new Date("2026-11-01T10:00:00Z"), amountDue: "0" }),
  ];

  const groupes = grouperCreditsParCliente(ventes, maintenant);

  it("une ligne par cliente, plus ancien crédit d'abord, ventes soldées ignorées", () => {
    expect(groupes.map((g) => g.customerId)).toEqual(["amira", "sana"]);
    expect(groupes[0].totalDu).toBe("95.000");
    expect(groupes[0].ventes.map((v) => v.id)).toEqual(["a1", "a2"]);
    expect(groupes[1].ventes.map((v) => v.id)).toEqual(["s1"]);
  });

  it("en retard dès qu'une vente l'est", () => {
    expect(groupes[0].enRetard).toBe(true); // a1 : 23 jours sans date
    expect(groupes[1].enRetard).toBe(false);
    expect(groupes[0].dueDateLaPlusProche?.toISOString()).toBe("2026-11-17T12:00:00.000Z");
  });

  it("filtres retard et semaine", () => {
    expect(filtrerCredits(groupes, "retard", maintenant).map((g) => g.customerId)).toEqual(["amira"]);
    expect(filtrerCredits(groupes, "semaine", maintenant).map((g) => g.customerId)).toEqual(["amira"]);
    expect(filtrerCredits(groupes, "toutes", maintenant)).toHaveLength(2);
  });

  it("totaux de tête", () => {
    expect(totauxCredits(groupes)).toEqual({ aRecuperer: "115.000", clientes: 2, enRetard: 1 });
  });
});

describe("correspondRecherche", () => {
  const amira = { firstName: "Amîra", lastName: "Ben Salah", phone: "+21656549547" };
  it("par nom, sans accents ni majuscules, plusieurs mots", () => {
    expect(correspondRecherche(amira, "amira")).toBe(true);
    expect(correspondRecherche(amira, "AMIRA salah")).toBe(true);
    expect(correspondRecherche(amira, "sana")).toBe(false);
  });
  it("par chiffres du téléphone, espaces tolérés", () => {
    expect(correspondRecherche(amira, "56 549")).toBe(true);
    expect(correspondRecherche(amira, "999")).toBe(false);
  });
  it("une fiche passage ne correspond jamais à des chiffres", () => {
    expect(correspondRecherche({ ...amira, phone: "walk-in-56549547" }, "5654")).toBe(false);
  });
  it("requête vide : tout passe", () => {
    expect(correspondRecherche(amira, "  ")).toBe(true);
  });
});
