import { describe, it, expect } from "vitest";
import { buildOfferJsonLd, type OfferForJsonLd } from "./offer-jsonld";

const BASE = "https://salonista.tn";

const offreComplete: OfferForJsonLd = {
  id: "offre1",
  title: "Balayage / Mèches",
  description: "Balayage sur cheveux longs.",
  discountPrice: "120.000",
  originalPrice: "160.000",
  category: "COIFFURE",
  photos: ["/uploads/a.jpg"],
  salonName: "Salon Ayou",
  freeSlotCount: 12,
  reviewCount: 0,
  avgRating: 0,
};

describe("buildOfferJsonLd", () => {
  it("produit un Product avec le nom et la marque du salon", () => {
    const ld = buildOfferJsonLd(offreComplete, BASE);
    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("Product");
    expect(ld.name).toBe("Balayage / Mèches");
    expect(ld.brand).toEqual({ "@type": "Brand", name: "Salon Ayou" });
  });

  it("balise le prix PAYE, pas le prix barre", () => {
    const ld = buildOfferJsonLd(offreComplete, BASE);
    const offers = ld.offers as Record<string, unknown>;
    expect(offers.price).toBe("120.000");
    expect(JSON.stringify(ld)).not.toContain("160.000");
  });

  it("transmet le prix en chaine, pas en nombre", () => {
    // Le dinar a 3 decimales : un flottant deriverait a l'affichage.
    const ld = buildOfferJsonLd(offreComplete, BASE);
    const offers = ld.offers as Record<string, unknown>;
    expect(typeof offers.price).toBe("string");
  });

  it("utilise la devise TND", () => {
    const ld = buildOfferJsonLd(offreComplete, BASE);
    const offers = ld.offers as Record<string, unknown>;
    expect(offers.priceCurrency).toBe("TND");
  });

  it("annonce InStock quand il reste des creneaux", () => {
    const ld = buildOfferJsonLd(offreComplete, BASE);
    const offers = ld.offers as Record<string, unknown>;
    expect(offers.availability).toBe("https://schema.org/InStock");
  });

  it("annonce OutOfStock sans creneau libre", () => {
    const ld = buildOfferJsonLd({ ...offreComplete, freeSlotCount: 0 }, BASE);
    const offers = ld.offers as Record<string, unknown>;
    expect(offers.availability).toBe("https://schema.org/OutOfStock");
  });

  it("absolutise l'URL de l'offre et les photos", () => {
    const ld = buildOfferJsonLd(offreComplete, BASE);
    const offers = ld.offers as Record<string, unknown>;
    expect(offers.url).toBe(`${BASE}/offre/offre1`);
    expect(ld.image).toEqual([`${BASE}/uploads/a.jpg`]);
  });

  it("traduit la categorie en libelle francais", () => {
    const ld = buildOfferJsonLd(offreComplete, BASE);
    expect(ld.category).toBe("Coiffure");
  });

  it("n'emet PAS aggregateRating sans avis", () => {
    // Une note de 0 sur zero avis est une violation des regles Google.
    const ld = buildOfferJsonLd(offreComplete, BASE);
    expect(ld.aggregateRating).toBeUndefined();
  });

  it("emet aggregateRating des qu'il y a un avis", () => {
    const ld = buildOfferJsonLd(
      { ...offreComplete, reviewCount: 3, avgRating: 4.5 },
      BASE,
    );
    expect(ld.aggregateRating).toEqual({
      "@type": "AggregateRating",
      ratingValue: "4.5",
      reviewCount: 3,
      bestRating: "5",
      worstRating: "1",
    });
  });

  it("n'emet pas les champs absents", () => {
    const minimal: OfferForJsonLd = {
      id: "offre2",
      title: "Coupe",
      description: null,
      discountPrice: "30.000",
      originalPrice: null,
      category: "AUTRE",
      photos: [],
      salonName: "Salon Minimal",
      freeSlotCount: 0,
      reviewCount: 0,
      avgRating: 0,
    };
    const ld = buildOfferJsonLd(minimal, BASE);
    expect(ld.description).toBeUndefined();
    expect(ld.image).toBeUndefined();
    expect(ld.aggregateRating).toBeUndefined();
    expect(ld.name).toBe("Coupe");
  });

  it("pose une date de validite du prix dans le futur", () => {
    const ld = buildOfferJsonLd(offreComplete, BASE);
    const offers = ld.offers as Record<string, unknown>;
    const validite = new Date(offers.priceValidUntil as string);
    expect(validite.getTime()).toBeGreaterThan(Date.now());
  });
});
