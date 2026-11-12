import { describe, it, expect } from "vitest";
import {
  debutRendezVous,
  finRendezVous,
  filtreFenetreRendezVous,
  DUREE_PAR_DEFAUT_MINUTES,
  type RendezVousDate,
} from "./date-rendez-vous";

const SALON = "salon-1";
const AUJOURDHUI = new Date("2026-11-12T10:00:00");
const JEUDI_15H = new Date("2026-11-19T15:00:00");
const JEUDI_16H = new Date("2026-11-19T16:00:00");

/* ------------------------------------------------------------------ *
 *  Un mini-interprete des SEULS operateurs du filtre : `some`, `none`,
 *  `gte`/`lt`, egalite a `null`. Il permet de verifier ce que le filtre
 *  RETIENT, pas seulement a quoi il ressemble.
 * ------------------------------------------------------------------ */

type Rdv = {
  providerDuSalarie: string | null;
  items: Array<{ providerId: string; startTime: Date }>;
  debutPrevu: Date | null;
  createdAt: Date;
};

function dans(d: Date | null, f: { gte: Date; lt: Date }) {
  return d !== null && d >= f.gte && d < f.lt;
}

type Fenetre = { gte: Date; lt: Date };
/** Les trois formes de branche que produit le filtre, typees a plat. */
type Branche = {
  items?: { some?: { offer: { providerId: string }; slot: { startTime: Fenetre } }; none?: object };
  assignedEmployee?: { providerId: string };
  debutPrevu?: Fenetre | null;
  createdAt?: Fenetre;
};

function retenu(r: Rdv, from: Date, to: Date): boolean {
  const branches = filtreFenetreRendezVous(SALON, from, to).OR as Branche[];
  return branches.some((b) => {
    const s = b.items?.some;
    if (s) {
      return r.items.some(
        (i) => i.providerId === s.offer.providerId && dans(i.startTime, s.slot.startTime),
      );
    }
    if (r.providerDuSalarie !== b.assignedEmployee?.providerId) return false;
    if (r.items.length !== 0) return false; // items: { none: {} }
    if (b.createdAt) return r.debutPrevu === null && dans(r.createdAt, b.createdAt);
    return b.debutPrevu ? dans(r.debutPrevu, b.debutPrevu) : false;
  });
}

/** Les jours de la semaine ou le rendez-vous apparait. */
function joursAffiches(r: Rdv): string[] {
  const sortie: string[] = [];
  for (let i = 0; i < 14; i++) {
    const debut = new Date(2026, 10, 10 + i);
    const fin = new Date(2026, 10, 11 + i);
    if (retenu(r, debut, fin)) sortie.push(debut.toDateString());
  }
  return sortie;
}

