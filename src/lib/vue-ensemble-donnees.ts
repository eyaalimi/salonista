/**
 * Lecture de la vue d'ensemble — l'adaptateur Prisma.
 *
 * Les calculs vivent dans `vue-ensemble.ts` (pur, 17 tests). Ici on ne fait
 * que lire la base et appeler ces fonctions.
 */

import { prisma } from "./prisma";
import { signesDeVieParSalon } from "./campagne-donnees";
import {
  calculerCompteurs,
  salonsARappeler,
  type Compteurs,
  type SalonARappeler,
} from "./vue-ensemble";

/**
 * Tout ce qu'affiche la page d'accueil, en une seule lecture.
 *
 * `signesDeVieParSalon` fait deja deux agregats (derniere vente, derniere
 * connexion) pour TOUS les salons d'un coup : on le reutilise plutot que de
 * refaire une requete par salon, qui ne poserait pas de probleme a 18 salons
 * mais en poserait a 2 000.
 */
export async function vueDEnsemble(): Promise<{
  compteurs: Compteurs;
  aRappeler: SalonARappeler[];
}> {
  const [salons, signes] = await Promise.all([
    prisma.providerProfile.findMany({
      select: {
        id: true,
        salonName: true,
        city: true,
        createdAt: true,
        suspendedAt: true,
      },
    }),
    signesDeVieParSalon(),
  ]);

  const enrichis = salons.map((s) => {
    const sv = signes.get(s.id) ?? {
      derniereVenteAt: null,
      derniereConnexionAt: null,
    };
    return {
      id: s.id,
      salonName: s.salonName,
      city: s.city,
      inscritLe: s.createdAt,
      suspendu: s.suspendedAt !== null,
      derniereVenteAt: sv.derniereVenteAt,
      derniereConnexionAt: sv.derniereConnexionAt,
    };
  });

  return {
    compteurs: calculerCompteurs(enrichis),
    aRappeler: salonsARappeler(enrichis),
  };
}
