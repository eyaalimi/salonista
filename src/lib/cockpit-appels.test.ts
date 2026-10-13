import { describe, it, expect } from "vitest";
import {
  MARCHES,
  LIBELLE_MARCHE,
  MAX_QUESTIONS,
  POINTS_MARCHES,
  POINTS_ACTIVITE,
  MALUS_ALERTE,
  RANG_ALERTE,
  RANG_JAMAIS_VENDU,
  RANG_AUTRE,
  marcheBloquante,
  aFranchi,
  construireEntonnoir,
  prioriteAppel,
  fileDAppels,
  scoreSante,
  questionsAPoser,
  joursDepuis,
  type SalonPourMarche,
  type SalonPourPriorite,
  type SignauxQuestions,
} from "./cockpit-appels";

const T = new Date("2026-10-13T12:00:00.000Z");
const jours = (n: number) => new Date(T.getTime() + n * 86_400_000);

/** Un salon qui a TOUT franchi : le point de depart de chaque test. */
function salonComplet(): SalonPourMarche {
  return {
    emailVerifie: true,
    profil: {
      address: "12 rue des Oliviers",
      city: "Tunis",
      photos: ["/uploads/a.webp"],
      openingHours: { lundi: [{ debut: "09:00", fin: "18:00" }] },
    },
    nombreOffres: 3,
    tiroirDejaOuvert: true,
    premiereVenteAt: jours(-20),
    derniereVenteAt: jours(-1),
    derniereConnexionAt: jours(-1),
  };
}

function pourPriorite(
  over: Partial<SalonPourPriorite> = {},
): SalonPourPriorite {
  return {
    ...salonComplet(),
    id: "s1",
    salonName: "Salon Test",
    city: "Tunis",
    inscritLe: jours(-30),
    suspendu: false,
    securite: { verrouillages: 0, pinIncorrects: 0, mdpIncorrects: 0 },
    ...over,
  };
}

describe("marcheBloquante", () => {
  it("rend null quand tout est franchi", () => {
    expect(marcheBloquante(salonComplet(), T)).toBeNull();
  });

  it("range a la PREMIERE marche non franchie, pas a la derniere", () => {
    // Ce salon rate l'e-mail ET le profil ET la vente : il est bloque a
    // l'e-mail, et nulle part ailleurs.
    const s: SalonPourMarche = {
      ...salonComplet(),
      emailVerifie: false,
      nombreOffres: 0,
      premiereVenteAt: null,
    };
    expect(marcheBloquante(s, T)).toBe("email_verifie");
  });

  it("detecte un profil incomplet", () => {
    const s = salonComplet();
    s.profil = { ...s.profil, city: null };
    expect(marcheBloquante(s, T)).toBe("profil");
  });

  // La decision du plan : sans horaires, aucun creneau n'est genere, donc le
  // profil n'est PAS pret.
  it("des horaires absents bloquent au PROFIL, pas ailleurs", () => {
    const s = salonComplet();
    s.profil = { ...s.profil, openingHours: {} };
    expect(marcheBloquante(s, T)).toBe("profil");
  });

  it("detecte un catalogue vide", () => {
    expect(marcheBloquante({ ...salonComplet(), nombreOffres: 0 }, T)).toBe("catalogue");
  });

  it("detecte un tiroir jamais ouvert", () => {
    expect(
      marcheBloquante({ ...salonComplet(), tiroirDejaOuvert: false }, T),
    ).toBe("tiroir");
  });

  it("detecte un salon qui n'a jamais encaisse", () => {
    expect(
      marcheBloquante({ ...salonComplet(), premiereVenteAt: null }, T),
    ).toBe("premiere_vente");
  });

  it("detecte un salon qui a decroche", () => {
    const s: SalonPourMarche = {
      ...salonComplet(),
      derniereVenteAt: jours(-30),
      derniereConnexionAt: jours(-30),
    };
    expect(marcheBloquante(s, T)).toBe("actif");
  });

  // `estActif` = vente OU connexion : on ne redefinit pas la regle ici.
  it("une simple connexion recente suffit a rester actif", () => {
    const s: SalonPourMarche = {
      ...salonComplet(),
      derniereVenteAt: jours(-30),
      derniereConnexionAt: jours(-2),
    };
    expect(marcheBloquante(s, T)).toBeNull();
  });
});

