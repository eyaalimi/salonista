import { describe, it, expect } from "vitest";
import {
  calculerCompteurs,
  salonsARappeler,
  SEUIL_INACTIF_JOURS,
  type SalonPourCompteurs,
} from "./vue-ensemble";

const MAINTENANT = new Date("2026-10-05T12:00:00.000Z");

/** Une date il y a N jours. */
const ilYa = (jours: number) =>
  new Date(MAINTENANT.getTime() - jours * 86_400_000);

function salon(sur: Partial<SalonPourCompteurs> = {}): SalonPourCompteurs {
  return {
    id: Math.random().toString(36).slice(2),
    inscritLe: ilYa(60),
    suspendu: false,
    derniereVenteAt: null,
    derniereConnexionAt: null,
    ...sur,
  };
}

describe("calculerCompteurs", () => {
  it("rend des zeros sur une base vide", () => {
    const c = calculerCompteurs([], MAINTENANT);
    expect(c.total).toBe(0);
    expect(c.actifs7j).toBe(0);
    expect(c.jamaisVendu).toBe(0);
    expect(c.devenusInactifs).toBe(0);
  });

  it("compte le total, suspendus inclus", () => {
    const c = calculerCompteurs(
      [salon(), salon(), salon({ suspendu: true })],
      MAINTENANT,
    );
    expect(c.total).toBe(3);
    expect(c.suspendus).toBe(1);
  });

  it("compte les nouveaux des 7 derniers jours", () => {
    const c = calculerCompteurs(
      [salon({ inscritLe: ilYa(2) }), salon({ inscritLe: ilYa(6) }), salon({ inscritLe: ilYa(9) })],
      MAINTENANT,
    );
    expect(c.nouveauxCetteSemaine).toBe(2);
  });

  it("compte les actifs du jour, a 7 et a 30 jours", () => {
    const c = calculerCompteurs(
      [
        salon({ derniereVenteAt: MAINTENANT }), // aujourd'hui
        salon({ derniereVenteAt: ilYa(3) }), // 7 j
        salon({ derniereVenteAt: ilYa(20) }), // 30 j
        salon({ derniereVenteAt: ilYa(60) }), // ni l'un ni l'autre
      ],
      MAINTENANT,
    );
    expect(c.actifsAujourdhui).toBe(1);
    expect(c.actifs7j).toBe(2);
    expect(c.actifs30j).toBe(3);
  });

  it("compte une connexion sans vente comme une activite", () => {
    // Meme regle que `estActif` : un salon qui ouvre sa caisse pour voir son
    // agenda est vivant.
    const c = calculerCompteurs(
      [salon({ derniereConnexionAt: ilYa(2) })],
      MAINTENANT,
    );
    expect(c.actifs7j).toBe(1);
  });

  it("compte les salons n'ayant jamais encaisse", () => {
    const c = calculerCompteurs(
      [salon({ derniereVenteAt: null }), salon({ derniereVenteAt: ilYa(1) })],
      MAINTENANT,
    );
    expect(c.jamaisVendu).toBe(1);
  });

  /*
   * « Jamais vendu » et « devenu inactif » sont DISJOINTS : ce sont deux
   * problemes differents, et deux conversations differentes au telephone.
   */
  it("ne compte jamais un salon dans les deux categories", () => {
    const c = calculerCompteurs(
      [
        salon({ derniereVenteAt: null }), // jamais vendu
        salon({ derniereVenteAt: ilYa(30) }), // devenu inactif
        salon({ derniereVenteAt: ilYa(2) }), // actif
      ],
      MAINTENANT,
    );
    expect(c.jamaisVendu).toBe(1);
    expect(c.devenusInactifs).toBe(1);
    expect(c.jamaisVendu + c.devenusInactifs).toBeLessThanOrEqual(c.total);
  });

  it("respecte le seuil d'inactivite, bornes comprises", () => {
    const juste = calculerCompteurs(
      [salon({ derniereVenteAt: ilYa(SEUIL_INACTIF_JOURS - 1) })],
      MAINTENANT,
    );
    expect(juste.devenusInactifs).toBe(0);

    const depasse = calculerCompteurs(
      [salon({ derniereVenteAt: ilYa(SEUIL_INACTIF_JOURS + 1) })],
      MAINTENANT,
    );
    expect(depasse.devenusInactifs).toBe(1);
  });

  it("utilise un seuil de 14 jours", () => {
    // Sept jours declencherait de fausses alertes a chaque conge.
    expect(SEUIL_INACTIF_JOURS).toBe(14);
  });
});

