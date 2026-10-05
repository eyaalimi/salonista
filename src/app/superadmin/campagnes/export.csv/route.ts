/**
 * Export CSV des salons inscrits, filtre comme le tableau de bord.
 *
 * Route sous /superadmin : le middleware la couvre, et `exigerSuperadmin()`
 * revalide ici — un export contient les noms et l'activite de tous les
 * salons, il ne doit jamais fuiter.
 */

import { NextRequest } from "next/server";
import { exigerSuperadmin, reponseRefus } from "@/lib/superadmin-session";
import { derniersJours, salonsInscrits, entonnoir } from "@/lib/campagne-donnees";
import { construireCsv, LIBELLE_STATUT } from "@/lib/campagne-tableau";

export async function GET(req: NextRequest) {
  try {
    await exigerSuperadmin();
  } catch (err) {
    const r = reponseRefus(err);
    if (r) return r;
    throw err;
  }

  const jours = Number(req.nextUrl.searchParams.get("jours")) || 30;
  const campaignId = req.nextUrl.searchParams.get("campagne") || null;
  const periode = derniersJours(jours);

  const [salons, lignes] = await Promise.all([
    salonsInscrits(campaignId),
    entonnoir(periode, campaignId),
  ]);

  const csv = construireCsv(
    ["Salon", "Ville", "Inscrit le", "Origine", "Statut", "Jours depuis la dernière vente"],
    salons.map((s) => [
      s.salonName,
      s.city ?? "",
      s.createdAt.toISOString().slice(0, 10),
      s.campagne ?? s.utmSource ?? "",
      LIBELLE_STATUT[s.statut],
      s.joursDepuisDerniereVente ?? "",
    ]),
  );

  // L'entonnoir est ajoute en bas du meme fichier : ouvrir deux exports pour
  // recouper un chiffre est exactement le genre de friction qui fait qu'on ne
  // recoupe jamais.
  const resume = construireCsv(
    ["Étape", "Nombre", "% étape précédente", "% depuis le début"],
    lignes.map((l) => [l.libelle, l.nombre, l.tauxDepuisPrecedente ?? "", l.tauxDepuisDebut ?? ""]),
  );

  const nom = `salonista-campagnes-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(`${csv}\r\n\r\n${resume}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nom}"`,
      // Un export de donnees commerciales n'a rien a faire dans un cache
      // partage.
      "Cache-Control": "no-store",
    },
  });
}