describe("aFranchi", () => {
  it("un salon complet a tout franchi", () => {
    for (const m of MARCHES) expect(aFranchi(salonComplet(), m, T)).toBe(true);
  });

  it("un salon bloque au tiroir a franchi ce qui precede, pas la suite", () => {
    const s = { ...salonComplet(), tiroirDejaOuvert: false };
    expect(aFranchi(s, "inscrit", T)).toBe(true);
    expect(aFranchi(s, "email_verifie", T)).toBe(true);
    expect(aFranchi(s, "catalogue", T)).toBe(true);
    expect(aFranchi(s, "tiroir", T)).toBe(false);
    expect(aFranchi(s, "premiere_vente", T)).toBe(false);
  });
});

describe("construireEntonnoir", () => {
  it("rend une ligne par marche, dans l'ordre", () => {
    const lignes = construireEntonnoir([salonComplet()], T);
    expect(lignes.map((l) => l.marche)).toEqual([...MARCHES]);
    expect(lignes.every((l) => l.libelle === LIBELLE_MARCHE[l.marche])).toBe(true);
  });

  it("tous les inscrits atteignent la premiere marche", () => {
    const lignes = construireEntonnoir(
      [salonComplet(), { ...salonComplet(), emailVerifie: false }],
      T,
    );
    expect(lignes[0].atteint).toBe(2);
    expect(lignes[0].pourcentage).toBe(100);
  });

  // Le piege a eviter : un salon bloque tot ne doit pas etre recompte dans
  // toutes les marches suivantes, sinon la file serait pleine de doublons.
  it("un salon n'est compte bloque qu'a UNE seule marche", () => {
    const lignes = construireEntonnoir(
      [{ ...salonComplet(), emailVerifie: false, nombreOffres: 0 }],
      T,
    );
    const total = lignes.reduce((s, l) => s + l.bloques, 0);
    expect(total).toBe(1);
    expect(lignes.find((l) => l.marche === "email_verifie")!.bloques).toBe(1);
    expect(lignes.find((l) => l.marche === "catalogue")!.bloques).toBe(0);
  });

  it("les atteints decroissent le long de l'entonnoir", () => {
    const lignes = construireEntonnoir(
      [
        salonComplet(),
        { ...salonComplet(), emailVerifie: false },
        { ...salonComplet(), nombreOffres: 0 },
        { ...salonComplet(), premiereVenteAt: null },
      ],
      T,
    );
    for (let i = 1; i < lignes.length; i++) {
      expect(lignes[i].atteint).toBeLessThanOrEqual(lignes[i - 1].atteint);
    }
    expect(lignes[0].atteint).toBe(4);
    expect(lignes[lignes.length - 1].atteint).toBe(1);
  });

  it("signale la plus grosse perte", () => {
    const lignes = construireEntonnoir(
      [
        { ...salonComplet(), nombreOffres: 0 },
        { ...salonComplet(), nombreOffres: 0 },
        { ...salonComplet(), emailVerifie: false },
      ],
      T,
    );
    expect(lignes.find((l) => l.plusGrossePerte)!.marche).toBe("catalogue");
  });

  // A egalite, la marche la plus PRECOCE gagne : la debloquer libere aussi
  // ce qui est en aval.
  it("a egalite, la marche la plus precoce est designee", () => {
    const lignes = construireEntonnoir(
      [{ ...salonComplet(), emailVerifie: false }, { ...salonComplet(), nombreOffres: 0 }],
      T,
    );
    expect(lignes.find((l) => l.plusGrossePerte)!.marche).toBe("email_verifie");
  });

  it("ne signale aucune perte quand tout le monde a franchi", () => {
    const lignes = construireEntonnoir([salonComplet(), salonComplet()], T);
    expect(lignes.some((l) => l.plusGrossePerte)).toBe(false);
  });

  it("ne divise pas par zero sur une liste vide", () => {
    const lignes = construireEntonnoir([], T);
    expect(lignes).toHaveLength(MARCHES.length);
    expect(lignes.every((l) => l.pourcentage === 0 && l.atteint === 0)).toBe(true);
  });
});

