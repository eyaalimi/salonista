/**
 * Rassemble, en une seule commande, tout ce qu'il faut pour juger ou en est
 * le marketing. Rend du JSON sur la sortie standard, destine a etre LU PAR
 * L'AGENT marketing (.claude/agents/marketing.md), pas par un humain.
 *
 * NE DECIDE RIEN, NE CONSEILLE RIEN. Ce script collecte des faits ; c'est
 * l'agent qui les interprete. Melanger les deux rendrait les chiffres
 * impossibles a verifier : on ne saurait plus si une recommandation vient
 * d'une donnee ou d'une regle enfouie ici.
 *
 * REUTILISE les fonctions deja ecrites et testees (campagne-donnees.ts,
 * vue-ensemble-donnees.ts) plutot que de refaire des requetes : la
 * definition de « salon actif » ou le calcul du cout par inscrit ne doivent
 * exister qu'a UN SEUL endroit.
 *
 * Usage :
 *   npx tsx scripts/bilan-marketing.ts            # 30 derniers jours
 *   npx tsx scripts/bilan-marketing.ts 7          # 7 derniers jours
 */

import "dotenv/config";

async function main() {
  // Import differe : `dotenv/config` doit avoir pose DATABASE_URL avant que
  // src/lib/prisma.ts ne soit evalue, sinon le client part sans URL.
  const { derniersJours, entonnoir, comparerCampagnes, courbeJournaliere, salonsInscrits } =
    await import("../src/lib/campagne-donnees");
  const { vueDEnsemble } = await import("../src/lib/vue-ensemble-donnees");

  const jours = Number(process.argv[2]) || 30;
  const periode = derniersJours(jours);

  const [lignes, campagnes, courbe, salons, ensemble] = await Promise.all([
    entonnoir(periode),
    comparerCampagnes(periode),
    courbeJournaliere(periode),
    salonsInscrits(),
    vueDEnsemble(),
  ]);

  const dinars = (millimes: number | null) =>
    millimes === null ? null : Number((millimes / 1000).toFixed(3));

  console.log(
    JSON.stringify(
      {
        genereLe: new Date().toISOString(),
        periode: {
          jours,
          depuis: periode.depuis.toISOString().slice(0, 10),
          jusqua: periode.jusqua.toISOString().slice(0, 10),
        },

        // L'entonnoir : ou passe-t-on, ou perd-on du monde.
        entonnoir: lignes.map((l) => ({
          etape: l.etape,
          libelle: l.libelle,
          nombre: l.nombre,
          tauxDepuisPrecedente: l.tauxDepuisPrecedente,
          tauxDepuisDebut: l.tauxDepuisDebut,
        })),

        // Les campagnes, budget converti en dinars pour etre lisible.
        campagnes: campagnes.map((c) => ({
          nom: c.name,
          slug: c.slug,
          canal: c.channel,
          budgetDinars: dinars(c.budgetMillimes),
          clics: c.clics,
          visiteurs: c.visiteurs,
          inscriptions: c.inscriptions,
          coutParInscritDinars: dinars(c.coutParInscriptionMillimes),
        })),

        // La courbe jour par jour, pour reperer un creux ou un pic.
        courbe,

        // L'etat global du parc de salons.
        compteurs: ensemble.compteurs,

        // Qui rappeler, dans l'ordre d'urgence deja calcule.
        aRappeler: ensemble.aRappeler.map((s) => ({
          salon: s.salonName,
          ville: s.city,
          inscritLe: s.inscritLe.toISOString().slice(0, 10),
          raison: s.raison,
          joursSansVente: s.joursSansVente,
        })),

        // Tous les salons, pour croiser avec leur origine de campagne.
        salons: salons.map((s) => ({
          nom: s.salonName,
          ville: s.city,
          inscritLe: s.createdAt.toISOString().slice(0, 10),
          origine: s.campagne ?? s.utmSource ?? null,
          statut: s.statut,
          joursSansVente: s.joursDepuisDerniereVente,
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
