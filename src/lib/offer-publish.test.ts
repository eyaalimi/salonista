import { describe, it, expect } from "vitest";
import { missingForPublish, type PublishCandidate } from "./offer-publish";

describe("missingForPublish", () => {
  const complet: PublishCandidate = {
    category: "COIFFURE",
    originalPrice: "50.000",
    discountPrice: "35.000",
    photos: ["/uploads/a.jpg"],
  };

  it("ne renvoie rien quand tout est present", () => {
    expect(missingForPublish(complet)).toEqual([]);
  });

  it("exige une categorie", () => {
    expect(missingForPublish({ ...complet, category: null })).toEqual(["catégorie"]);
  });

  it("exige au moins une photo", () => {
    expect(missingForPublish({ ...complet, photos: [] })).toEqual(["au moins une photo"]);
  });

  it("accepte un prix barre absent (null) — la promotion est facultative", () => {
    expect(missingForPublish({ ...complet, originalPrice: null })).toEqual([]);
  });

  it("accepte un prix barre absent (undefined explicite)", () => {
    expect(missingForPublish({ ...complet, originalPrice: undefined })).toEqual([]);
  });

  it("accepte un prix barre absent (cle omise du tout)", () => {
    // PublishCandidate type originalPrice comme obligatoire-mais-nullable
    // (`Money | null | undefined`), pas comme propriete optionnelle (`?:`) :
    // une omission de cle n'est donc pas assignable au type sans cast. On
    // caste volontairement pour couvrir le cas reel d'un appelant JS/JSON
    // qui omet la cle plutot que d'envoyer `undefined` explicitement — les
    // deux doivent se comporter de facon identique a l'execution.
    const sansOriginalPrice = { ...complet };
    delete (sansOriginalPrice as Partial<PublishCandidate>).originalPrice;
    expect(missingForPublish(sansOriginalPrice as PublishCandidate)).toEqual([]);
  });

  it("exige une categorie (undefined explicite)", () => {
    expect(missingForPublish({ ...complet, category: undefined })).toEqual(["catégorie"]);
  });

  it("exige une categorie (cle omise du tout)", () => {
    // Meme remarque que ci-dessus : cast volontaire, cle absente plutot
    // qu'explicitement undefined.
    const sansCategory = { ...complet };
    delete (sansCategory as Partial<PublishCandidate>).category;
    expect(missingForPublish(sansCategory as PublishCandidate)).toEqual(["catégorie"]);
  });

  it("refuse un prix barre inferieur au prix de vente", () => {
    expect(
      missingForPublish({ ...complet, originalPrice: "20.000", discountPrice: "35.000" }),
    ).toEqual(["prix barré ≥ prix actuel"]);
  });

  it("accepte un prix barre egal au prix de vente", () => {
    expect(
      missingForPublish({ ...complet, originalPrice: "35.000", discountPrice: "35.000" }),
    ).toEqual([]);
  });

  it("compare toujours via toMillimes, pas via Number() direct", () => {
    // Recherche exhaustive (script jetable, voir conversation) : pour des
    // chaines a 3 decimales dans une plage de prix realiste (jusqu'a
    // 20 000 DT, pas de 0,001), Number(a) < Number(b) et
    // toMillimes(a) < toMillimes(b) ne divergent jamais — l'erreur relative
    // d'un double IEEE754 (~1e-16) est negligeable face a l'ecart minimal de
    // 0,001 entre deux valeurs a 3 decimales distinctes. Ce test ne prouve
    // donc pas une divergence (aucune paire de ce type n'existe pour cette
    // comparaison), mais documente que toMillimes() est bien LE chemin de
    // comparaison utilise, et qu'il gere sans erreur des formats equivalents
    // (espaces de zeros, decimales tronquees) qu'une comparaison de chaines
    // naive casserait.
    expect(
      missingForPublish({ ...complet, originalPrice: "035.000", discountPrice: "35.000" }),
    ).toEqual([]);
    expect(
      missingForPublish({ ...complet, originalPrice: "35.0", discountPrice: "35.000" }),
    ).toEqual([]);
  });

  it("accepte les Decimal de Prisma (objets avec toString)", () => {
    const decimalLike = (s: string) => ({ toString: () => s });
    expect(
      missingForPublish({
        ...complet,
        originalPrice: decimalLike("50.000"),
        discountPrice: decimalLike("35.000"),
      }),
    ).toEqual([]);
  });

  it("cumule les manques dans un ordre stable", () => {
    expect(
      missingForPublish({
        category: null,
        originalPrice: "10.000",
        discountPrice: "35.000",
        photos: [],
      }),
    ).toEqual(["catégorie", "prix barré ≥ prix actuel", "au moins une photo"]);
  });
});