describe("salonsARappeler", () => {
  const avecNom = (sur: Partial<SalonPourCompteurs> & { salonName: string }) => ({
    ...salon(sur),
    salonName: sur.salonName,
    city: null,
  });

  it("rend une liste vide quand tout le monde est actif", () => {
    const r = salonsARappeler(
      [avecNom({ salonName: "A", derniereVenteAt: ilYa(1) })],
      MAINTENANT,
    );
    expect(r).toEqual([]);
  });

  it("signale les salons n'ayant jamais encaisse", () => {
    const r = salonsARappeler([avecNom({ salonName: "A" })], MAINTENANT);
    expect(r).toHaveLength(1);
    expect(r[0].raison).toBe("jamais-vendu");
    expect(r[0].joursSansVente).toBeNull();
  });

  it("signale les salons devenus silencieux, avec le nombre de jours", () => {
    const r = salonsARappeler(
      [avecNom({ salonName: "A", derniereVenteAt: ilYa(30) })],
      MAINTENANT,
    );
    expect(r[0].raison).toBe("devenu-inactif");
    expect(r[0].joursSansVente).toBe(30);
  });

  /*
   * L'ORDRE EST LE PRODUIT. Un salon inscrit il y a trois jours qui n'a pas
   * encore encaisse se rattrape d'un appel ; celui d'il y a six mois est
   * probablement perdu. Trier a l'envers mettrait les causes perdues en tete.
   */
  it("met les « jamais vendu » RECENTS en premier", () => {
    const r = salonsARappeler(
      [
        avecNom({ salonName: "Ancien", inscritLe: ilYa(180) }),
        avecNom({ salonName: "Recent", inscritLe: ilYa(3) }),
      ],
      MAINTENANT,
    );
    expect(r[0].salonName).toBe("Recent");
  });

  it("fait passer les « jamais vendu » avant les « devenus inactifs »", () => {
    const r = salonsARappeler(
      [
        avecNom({ salonName: "Inactif", derniereVenteAt: ilYa(40) }),
        avecNom({ salonName: "Jamais", inscritLe: ilYa(5) }),
      ],
      MAINTENANT,
    );
    expect(r[0].salonName).toBe("Jamais");
  });

  it("classe les inactifs du silence le plus court au plus long", () => {
    const r = salonsARappeler(
      [
        avecNom({ salonName: "Long", derniereVenteAt: ilYa(90) }),
        avecNom({ salonName: "Court", derniereVenteAt: ilYa(20) }),
      ],
      MAINTENANT,
    );
    expect(r.map((x) => x.salonName)).toEqual(["Court", "Long"]);
  });

  /*
   * Un salon suspendu n'est pas a rappeler pour inactivite : son silence est
   * NOTRE decision, pas son abandon.
   */
  it("exclut les salons suspendus", () => {
    const r = salonsARappeler(
      [avecNom({ salonName: "Suspendu", suspendu: true })],
      MAINTENANT,
    );
    expect(r).toEqual([]);
  });

  it("borne la liste", () => {
    const beaucoup = Array.from({ length: 200 }, (_, i) =>
      avecNom({ salonName: `S${i}` }),
    );
    expect(salonsARappeler(beaucoup, MAINTENANT, 50)).toHaveLength(50);
  });
});