describe("prioriteAppel", () => {
  it("une alerte de securite passe devant tout", () => {
    const s = pourPriorite({ securite: { verrouillages: 1, pinIncorrects: 0, mdpIncorrects: 0 } });
    expect(prioriteAppel(s, T).rang).toBe(RANG_ALERTE);
  });

  it("l'alerte prime meme sur un salon qui n'a jamais vendu", () => {
    const s = pourPriorite({
      premiereVenteAt: null,
      securite: { verrouillages: 1, pinIncorrects: 0, mdpIncorrects: 0 },
    });
    expect(prioriteAppel(s, T).rang).toBe(RANG_ALERTE);
  });

  it("« jamais encaisse » vient ensuite", () => {
    expect(prioriteAppel(pourPriorite({ premiereVenteAt: null }), T).rang).toBe(
      RANG_JAMAIS_VENDU,
    );
  });

  it("le reste arrive en dernier", () => {
    const s = pourPriorite({
      derniereVenteAt: jours(-40),
      derniereConnexionAt: jours(-40),
    });
    expect(prioriteAppel(s, T).rang).toBe(RANG_AUTRE);
  });

  // La regle de la section 27 : un salon inscrit il y a trois jours se
  // rattrape d'un appel, celui d'il y a six mois beaucoup moins.
  it("parmi les « jamais encaisse », le plus RECENT d'abord", () => {
    const recent = pourPriorite({ id: "r", premiereVenteAt: null, inscritLe: jours(-3) });
    const vieux = pourPriorite({ id: "v", premiereVenteAt: null, inscritLe: jours(-180) });
    expect(prioriteAppel(recent, T).cle).toBeLessThan(prioriteAppel(vieux, T).cle);
  });

  it("parmi les autres, le plus proche de la 1re vente d'abord", () => {
    const procheTiroir = pourPriorite({
      id: "a",
      tiroirDejaOuvert: false,
      derniereVenteAt: jours(-40),
      derniereConnexionAt: jours(-40),
    });
    const loinEmail = pourPriorite({
      id: "b",
      emailVerifie: false,
      derniereVenteAt: jours(-40),
      derniereConnexionAt: jours(-40),
    });
    expect(prioriteAppel(procheTiroir, T).cle).toBeLessThan(
      prioriteAppel(loinEmail, T).cle,
    );
  });
});

describe("fileDAppels", () => {
  // Meme regle que `salonsARappeler` : le silence d'un suspendu est notre
  // decision, pas son abandon.
  it("exclut les salons suspendus", () => {
    const file = fileDAppels(
      [pourPriorite({ id: "sus", premiereVenteAt: null, suspendu: true })],
      T,
    );
    expect(file).toHaveLength(0);
  });

  it("exclut un salon qui vend et reste actif", () => {
    expect(fileDAppels([pourPriorite()], T)).toHaveLength(0);
  });

  it("garde un salon actif s'il a une alerte de securite", () => {
    const s = pourPriorite({
      securite: { verrouillages: 1, pinIncorrects: 0, mdpIncorrects: 0 },
    });
    expect(fileDAppels([s], T)).toHaveLength(1);
  });

  it("trie alerte, puis jamais vendu, puis le reste", () => {
    const file = fileDAppels(
      [
        pourPriorite({
          id: "autre",
          derniereVenteAt: jours(-40),
          derniereConnexionAt: jours(-40),
        }),
        pourPriorite({ id: "jamais", premiereVenteAt: null }),
        pourPriorite({
          id: "alerte",
          securite: { verrouillages: 1, pinIncorrects: 0, mdpIncorrects: 0 },
        }),
      ],
      T,
    );
    expect(file.map((s) => s.id)).toEqual(["alerte", "jamais", "autre"]);
  });

  // Sans ordre stable, la liste se reclasserait sous les yeux de l'appelant
  // entre deux chargements.
  it("ordonne de facon stable deux salons equivalents", () => {
    const a = pourPriorite({ id: "aaa", premiereVenteAt: null, inscritLe: jours(-5) });
    const b = pourPriorite({ id: "bbb", premiereVenteAt: null, inscritLe: jours(-5) });
    expect(fileDAppels([b, a], T).map((s) => s.id)).toEqual(["aaa", "bbb"]);
    expect(fileDAppels([a, b], T).map((s) => s.id)).toEqual(["aaa", "bbb"]);
  });
});

