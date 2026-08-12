import { toMillimes, type Money } from "@/lib/money";

/**
 * Etat d'une offre du point de vue de la publication sur le feed public.
 * Volontairement structurel (pas de type Prisma) pour que ce module reste
 * importable par vitest sans initialiser Prisma — cf. src/lib/verify-authz.ts,
 * meme contrainte.
 */
export type PublishCandidate = {
  category: string | null | undefined;
  originalPrice: Money | null | undefined;
  discountPrice: Money;
  photos: string[] | null | undefined;
};

/**
 * Liste, en francais, ce qui empeche de publier cette offre sur salonista.tn.
 * Tableau vide = publiable.
 *
 * Le prix barre est FACULTATIF : un salon peut publier au prix plein, sans
 * promotion. On ne le valide que s'il est fourni, et seulement pour refuser
 * l'incoherence d'affichage "barre 20 DT / paye 35 DT".
 *
 * La photo, elle, est obligatoire : le feed filtre sur photos.isEmpty, donc
 * publier sans photo produirait un statut mensonger (marque "en ligne", jamais
 * visible).
 */
export function missingForPublish(offer: PublishCandidate): string[] {
  const missing: string[] = [];

  if (!offer.category) {
    missing.push("catégorie");
  }

  if (offer.originalPrice != null) {
    // Comparaison en millimes entiers : le dinar a 3 decimales et la
    // comparaison flottante derive (cf. src/lib/money.ts).
    if (toMillimes(offer.originalPrice) < toMillimes(offer.discountPrice)) {
      missing.push("prix barré ≥ prix actuel");
    }
  }

  if (!offer.photos || offer.photos.length === 0) {
    missing.push("au moins une photo");
  }

  return missing;
}
