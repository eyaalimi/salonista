import { describe, it, expect } from "vitest";
import { buildSalonJsonLd, categoryLabel } from "./salon-jsonld";
import { emptyOpeningHours, type OpeningHours } from "./opening-hours";

const BASE = "https://salonista.tn";

const salonComplet = {
  id: "salon1",
  salonName: "Salon Amira",
  category: "COIFFURE",
  description: "Coiffure et soins a Tunis.",
  address: "12 rue de la Liberte",
  city: "Tunis",
  phone: "+21622000000",
  photos: ["/uploads/a.jpg", "/uploads/b.jpg"],
  lat: 36.8065,
  lng: 10.1815,
  openingHours: {
    ...emptyOpeningHours(),
    mon: [{ start: "09:00", end: "18:00" }],
  } as OpeningHours,
};

describe("categoryLabel", () => {
  it("traduit les six categories", () => {
    expect(categoryLabel("COIFFURE")).toBe("Coiffure");
    expect(categoryLabel("ESTHETIQUE")).toBe("Esthétique");
    expect(categoryLabel("ONGLERIE")).toBe("Onglerie");
    expect(categoryLabel("MASSAGE")).toBe("Massage");
    expect(categoryLabel("PARFUMERIE")).toBe("Parfumerie");
    expect(categoryLabel("AUTRE")).toBe("Autre");
  });

  it("renvoie la valeur brute pour une categorie inconnue", () => {
    expect(categoryLabel("NOUVEAU")).toBe("NOUVEAU");
  });
});

describe("buildSalonJsonLd", () => {
  it("produit un LocalBusiness avec le nom et l'URL", () => {
    const ld = buildSalonJsonLd(salonComplet, BASE);
    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("LocalBusiness");
    expect(ld.name).toBe("Salon Amira");
    expect(ld.url).toBe(`${BASE}/salon/salon1`);
  });

  it("absolutise les photos", () => {
    const ld = buildSalonJsonLd(salonComplet, BASE);
    expect(ld.image).toEqual([`${BASE}/uploads/a.jpg`, `${BASE}/uploads/b.jpg`]);
  });

  it("emet l'adresse avec le code pays TN", () => {
    const ld = buildSalonJsonLd(salonComplet, BASE);
    expect(ld.address).toEqual({
      "@type": "PostalAddress",
      streetAddress: "12 rue de la Liberte",
      addressLocality: "Tunis",
      addressCountry: "TN",
    });
  });

  it("emet les coordonnees geographiques", () => {
    const ld = buildSalonJsonLd(salonComplet, BASE);
    expect(ld.geo).toEqual({
      "@type": "GeoCoordinates",
      latitude: 36.8065,
      longitude: 10.1815,
    });
  });

  it("traduit lundi en Monday", () => {
    const ld = buildSalonJsonLd(salonComplet, BASE);
    expect(ld.openingHoursSpecification).toEqual([
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: "Monday",
        opens: "09:00",
        closes: "18:00",
      },
    ]);
  });

  it("traduit les sept jours dans le bon ordre", () => {
    const tousLesJours: OpeningHours = {
      mon: [{ start: "09:00", end: "10:00" }],
      tue: [{ start: "09:00", end: "10:00" }],
      wed: [{ start: "09:00", end: "10:00" }],
      thu: [{ start: "09:00", end: "10:00" }],
      fri: [{ start: "09:00", end: "10:00" }],
      sat: [{ start: "09:00", end: "10:00" }],
      sun: [{ start: "09:00", end: "10:00" }],
    };
    const ld = buildSalonJsonLd({ ...salonComplet, openingHours: tousLesJours }, BASE);
    expect(
      (ld.openingHoursSpecification as Array<{ dayOfWeek: string }>).map((s) => s.dayOfWeek),
    ).toEqual([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]);
  });

  it("produit deux entrees pour un jour a deux plages (pause dejeuner)", () => {
    const avecPause: OpeningHours = {
      ...emptyOpeningHours(),
      mon: [
        { start: "09:00", end: "12:00" },
        { start: "14:00", end: "18:00" },
      ],
    };
    const ld = buildSalonJsonLd({ ...salonComplet, openingHours: avecPause }, BASE);
    expect(ld.openingHoursSpecification).toEqual([
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: "Monday",
        opens: "09:00",
        closes: "12:00",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: "Monday",
        opens: "14:00",
        closes: "18:00",
      },
    ]);
  });

  it("n'emet pas les champs absents", () => {
    const minimal = {
      id: "salon2",
      salonName: "Salon Minimal",
      category: "AUTRE",
      description: null,
      address: null,
      city: null,
      phone: null,
      photos: [],
      lat: null,
      lng: null,
      openingHours: null,
    };
    const ld = buildSalonJsonLd(minimal, BASE);
    expect(ld.name).toBe("Salon Minimal");
    expect(ld.address).toBeUndefined();
    expect(ld.geo).toBeUndefined();
    expect(ld.telephone).toBeUndefined();
    expect(ld.image).toBeUndefined();
    expect(ld.description).toBeUndefined();
    expect(ld.openingHoursSpecification).toBeUndefined();
  });

  it("emet l'adresse meme sans rue, si la ville est connue", () => {
    const ld = buildSalonJsonLd({ ...salonComplet, address: null }, BASE);
    expect(ld.address).toEqual({
      "@type": "PostalAddress",
      addressLocality: "Tunis",
      addressCountry: "TN",
    });
  });

  it("n'emet pas geo pour des coordonnees invalides", () => {
    // (0,0) est rejete par isValidCoords : Null Island, symptome d'un
    // parsing rate. Aucun salon tunisien ne s'y trouve.
    const ld = buildSalonJsonLd({ ...salonComplet, lat: 0, lng: 0 }, BASE);
    expect(ld.geo).toBeUndefined();
  });

  it("n'emet pas de plage horaire pour un jour ferme", () => {
    const fermeSaufMardi: OpeningHours = {
      ...emptyOpeningHours(),
      tue: [{ start: "09:00", end: "18:00" }],
    };
    const ld = buildSalonJsonLd({ ...salonComplet, openingHours: fermeSaufMardi }, BASE);
    expect(ld.openingHoursSpecification).toHaveLength(1);
    expect(
      (ld.openingHoursSpecification as Array<{ dayOfWeek: string }>)[0].dayOfWeek,
    ).toBe("Tuesday");
  });
});
