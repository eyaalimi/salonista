/**
 * Avancement du demarrage d'un salon inscrit seul.
 *
 * Chaque etape est calculee depuis les DONNEES REELLES, jamais depuis un
 * drapeau pose a la main : un salon qui a rempli son profil avant de lire le
 * guide doit voir l'etape deja cochee. Un drapeau se desynchronise, une
 * donnee non.
 */

export type ProfilSalon = {
  address: string | null;
  city: string | null;
  photos: string[];
  openingHours: unknown;
};

export type EtapeDemarrage = {
  titre: string;
  aide: string;
  href: string;
  faite: boolean;
};

function rempli(valeur: string | null): boolean {
  return typeof valeur === "string" && valeur.trim().length > 0;
}

function horairesRenseignes(openingHours: unknown): boolean {
  if (!openingHours || typeof openingHours !== "object") return false;
  return Object.keys(openingHours as Record<string, unknown>).length > 0;
}

export function etapesDemarrage(
  profil: ProfilSalon,
  nombreOffres: number,
): EtapeDemarrage[] {
  return [
    {
      titre: "Complète ton profil",
      aide: "Ton adresse, ta ville et une photo : c'est ce que voient les clientes.",
      href: "/pos/settings",
      faite:
        rempli(profil.address) && rempli(profil.city) && profil.photos.length > 0,
    },
    {
      titre: "Ajoute ton premier service",
      aide: "Une coupe, un soin, un massage — avec son prix et sa durée.",
      href: "/pos/services",
      faite: nombreOffres > 0,
    },
    {
      // Sans horaires, aucun creneau n'est genere : le salon se croit en ligne
      // alors que personne ne peut reserver. C'est le piege le plus couteux du
      // parcours, d'ou sa presence comme etape a part entiere.
      titre: "Définis tes horaires",
      aide: "Sans eux, aucune cliente ne peut réserver.",
      href: "/pos/settings",
      faite: horairesRenseignes(profil.openingHours),
    },
  ];
}

export function demarrageTermine(
  profil: ProfilSalon,
  nombreOffres: number,
): boolean {
  return etapesDemarrage(profil, nombreOffres).every((e) => e.faite);
}
