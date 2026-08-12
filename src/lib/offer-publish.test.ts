import { describe, it, expect } from "vitest";
import { missingForPublish } from "./offer-publish";

describe("missingForPublish", () => {
  const complet = {
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

  it("accepte un prix barre absent — la promotion est facultative", () => {
    expect(missingForPublish({ ...complet, originalPrice: null })).toEqual([]);
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

  it("compare les prix en millimes, sans derive flottante", () => {
    // 0.1 + 0.2 === 0.30000000000000004 en flottant : la comparaison doit
    // passer par des entiers pour que 0.300 barre 0.300 soit accepte.
    expect(
      missingForPublish({ ...complet, originalPrice: "0.300", discountPrice: "0.300" }),
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
