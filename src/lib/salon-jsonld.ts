import { DAY_KEYS, type DayKey, type OpeningHours } from "@/lib/opening-hours";
import { isValidCoords } from "@/lib/coords";

/**
 * Traduction d'un profil salon vers Schema.org LocalBusiness.
 *
 * Pas d'import Prisma ici — le module doit rester chargeable par vitest
 * (cf. src/lib/verify-authz.ts, meme contrainte).
 */

/** Profil reduit a ce qui sert au balisage. */
export type SalonForJsonLd = {
  id: string;
  salonName: string;
  category: string;
  description: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  photos: string[];
  lat: number | null;
  lng: number | null;
  openingHours: OpeningHours | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  COIFFURE: "Coiffure",
  ESTHETIQUE: "Esthétique",
  ONGLERIE: "Onglerie",
  MASSAGE: "Massage",
  PARFUMERIE: "Parfumerie",
  AUTRE: "Autre",
};

/**
 * Libelle francais d'une categorie.
 *
 * Une categorie inconnue est renvoyee telle quelle plutot que remplacee par
 * "Autre" : si l'enum gagne une valeur, mieux vaut un libelle brut visible
 * qu'un mensonge silencieux.
 */
export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

/** Schema.org attend les jours en anglais ; on stocke des cles courtes. */
const DAY_SCHEMA: Record<DayKey, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

type OpeningSpec = {
  "@type": "OpeningHoursSpecification";
  dayOfWeek: string;
  opens: string;
  closes: string;
};

/**
 * Objet JSON-LD LocalBusiness pour un salon.
 *
 * Chaque champ est conditionnel : un balisage qui decrit des donnees absentes
 * est penalise par Google, pas recompense. Un salon sans adresse n'emet pas
 * d'address vide.
 *
 * `baseUrl` sert a absolutiser les URLs : Schema.org veut des URLs completes,
 * or les photos sont stockees en chemins relatifs (/uploads/...).
 */
export function buildSalonJsonLd(
  salon: SalonForJsonLd,
  baseUrl: string,
): Record<string, unknown> {
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: salon.salonName,
    url: `${baseUrl}/salon/${salon.id}`,
  };

  if (salon.description?.trim()) {
    ld.description = salon.description.trim();
  }

  if (salon.photos.length > 0) {
    ld.image = salon.photos.map((p) => (p.startsWith("http") ? p : `${baseUrl}${p}`));
  }

  if (salon.phone?.trim()) {
    ld.telephone = salon.phone.trim();
  }

  // La ville suffit a produire une adresse utile : un salon sans numero de rue
  // reste localisable, et Google accepte une PostalAddress partielle.
  if (salon.city?.trim() || salon.address?.trim()) {
    const addr: Record<string, string> = { "@type": "PostalAddress" };
    if (salon.address?.trim()) addr.streetAddress = salon.address.trim();
    if (salon.city?.trim()) addr.addressLocality = salon.city.trim();
    addr.addressCountry = "TN";
    ld.address = addr;
  }

  if (
    salon.lat !== null &&
    salon.lng !== null &&
    isValidCoords(salon.lat, salon.lng)
  ) {
    ld.geo = {
      "@type": "GeoCoordinates",
      latitude: salon.lat,
      longitude: salon.lng,
    };
  }

  if (salon.openingHours) {
    const specs: OpeningSpec[] = [];
    // DAY_KEYS garantit l'ordre lundi -> dimanche ; iterer sur les cles de
    // l'objet donnerait un ordre dependant de l'insertion.
    for (const day of DAY_KEYS) {
      for (const range of salon.openingHours[day] ?? []) {
        specs.push({
          "@type": "OpeningHoursSpecification",
          dayOfWeek: DAY_SCHEMA[day],
          opens: range.start,
          closes: range.end,
        });
      }
    }
    if (specs.length > 0) {
      ld.openingHoursSpecification = specs;
    }
  }

  return ld;
}
