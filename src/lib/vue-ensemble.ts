/**
 * La vue d'ensemble — les decisions, sans la base.
 *
 * Ne recalcule rien de ce qui existe deja : `estActif` et `statutSalon`
 * vivent dans `campagne-tableau.ts`, et c'est la que se trouve la definition
 * de « salon actif ». Ce fichier ne fait que les AGREGER.
 */

import { estActif, type SignesDeVie } from "./campagne-tableau";

/** Un salon, reduit a ce qui sert aux compteurs. */
export type SalonPourCompteurs = SignesDeVie & {
  id: string;
  inscritLe: Date;
  suspendu: boolean;
};

/** Les chiffres de la page d'accueil. */
export type Compteurs = {
  total: number;
  /** Suspendus — comptes dans le total, mais signales a part. */
  suspendus: number;
  nouveauxCetteSemaine: number;
  actifsAujourdhui: number;
  actifs7j: number;
  actifs30j: number;
  /**
   * Inscrits qui n'ont JAMAIS encaisse. Le chiffre qui compte le plus au
   * lancement : un salon qui s'inscrit sans jamais vendre n'est pas un client,
   * c'est un prospect perdu qu'on peut encore rattraper.
   */
  jamaisVendu: number;
  /**
   * Ont vendu, puis se sont tus. A rappeler — la perte est plus grave que
   * pour un salon qui n'a jamais commence : celui-la connait le produit.
   */
  devenusInactifs: number;
};

/**
 * Seuil au-dela duquel un salon est « devenu inactif ».
 *
 * 14 jours : un salon de beaute ouvre au moins une fois par semaine. Deux
 * semaines sans la moindre vente ni connexion, ce n'est plus un creux, c'est
 * un abandon. Sept jours declencherait de fausses alertes a chaque conge.
 */
export const SEUIL_INACTIF_JOURS = 14;

export function calculerCompteurs(
  salons: SalonPourCompteurs[],
  maintenant: Date = new Date(),
): Compteurs {
  const debutJour = new Date(maintenant);
  debutJour.setHours(0, 0, 0, 0);

  const ilYa = (jours: number) => {
    const d = new Date(maintenant);
    d.setDate(d.getDate() - jours);
    return d;
  };

  const il7 = ilYa(7);
  const il30 = ilYa(30);
  const seuilInactif = ilYa(SEUIL_INACTIF_JOURS);

  const c: Compteurs = {
    total: salons.length,
    suspendus: 0,
    nouveauxCetteSemaine: 0,
    actifsAujourdhui: 0,
    actifs7j: 0,
    actifs30j: 0,
    jamaisVendu: 0,
    devenusInactifs: 0,
  };

  for (const s of salons) {
    if (s.suspendu) c.suspendus++;
    if (s.inscritLe >= il7) c.nouveauxCetteSemaine++;
    if (estActif(s, debutJour, maintenant)) c.actifsAujourdhui++;
    if (estActif(s, il7, maintenant)) c.actifs7j++;
    if (estActif(s, il30, maintenant)) c.actifs30j++;

    if (s.derniereVenteAt === null) {
      c.jamaisVendu++;
    } else if (s.derniereVenteAt < seuilInactif) {
      /*
       * « Devenu inactif » exige d'avoir vendu AU MOINS UNE FOIS. Un salon
       * qui n'a jamais encaisse est deja compte dans `jamaisVendu` : le
       * compter aussi ici melangerait deux problemes tres differents, et
       * deux conversations tres differentes au telephone.
       */
      c.devenusInactifs++;
    }
  }

  return c;
}

/** Un salon a rappeler, avec la raison. */
export type SalonARappeler = {
  id: string;
  salonName: string;
  city: string | null;
  inscritLe: Date;
  derniereVenteAt: Date | null;
  joursSansVente: number | null;
  raison: "jamais-vendu" | "devenu-inactif";
};

/**
 * Les salons a rappeler, les plus urgents d'abord.
 *
 * ORDRE DELIBERE : les « jamais vendu » RECENTS passent devant. Un salon
 * inscrit il y a trois jours qui n'a pas encore encaisse se rattrape d'un
 * appel ; celui d'il y a six mois est probablement perdu. Trier par anciennete
 * decroissante mettrait les causes perdues en haut de la liste.
 */
export function salonsARappeler(
  salons: Array<SalonPourCompteurs & { salonName: string; city: string | null }>,
  maintenant: Date = new Date(),
  limite = 50,
): SalonARappeler[] {
  const seuil = new Date(maintenant);
  seuil.setDate(seuil.getDate() - SEUIL_INACTIF_JOURS);

  const sortie: SalonARappeler[] = [];

  for (const s of salons) {
    // Un salon suspendu n'est pas a rappeler pour inactivite : son inactivite
    // est notre decision, pas son abandon.
    if (s.suspendu) continue;

    const jours =
      s.derniereVenteAt === null
        ? null
        : Math.floor((maintenant.getTime() - s.derniereVenteAt.getTime()) / 86_400_000);

    if (s.derniereVenteAt === null) {
      sortie.push({
        id: s.id,
        salonName: s.salonName,
        city: s.city,
        inscritLe: s.inscritLe,
        derniereVenteAt: null,
        joursSansVente: null,
        raison: "jamais-vendu",
      });
    } else if (s.derniereVenteAt < seuil) {
      sortie.push({
        id: s.id,
        salonName: s.salonName,
        city: s.city,
        inscritLe: s.inscritLe,
        derniereVenteAt: s.derniereVenteAt,
        joursSansVente: jours,
        raison: "devenu-inactif",
      });
    }
  }

  return sortie
    .sort((a, b) => {
      // Les « jamais vendu » d'abord, et parmi eux les plus RECENTS.
      if (a.raison !== b.raison) return a.raison === "jamais-vendu" ? -1 : 1;
      if (a.raison === "jamais-vendu") {
        return b.inscritLe.getTime() - a.inscritLe.getTime();
      }
      // Les « devenus inactifs » : le silence le plus court en premier, c'est
      // celui qu'on peut encore rattraper.
      return (a.joursSansVente ?? 0) - (b.joursSansVente ?? 0);
    })
    .slice(0, limite);
}

export const LIBELLE_RAISON: Record<SalonARappeler["raison"], string> = {
  "jamais-vendu": "Jamais encaissé",
  "devenu-inactif": "Devenu inactif",
};
