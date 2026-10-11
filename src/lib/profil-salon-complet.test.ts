import { describe, it, expect } from "vitest";
import {
  NON_RENSEIGNE,
  CHAMPS_PROFIL,
  estRenseigne,
  completionProfil,
  afficher,
  formaterTelephone,
  lienTelephone,
} from "./profil-salon-complet";

describe("estRenseigne", () => {
  it("accepte une vraie valeur", () => {
    expect(estRenseigne("Tunis")).toBe(true);
  });

  it("refuse le vide, y compris une chaine d'espaces", () => {
    // Un salon qui tape une espace n'a pas renseigne sa ville : la compter
    // gonflerait le taux de completion sans rien apporter.
    expect(estRenseigne("")).toBe(false);
    expect(estRenseigne("   ")).toBe(false);
    expect(estRenseigne(null)).toBe(false);
    expect(estRenseigne(undefined)).toBe(false);
  });
});

describe("completionProfil", () => {
  it("rend 0 % et liste tout quand rien n'est rempli", () => {
    // L'etat d'un salon qui vient de s'inscrire : signup ne collecte ni
    // ville, ni adresse, ni matricule.
    const c = completionProfil({});
    expect(c.pourcentage).toBe(0);
    expect(c.remplis).toBe(0);
    expect(c.manquants).toHaveLength(CHAMPS_PROFIL.length);
    expect(c.manquants).toContain("ville");
    expect(c.manquants).toContain("matricule fiscal");
  });

  it("rend 100 % et aucun manquant quand tout est rempli", () => {
    const c = completionProfil({
      city: "Tunis",
      governorate: "Tunis",
      address: "12 rue de Marseille",
      phone: "+21620123456",
      matriculeFiscal: "1234567A",
      nomGerant: "Nour B.",
    });
    expect(c.pourcentage).toBe(100);
    expect(c.manquants).toEqual([]);
  });

  it("reflete l'etat typique d'un salon fraichement inscrit", () => {
    // Seul le telephone est connu : c'est ce que signup enregistre.
    const c = completionProfil({ phone: "+21620123456" });
    expect(c.remplis).toBe(1);
    expect(c.total).toBe(6);
    expect(c.pourcentage).toBe(17);
    expect(c.manquants).not.toContain("téléphone");
  });

  it("arrondit a l'entier", () => {
    // 2/6 = 33,33… ne doit pas s'afficher tel quel sur une fiche.
    const c = completionProfil({ city: "Sfax", phone: "+21620123456" });
    expect(c.pourcentage).toBe(33);
    expect(Number.isInteger(c.pourcentage)).toBe(true);
  });

  it("ne compte PAS un identifiant de passage comme un telephone", () => {
    /*
     * Le piege attrape en simulant les trois etats reels d'un salon :
     * `completionProfil` comptait `walk-in-…` comme rempli, alors que
     * `formaterTelephone` affichait « Non renseigné » juste en dessous. Les
     * deux se contredisaient a l'ecran.
     */
    const c = completionProfil({ phone: "walk-in-abc123" });
    expect(c.remplis).toBe(0);
    expect(c.manquants).toContain("téléphone");
  });

  it("ne compte pas un numero trop court comme un telephone", () => {
    expect(completionProfil({ phone: "123" }).manquants).toContain("téléphone");
  });

  it("s'accorde toujours avec formaterTelephone", () => {
    // Le verrou qui compte : les deux fonctions ne doivent jamais diverger.
    for (const p of ["+21620123456", "20123456", "walk-in-x", "123", "", null]) {
      const compte = !completionProfil({ phone: p }).manquants.includes("téléphone");
      const affiche = formaterTelephone(p) !== NON_RENSEIGNE;
      expect(compte, `incoherence pour ${JSON.stringify(p)}`).toBe(affiche);
    }
  });

  it("garde l'ordre de CHAMPS_PROFIL dans les manquants", () => {
    // L'ordre est celui de la fiche : une liste melangee se lirait mal.
    const c = completionProfil({ phone: "+21620123456" });
    expect(c.manquants[0]).toBe("ville");
    expect(c.manquants[1]).toBe("gouvernorat");
  });
});

describe("afficher", () => {
  it("rend la valeur, debarrassee de ses espaces", () => {
    expect(afficher("  Tunis ")).toBe("Tunis");
  });

  it("dit explicitement « Non renseigné » plutot qu'un tiret muet", () => {
    // C'est tout l'objet du changement : un tiret ne distinguait pas un
    // champ vide d'un bug d'affichage.
    expect(afficher(null)).toBe(NON_RENSEIGNE);
    expect(afficher("  ")).toBe(NON_RENSEIGNE);
    expect(NON_RENSEIGNE).toBe("Non renseigné");
  });
});

describe("formaterTelephone", () => {
  it("decoupe un numero tunisien pour qu'il se lise a voix haute", () => {
    // La fiche sert a appeler : douze chiffres d'affilee s'epellent mal.
    expect(formaterTelephone("+21620123456")).toBe("+216 20 123 456");
    expect(formaterTelephone("21620123456")).toBe("+216 20 123 456");
  });

  it("decoupe aussi un numero local a 8 chiffres", () => {
    expect(formaterTelephone("20123456")).toBe("20 123 456");
  });

  it("rend tel quel un numero de longueur inattendue", () => {
    // Mieux vaut un format brut qu'un decoupage faux, qui ferait composer un
    // mauvais appel.
    expect(formaterTelephone("+33612345678")).toBe("+33612345678");
  });

  it("ne presente pas un identifiant de passage comme un numero", () => {
    expect(formaterTelephone("walk-in-abc123")).toBe(NON_RENSEIGNE);
  });

  it("dit « Non renseigné » quand il n'y a pas de numero", () => {
    expect(formaterTelephone(null)).toBe(NON_RENSEIGNE);
    expect(formaterTelephone("")).toBe(NON_RENSEIGNE);
  });
});

describe("lienTelephone", () => {
  it("rend un numero composable, sans espaces", () => {
    expect(lienTelephone("+216 20 123 456")).toBe("+21620123456");
  });

  it("ajoute l'indicatif tunisien a un numero local", () => {
    // Sans indicatif, un clic depuis un mobile ne compose rien.
    expect(lienTelephone("20123456")).toBe("+21620123456");
  });

  it("rend null quand il n'y a rien a composer", () => {
    // Le gabarit sait alors ne pas afficher de lien mort.
    expect(lienTelephone(null)).toBeNull();
    expect(lienTelephone("123")).toBeNull();
    expect(lienTelephone("walk-in-abc")).toBeNull();
  });
});