describe("filtreFenetreRendezVous — un rendez-vous n'apparait qu'un seul jour", () => {
  // LE BUG SIGNALE : pris aujourd'hui pour jeudi, il apparaissait aujourd'hui
  // ET jeudi.
  it("rendez-vous avec service pris aujourd'hui pour jeudi : jeudi SEULEMENT", () => {
    const r: Rdv = {
      providerDuSalarie: SALON,
      items: [{ providerId: SALON, startTime: JEUDI_15H }],
      debutPrevu: null,
      createdAt: AUJOURDHUI,
    };
    expect(joursAffiches(r)).toEqual([JEUDI_15H.toDateString()]);
  });

  // Le second defaut : l'heure prevue d'un passage libre n'etait jamais
  // enregistree, il apparaissait le jour de sa creation et jamais le sien.
  it("passage libre prevu jeudi : jeudi SEULEMENT, pas aujourd'hui", () => {
    const r: Rdv = {
      providerDuSalarie: SALON,
      items: [],
      debutPrevu: JEUDI_15H,
      createdAt: AUJOURDHUI,
    };
    expect(joursAffiches(r)).toEqual([JEUDI_15H.toDateString()]);
  });

  // Les passages libres d'AVANT le correctif n'ont pas d'heure prevue : la
  // date de creation reste leur seule information, on la garde.
  it("ancien passage libre sans heure prevue : son jour de creation", () => {
    const r: Rdv = {
      providerDuSalarie: SALON,
      items: [],
      debutPrevu: null,
      createdAt: AUJOURDHUI,
    };
    expect(joursAffiches(r)).toEqual([AUJOURDHUI.toDateString()]);
  });

  it("la date de creation ne retient JAMAIS un rendez-vous qui a un creneau", () => {
    const r: Rdv = {
      providerDuSalarie: SALON,
      items: [{ providerId: SALON, startTime: JEUDI_15H }],
      debutPrevu: null,
      createdAt: AUJOURDHUI,
    };
    expect(retenu(r, new Date(2026, 10, 12), new Date(2026, 10, 13))).toBe(false);
  });

  // `to` est exclusif : a 00:00 pile, le rendez-vous est du jour qui commence.
  it("un rendez-vous a minuit pile n'apparait que le jour qui commence", () => {
    const minuit = new Date(2026, 10, 20, 0, 0, 0);
    const r: Rdv = {
      providerDuSalarie: SALON,
      items: [{ providerId: SALON, startTime: minuit }],
      debutPrevu: null,
      createdAt: AUJOURDHUI,
    };
    expect(joursAffiches(r)).toEqual([minuit.toDateString()]);
  });

  it("ignore les rendez-vous d'un autre salon", () => {
    const r: Rdv = {
      providerDuSalarie: "autre",
      items: [{ providerId: "autre", startTime: JEUDI_15H }],
      debutPrevu: null,
      createdAt: AUJOURDHUI,
    };
    expect(joursAffiches(r)).toEqual([]);
  });

  it("borne la fenetre en exclusif, jamais en inclusif", () => {
    const where = filtreFenetreRendezVous(SALON, new Date(0), new Date(1));
    const texte = JSON.stringify(where);
    expect(texte).not.toContain('"lte"');
    expect(texte).toContain('"lt"');
  });
});

describe("debutRendezVous / finRendezVous", () => {
  const avecCreneau = (debut: Date, fin: Date): RendezVousDate => ({
    items: [{ slot: { startTime: debut, endTime: fin } }],
    debutPrevu: null,
    finPrevue: null,
    createdAt: AUJOURDHUI,
  });

  it("place un rendez-vous a son creneau, jamais a sa creation", () => {
    const r = avecCreneau(JEUDI_15H, JEUDI_16H);
    expect(debutRendezVous(r)).toEqual(JEUDI_15H);
    expect(finRendezVous(r)).toEqual(JEUDI_16H);
  });

  // L'ordre des lignes en base n'est pas garanti.
  it("prend le PREMIER creneau dans le temps, pas le premier de la liste", () => {
    const r: RendezVousDate = {
      items: [
        { slot: { startTime: JEUDI_16H, endTime: new Date("2026-11-19T17:00:00") } },
        { slot: { startTime: JEUDI_15H, endTime: JEUDI_16H } },
      ],
      createdAt: AUJOURDHUI,
    };
    expect(debutRendezVous(r)).toEqual(JEUDI_15H);
    expect(finRendezVous(r)).toEqual(new Date("2026-11-19T17:00:00"));
  });

  it("place un passage libre a son heure prevue", () => {
    const r: RendezVousDate = {
      items: [],
      debutPrevu: JEUDI_15H,
      finPrevue: JEUDI_16H,
      createdAt: AUJOURDHUI,
    };
    expect(debutRendezVous(r)).toEqual(JEUDI_15H);
    expect(finRendezVous(r)).toEqual(JEUDI_16H);
  });

  it("retombe sur la creation pour un ancien passage libre", () => {
    const r: RendezVousDate = { items: [], createdAt: AUJOURDHUI };
    expect(debutRendezVous(r)).toEqual(AUJOURDHUI);
    expect(finRendezVous(r).getTime() - AUJOURDHUI.getTime()).toBe(
      DUREE_PAR_DEFAUT_MINUTES * 60_000,
    );
  });

  it("accepte des chaines ISO, comme les renvoie l'API", () => {
    const r: RendezVousDate = {
      items: [{ slot: { startTime: JEUDI_15H.toISOString(), endTime: null } }],
      createdAt: AUJOURDHUI.toISOString(),
    };
    expect(debutRendezVous(r)).toEqual(JEUDI_15H);
  });
});