describe("scoreSante", () => {
  it("rend null pour un salon suspendu", () => {
    expect(scoreSante(pourPriorite({ suspendu: true }), T)).toBeNull();
  });

  it("donne le maximum a un salon complet et actif", () => {
    expect(scoreSante(pourPriorite(), T)).toBe(POINTS_MARCHES + POINTS_ACTIVITE);
  });

  // Sans l'exclusion de « Inscrits », un salon qui n'a rien fait obtiendrait
  // deja des points pour exister.
  it("donne 0 a un salon qui n'a franchi aucune marche", () => {
    const s = pourPriorite({
      emailVerifie: false,
      nombreOffres: 0,
      tiroirDejaOuvert: false,
      premiereVenteAt: null,
      derniereVenteAt: null,
      derniereConnexionAt: null,
      profil: { address: null, city: null, photos: [], openingHours: {} },
    });
    expect(scoreSante(s, T)).toBe(0);
  });

  it("retire des points pour une alerte de securite", () => {
    const sain = pourPriorite();
    const alerte = pourPriorite({
      securite: { verrouillages: 1, pinIncorrects: 0, mdpIncorrects: 0 },
    });
    expect(scoreSante(alerte, T)).toBe(scoreSante(sain, T)! - MALUS_ALERTE);
  });

  it("reste borne entre 0 et 100", () => {
    const cas: SalonPourPriorite[] = [
      pourPriorite(),
      pourPriorite({ premiereVenteAt: null }),
      pourPriorite({
        emailVerifie: false,
        derniereVenteAt: null,
        derniereConnexionAt: null,
        securite: { verrouillages: 3, pinIncorrects: 20, mdpIncorrects: 20 },
      }),
    ];
    for (const s of cas) {
      const n = scoreSante(s, T)!;
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(100);
    }
  });

  it("un salon inactif perd les points d'activite", () => {
    const inactif = pourPriorite({
      derniereVenteAt: jours(-40),
      derniereConnexionAt: jours(-40),
    });
    expect(scoreSante(inactif, T)).toBeLessThan(scoreSante(pourPriorite(), T)!);
  });
});

describe("questionsAPoser", () => {
  const rien: SignauxQuestions = {
    emailVerifie: true,
    horairesRenseignes: true,
    champsManquants: [],
    employeeVerrouillee: false,
    paniersAbandonnes: 0,
    ventesRefuseesTiroir: 0,
    tiroirJamaisCloture: false,
    catalogueVide: false,
    servicesSansPhoto: 0,
  };

  it("ne propose rien quand tout va bien", () => {
    expect(questionsAPoser(rien)).toHaveLength(0);
  });

  it("n'en rend jamais plus que le maximum", () => {
    const tout: SignauxQuestions = {
      emailVerifie: false,
      horairesRenseignes: false,
      champsManquants: ["ville", "adresse", "matricule fiscal"],
      employeeVerrouillee: true,
      paniersAbandonnes: 3,
      ventesRefuseesTiroir: 2,
      tiroirJamaisCloture: true,
      catalogueVide: true,
      servicesSansPhoto: 4,
    };
    expect(questionsAPoser(tout)).toHaveLength(MAX_QUESTIONS);
  });

  it("met l'employee bloquee en premier — elle ne peut pas travailler", () => {
    const q = questionsAPoser({ ...rien, employeeVerrouillee: true, servicesSansPhoto: 2 });
    expect(q[0].question).toContain("code PIN");
  });

  it("nomme les champs manquants plutot que de dire « profil incomplet »", () => {
    const q = questionsAPoser({ ...rien, champsManquants: ["ville", "adresse"] });
    expect(q[0].question).toContain("ville");
    expect(q[0].question).toContain("adresse");
  });

  it("chiffre ce qu'elle constate", () => {
    const q = questionsAPoser({ ...rien, paniersAbandonnes: 3 });
    expect(q[0].parceQue).toContain("3");
  });

  // Ces phrases sont DITES au telephone : un tutoiement passerait mal avec
  // une gerante qu'on appelle pour la premiere fois.
  it("vouvoie, et porte toujours un « parce que »", () => {
    const tout: SignauxQuestions = {
      emailVerifie: false,
      horairesRenseignes: false,
      champsManquants: ["ville"],
      employeeVerrouillee: true,
      paniersAbandonnes: 1,
      ventesRefuseesTiroir: 1,
      tiroirJamaisCloture: true,
      catalogueVide: true,
      servicesSansPhoto: 1,
    };
    for (const q of questionsAPoser(tout)) {
      expect(q.parceQue.length).toBeGreaterThan(0);
      expect(q.question).not.toMatch(/\btu\b|\bton\b|\bta\b|\btes\b/i);
    }
  });

  it("propose la question des horaires quand ils manquent", () => {
    const q = questionsAPoser({ ...rien, horairesRenseignes: false });
    expect(q[0].question).toContain("horaires");
  });
});

describe("joursDepuis", () => {
  it("rend null sans date", () => {
    expect(joursDepuis(null, T)).toBeNull();
  });

  it("compte les jours ecoules", () => {
    expect(joursDepuis(jours(-3), T)).toBe(3);
    expect(joursDepuis(T, T)).toBe(0);
  });
});
