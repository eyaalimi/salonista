import { describe, it, expect } from "vitest";
import {
  decider,
  finDuReport,
  lireReport,
  detecterIos,
  REPORT_JOURS,
  DELAI_AVANT_AFFICHAGE_MS,
  type EtatInstallation,
} from "./installation-pwa";

const T = 1_700_000_000_000;

function etat(sur: Partial<EtatInstallation> = {}): EtatInstallation {
  return {
    dejaInstallee: false,
    invitationDisponible: true,
    estIos: false,
    reportJusqua: null,
    ...sur,
  };
}

describe("decider — faut-il proposer l'installation ?", () => {
  it("propose un vrai bouton quand le navigateur sait installer", () => {
    expect(decider(etat(), T)).toEqual({ montrer: true, mode: "bouton" });
  });

  /*
   * Proposer d'installer ce qui l'est deja est le genre de detail qui fait
   * douter de tout le reste du produit.
   */
  it("ne propose RIEN si l'application est deja installee", () => {
    expect(decider(etat({ dejaInstallee: true }), T)).toEqual({ montrer: false });
    // Meme quand tout le reste dit oui.
    expect(
      decider(etat({ dejaInstallee: true, estIos: true, invitationDisponible: true }), T),
    ).toEqual({ montrer: false });
  });

  it("respecte un report en cours", () => {
    expect(decider(etat({ reportJusqua: T + 1000 }), T)).toEqual({ montrer: false });
  });

  it("repropose une fois le report expire", () => {
    expect(decider(etat({ reportJusqua: T - 1 }), T)).toEqual({
      montrer: true,
      mode: "bouton",
    });
  });

  it("repropose pile a l'expiration", () => {
    expect(decider(etat({ reportJusqua: T }), T).montrer).toBe(true);
  });

  /*
   * Safari n'emet JAMAIS `beforeinstallprompt`. Sans ce cas, la moitie des
   * visiteurs tunisiens ne verrait jamais rien.
   */
  it("explique le geste a la main sur iOS", () => {
    expect(
      decider(etat({ invitationDisponible: false, estIos: true }), T),
    ).toEqual({ montrer: true, mode: "instructions-ios" });
  });

  it("prefere le vrai bouton aux instructions quand les deux sont possibles", () => {
    expect(
      decider(etat({ invitationDisponible: true, estIos: true }), T),
    ).toEqual({ montrer: true, mode: "bouton" });
  });

  /*
   * Mieux vaut AUCUNE invitation qu'un bouton qui ne ferait rien.
   */
  it("ne montre rien sur un navigateur qui ne sait pas installer", () => {
    expect(
      decider(etat({ invitationDisponible: false, estIos: false }), T),
    ).toEqual({ montrer: false });
  });
});

describe("report", () => {
  it("dure 14 jours", () => {
    expect(finDuReport(T) - T).toBe(REPORT_JOURS * 24 * 60 * 60 * 1000);
    // 30 jours rataient la deuxieme visite, qui est souvent la bonne.
    expect(REPORT_JOURS).toBe(14);
  });

  it("se relit tel quel", () => {
    const fin = finDuReport(T);
    expect(lireReport(String(fin))).toBe(fin);
  });

  /*
   * Cette valeur vient du navigateur, donc de n'importe qui. Une invitation
   * ne doit jamais disparaitre pour toujours a cause d'une chaine corrompue.
   */
  it("ignore tout ce qui n'est pas un nombre exploitable", () => {
    for (const v of [null, undefined, "", "   ", "abc", "NaN", "-5", "0", "Infinity"]) {
      expect(lireReport(v), String(v)).toBeNull();
    }
  });
});

describe("detecterIos", () => {
  const SAFARI_IPHONE =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1";

  it("reconnait un iPhone, un iPad et un iPod", () => {
    expect(detecterIos(SAFARI_IPHONE, undefined)).toBe(true);
    expect(detecterIos("Mozilla/5.0 (iPad; CPU OS 17_0)", undefined)).toBe(true);
    expect(detecterIos("Mozilla/5.0 (iPod touch)", undefined)).toBe(true);
  });

  /*
   * `navigator.standalone` vaut `true` quand la page tourne deja depuis
   * l'icone de l'ecran d'accueil : on ne propose pas d'installer a quelqu'un
   * qui a deja installe.
   */
  it("exclut un iPhone ou l'application est DEJA installee", () => {
    expect(detecterIos(SAFARI_IPHONE, true)).toBe(false);
  });

  it("laisse passer un iPhone dont le navigateur ne dit rien", () => {
    expect(detecterIos(SAFARI_IPHONE, false)).toBe(true);
    expect(detecterIos(SAFARI_IPHONE, undefined)).toBe(true);
  });

  it("ne confond pas Android ni un ordinateur avec iOS", () => {
    expect(detecterIos("Mozilla/5.0 (Linux; Android 14) Chrome/120", undefined)).toBe(false);
    expect(detecterIos("Mozilla/5.0 (Windows NT 10.0) Chrome/120", undefined)).toBe(false);
    expect(detecterIos("Mozilla/5.0 (Macintosh; Intel Mac OS X) Safari/605", undefined)).toBe(
      false,
    );
  });

  it("supporte un agent vide sans planter", () => {
    expect(detecterIos("", undefined)).toBe(false);
  });
});

describe("delai avant affichage", () => {
  it("laisse trois secondes au visiteur", () => {
    // Une invitation qui arrive avant la premiere phrase se fait fermer par
    // reflexe, pas par choix.
    expect(DELAI_AVANT_AFFICHAGE_MS).toBe(3000);
  });
});
