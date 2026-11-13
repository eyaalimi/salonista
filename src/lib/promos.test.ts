import { describe, expect, it } from "vitest";
import {
  OFFRE_MAX,
  TENTATIVES_MAX,
  apresTentative,
  composerApercu,
  compterRevenues,
  coutEstime,
  estAudience,
  estDesinscription,
  estErreurDefinitive,
  libelleCout,
  lireProgrammation,
  lienPromoWhatsapp,
  composerMessageLien,
  validerMessageLien,
  MESSAGE_LIEN_PAR_DEFAUT,
  MESSAGE_LIEN_MAX,
  TEXTE_FIN_LIEN,
  modePromos,
  nettoyerOffre,
  prenomPourModele,
  selectionnerDestinataires,
  statutApresEvenement,
  telephonePourWhatsapp,
  type ClientePromo,
} from "./promos";

describe("nettoyerOffre", () => {
  it("retours à la ligne, tabulations et espaces multiples deviennent un espace", () => {
    expect(nettoyerOffre("Promo à 10 DT :\népilation\t+ sourcils     + brushing  ")).toEqual({
      ok: true,
      offre: "Promo à 10 DT : épilation + sourcils + brushing",
    });
  });

  it("refuse une offre vide", () => {
    expect(nettoyerOffre("   \n ").ok).toBe(false);
    expect(nettoyerOffre(undefined).ok).toBe(false);
  });

  it(`refuse au-delà de ${OFFRE_MAX} caractères, accepte la limite`, () => {
    expect(nettoyerOffre("a".repeat(OFFRE_MAX)).ok).toBe(true);
    const r = nettoyerOffre("a".repeat(OFFRE_MAX + 1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreur).toMatch(/501 caractères/);
  });
});

describe("composerApercu", () => {
  const texteFin = "Nestanewk 3andna 💖 Pour réserver, appelez le salon au 22 345 678 (ne répondez pas à ce numéro).";

  it("reproduit le modèle : salutation, offre, texte de fin du salon", () => {
    expect(composerApercu({ prenom: "Amira", offre: "Brushing à 10 DT", texteFin })).toBe(
      `Aslema Amira ! 3andna promo jdida lik :\n\nBrushing à 10 DT\n\n${texteFin}`,
    );
  });

  it("prénom absent : « 3zizti »", () => {
    expect(composerApercu({ prenom: null, offre: "x", texteFin: "" })).toBe(
      "Aslema 3zizti ! 3andna promo jdida lik :\n\nx",
    );
    expect(prenomPourModele("   ")).toBe("3zizti");
  });
});

describe("selectionnerDestinataires", () => {
  const maintenant = new Date("2026-11-12T10:00:00Z");
  const jours = (n: number) => new Date(maintenant.getTime() - n * 86400000);
  const cliente = (o: Partial<ClientePromo> & { id: string }): ClientePromo => ({
    telephone: "+21622345678",
    prenom: "X",
    promosAcceptees: true,
    derniereVenteAt: null,
    ...o,
  });
  const clientes: ClientePromo[] = [
    cliente({ id: "recente", telephone: "+21622000001", derniereVenteAt: jours(10) }),
    cliente({ id: "limite90", telephone: "+21622000002", derniereVenteAt: jours(90) }),
    cliente({ id: "inactive", telephone: "+21622000003", derniereVenteAt: jours(75) }),
    cliente({ id: "jamais", telephone: "+21622000004", derniereVenteAt: null }),
    cliente({ id: "refus", telephone: "+21622000005", promosAcceptees: false, derniereVenteAt: jours(70) }),
    cliente({ id: "invalide", telephone: "walk-in-123", derniereVenteAt: jours(80) }),
    cliente({ id: "doublon", telephone: "22 000 003", derniereVenteAt: jours(100) }),
  ];

  it("TOUTES : tout le monde sauf refus, numéros invalides et doublons", () => {
    const r = selectionnerDestinataires({ clientes, audience: "TOUTES", maintenant });
    expect(r.retenues.map((x) => x.customerId)).toEqual(["recente", "limite90", "inactive", "jamais"]);
    expect(r.exclues).toEqual({ refus: 1, numeroInvalide: 1, doublon: 1 });
    expect(r.retenues[0].telephone).toBe("21622000001");
  });

  it("RECENTES_90J : dernière vente il y a 90 jours au plus (chevauche INACTIVES_60J, voulu)", () => {
    const r = selectionnerDestinataires({ clientes, audience: "RECENTES_90J", maintenant });
    expect(r.retenues.map((x) => x.customerId)).toEqual(["recente", "limite90", "inactive"]);
  });

  it("INACTIVES_60J : au moins une vente, aucune depuis 60 jours ; jamais venue exclue", () => {
    const r = selectionnerDestinataires({ clientes, audience: "INACTIVES_60J", maintenant });
    expect(r.retenues.map((x) => x.customerId)).toEqual(["limite90", "inactive"]);
    expect(r.exclues).toEqual({ refus: 1, numeroInvalide: 1, doublon: 1 });
  });

  it("MANUELLE : seulement les cochées, et un refus reste exclu même coché", () => {
    const r = selectionnerDestinataires({
      clientes,
      audience: "MANUELLE",
      maintenant,
      idsManuels: ["jamais", "refus"],
    });
    expect(r.retenues.map((x) => x.customerId)).toEqual(["jamais"]);
    expect(r.exclues.refus).toBe(1);
  });

  it("une cliente qui a refusé n'est JAMAIS retenue, quelle que soit l'audience", () => {
    for (const audience of ["TOUTES", "RECENTES_90J", "INACTIVES_60J", "MANUELLE"] as const) {
      const r = selectionnerDestinataires({ clientes, audience, maintenant, idsManuels: ["refus"] });
      expect(r.retenues.some((x) => x.customerId === "refus")).toBe(false);
    }
  });

  it("estAudience", () => {
    expect(estAudience("TOUTES")).toBe(true);
    expect(estAudience("autre")).toBe(false);
  });

  it("telephonePourWhatsapp", () => {
    expect(telephonePourWhatsapp("+216 22 345 678")).toBe("21622345678");
    expect(telephonePourWhatsapp("123")).toBeNull();
  });
});

describe("coût", () => {
  it("en millimes, null si prix inconnu", () => {
    expect(coutEstime(236, "0.150")).toBe(35400);
    expect(coutEstime(236, null)).toBeNull();
    expect(libelleCout(236, "0.150")).toBe("coût estimé 35,400 DT");
    expect(libelleCout(236, null)).toBe("coût selon le tarif Meta");
  });
});

describe("erreurs Meta", () => {
  it("définitives : pas de WhatsApp, limite marketing, refus marketing, modèle, jeton, anti-spam", () => {
    for (const c of ["131026", "131049", "131050", "132001", "132015", "190", "131048", 100, "250"]) {
      expect(estErreurDefinitive(c)).toBe(true);
    }
  });

  it("temporaires : débit, indisponibilité, inconnues, réseau", () => {
    for (const c of ["130429", "131056", "80007", "4", "2", "1", "131000", "131016", "RESEAU", "HTTP_503", null]) {
      expect(estErreurDefinitive(c)).toBe(false);
    }
  });

  it("apresTentative : succès, temporaire réessayé, définitif ou 3e échec → ECHEC", () => {
    expect(apresTentative({ tentatives: 0, resultat: { ok: true, messageIdExterne: "wamid.1" } })).toEqual({
      statut: "ENVOYE",
      tentatives: 1,
      erreur: null,
    });
    const temp = { ok: false as const, code: "130429", message: "Rate limit hit", definitive: false };
    expect(apresTentative({ tentatives: 0, resultat: temp }).statut).toBe("EN_ATTENTE");
    expect(apresTentative({ tentatives: TENTATIVES_MAX - 1, resultat: temp })).toMatchObject({
      statut: "ECHEC",
      tentatives: TENTATIVES_MAX,
    });
    expect(
      apresTentative({
        tentatives: 0,
        resultat: { ok: false, code: "131026", message: "Unable to deliver", definitive: true },
      }),
    ).toEqual({ statut: "ECHEC", tentatives: 1, erreur: "131026 — Unable to deliver" });
  });
});

describe("statutApresEvenement", () => {
  it("avance, ne recule jamais", () => {
    expect(statutApresEvenement("ENVOYE", "delivered")).toBe("DELIVRE");
    expect(statutApresEvenement("DELIVRE", "read")).toBe("LU");
    expect(statutApresEvenement("LU", "delivered")).toBeNull();
    expect(statutApresEvenement("LU", "sent")).toBeNull();
    expect(statutApresEvenement("RESERVE", "sent")).toBe("ENVOYE");
  });

  it("un échec n'écrase ni un message délivré ni un lu ; évènement inconnu ignoré", () => {
    expect(statutApresEvenement("ENVOYE", "failed")).toBe("ECHEC");
    expect(statutApresEvenement("DELIVRE", "failed")).toBeNull();
    expect(statutApresEvenement("ECHEC", "delivered")).toBeNull();
    expect(statutApresEvenement("ENVOYE", "played")).toBeNull();
  });
});

describe("estDesinscription", () => {
  it("bouton et mots clés, toutes casses et accents", () => {
    for (const t of ["STOP", "stop", " Stop! ", "arrêt", "Arret", "Ne plus recevoir", "Ne plus recevoir de promos"]) {
      expect(estDesinscription(t)).toBe(true);
    }
  });
  it("une phrase qui contient stop n'en est pas une", () => {
    expect(estDesinscription("on s'arrête au salon demain, stop ou encore ?")).toBe(false);
    expect(estDesinscription("Merci !")).toBe(false);
    expect(estDesinscription(null)).toBe(false);
  });
});

describe("compterRevenues", () => {
  const envoi = new Date("2026-11-01T10:00:00Z");
  it("distinctes, dans les 15 jours après l'envoi seulement", () => {
    const n = compterRevenues(
      [
        { customerId: "a", envoyeLe: envoi },
        { customerId: "b", envoyeLe: envoi },
        { customerId: "c", envoyeLe: envoi },
        { customerId: "d", envoyeLe: null },
        { customerId: null, envoyeLe: envoi },
      ],
      [
        { customerId: "a", createdAt: new Date("2026-11-03T10:00:00Z") },
        { customerId: "a", createdAt: new Date("2026-11-05T10:00:00Z") },
        { customerId: "b", createdAt: new Date("2026-10-30T10:00:00Z") }, // avant l'envoi
        { customerId: "c", createdAt: new Date("2026-11-17T10:00:00Z") }, // 16 jours après
        { customerId: "d", createdAt: new Date("2026-11-02T10:00:00Z") }, // jamais envoyé
      ],
    );
    expect(n).toBe(1);
  });
});

describe("lireProgrammation", () => {
  const maintenant = new Date("2026-11-12T10:00:00Z");
  it("vide = maintenant ; futur accepté", () => {
    expect(lireProgrammation(null, maintenant)).toEqual({ ok: true, programmeeLe: null });
    expect(lireProgrammation("", maintenant)).toEqual({ ok: true, programmeeLe: null });
    const r = lireProgrammation("2026-11-13T09:00:00Z", maintenant);
    expect(r.ok && r.programmeeLe?.toISOString()).toBe("2026-11-13T09:00:00.000Z");
  });
  it("passé de moins de 5 min = maintenant ; au-delà refusé", () => {
    expect(lireProgrammation("2026-11-12T09:57:00Z", maintenant)).toEqual({ ok: true, programmeeLe: null });
    expect(lireProgrammation("2026-11-12T09:00:00Z", maintenant).ok).toBe(false);
  });
  it("invalide ou à plus de 60 jours : refusé", () => {
    expect(lireProgrammation("demain", maintenant).ok).toBe(false);
    expect(lireProgrammation("2027-02-01T10:00:00Z", maintenant).ok).toBe(false);
  });
});

describe("modePromos", () => {
  it("connexion ACTIVE : WhatsApp, salon de démo ou non", () => {
    expect(modePromos({ statutConnexion: "ACTIVE", simulationActivee: true, salonDemo: true })).toBe("WHATSAPP");
    expect(modePromos({ statutConnexion: "ACTIVE", simulationActivee: false, salonDemo: false })).toBe("WHATSAPP");
  });

  it("simulation : salon de démo, sans connexion, variable posée — les trois", () => {
    expect(modePromos({ statutConnexion: null, simulationActivee: true, salonDemo: true })).toBe("SIMULATION");
    expect(modePromos({ statutConnexion: null, simulationActivee: false, salonDemo: true })).toBe("LIEN");
  });

  it("un VRAI salon ne voit jamais le mode démo : il envoie par liens wa.me", () => {
    expect(modePromos({ statutConnexion: null, simulationActivee: true, salonDemo: false })).toBe("LIEN");
    expect(modePromos({ statutConnexion: null, simulationActivee: false, salonDemo: false })).toBe("LIEN");
  });

  it("brouillon ou suspendue : liens wa.me, jamais la simulation ni l'envoi automatique", () => {
    for (const statutConnexion of ["BROUILLON", "SUSPENDUE"] as const) {
      expect(modePromos({ statutConnexion, simulationActivee: true, salonDemo: true })).toBe("LIEN");
    }
  });
});

describe("lienPromoWhatsapp", () => {
  it("ouvre la conversation de la cliente avec le message prêt, STOP compris", () => {
    const lien = lienPromoWhatsapp({ telephone: "21622345678", prenom: "Amira", offre: "Brushing à 10 DT" });
    expect(lien).toMatch(/^https:\/\/wa\.me\/21622345678\?text=/);
    const texte = decodeURIComponent(lien!.split("text=")[1]);
    expect(texte).toBe(
      "Aslema Amira ! 3andna promo jdida lik :\n\nBrushing à 10 DT\n\nNestanewk 3andna 💖\n(Répondez STOP pour ne plus recevoir nos promos.)",
    );
  });

  it("prénom absent : « 3zizti » ; numéro trop court : pas de lien", () => {
    const lien = lienPromoWhatsapp({ telephone: "21622345678", prenom: null, offre: "x" });
    expect(decodeURIComponent(lien!.split("text=")[1])).toMatch(/^Aslema 3zizti !/);
    expect(lienPromoWhatsapp({ telephone: "22345678", prenom: "A", offre: "x" })).toBeNull();
  });
});

describe("message par liens modifiable", () => {
  it("le message par défaut donne le même texte qu'avant", () => {
    expect(composerMessageLien(null, { prenom: "Amira", offre: "Brushing à 10 DT" })).toBe(
      composerApercu({ prenom: "Amira", offre: "Brushing à 10 DT", texteFin: TEXTE_FIN_LIEN }),
    );
    expect(MESSAGE_LIEN_PAR_DEFAUT).toContain("{prenom}");
    expect(validerMessageLien(MESSAGE_LIEN_PAR_DEFAUT).ok).toBe(true);
  });

  it("message du salon : variables remplacées, retours à la ligne gardés, inconnue laissée", () => {
    const gabarit = "Salam {prenom} 🌸\n{offre}\nÀ très vite chez Yasmine ! {salon}\nRépondez STOP pour arrêter.";
    expect(composerMessageLien(gabarit, { prenom: null, offre: "  -20 % sur les soins " })).toBe(
      "Salam 3zizti 🌸\n-20 % sur les soins\nÀ très vite chez Yasmine ! {salon}\nRépondez STOP pour arrêter.",
    );
  });

  it("validation : {offre} et STOP obligatoires, vide et trop long refusés", () => {
    expect(validerMessageLien("Bonjour {prenom}, Répondez STOP").ok).toBe(false);
    expect(validerMessageLien("Bonjour {prenom} ! {offre}").ok).toBe(false);
    expect(validerMessageLien("   ").ok).toBe(false);
    expect(validerMessageLien(`{offre} stop ${"a".repeat(MESSAGE_LIEN_MAX)}`).ok).toBe(false);
    expect(validerMessageLien("{offre}\r\nstop svp")).toEqual({ ok: true, message: "{offre}\nstop svp" });
  });

  it("le lien utilise le message du salon", () => {
    const lien = lienPromoWhatsapp({
      telephone: "21622345678",
      prenom: "Sana",
      offre: "Promo",
      gabarit: "Coucou {prenom} : {offre}. STOP pour arrêter.",
    });
    expect(decodeURIComponent(lien!.split("text=")[1])).toBe("Coucou Sana : Promo. STOP pour arrêter.");
  });
});
