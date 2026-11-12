import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  exigerSuperadmin,
  journaliser,
  reponseMotifManquant,
  reponseRefus,
} from "@/lib/superadmin-session";
import { ACTIONS } from "@/lib/support-salon";
import { canalDepuisConnexion } from "@/lib/canal-promo";
import { telephonePourWhatsapp } from "@/lib/promos";

/**
 * POST { telephone, motif } — envoie UN message de test avec le modele du
 * salon, quel que soit le statut de la connexion : c'est justement le moyen
 * de verifier une connexion en BROUILLON avant de l'activer.
 *
 * Le message est REEL et facture par Meta. La reponse ne contient que le
 * resultat (identifiant Meta, ou code et message d'erreur), jamais le jeton.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let moi;
  try {
    moi = await exigerSuperadmin();
  } catch (err) {
    const r = reponseRefus(err);
    if (r) return r;
    throw err;
  }
  const { id } = await params;
  const corps = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const telephone = telephonePourWhatsapp(typeof corps.telephone === "string" ? corps.telephone : "");
  if (!telephone) return Response.json({ error: "Numéro tunisien invalide." }, { status: 400 });

  const connexion = await prisma.connexionWhatsapp.findUnique({ where: { providerId: id }, select: { id: true } });
  if (!connexion) return Response.json({ error: "Aucune connexion enregistrée pour ce salon." }, { status: 404 });

  try {
    await journaliser({
      acteur: moi,
      action: ACTIONS.WHATSAPP_TEST,
      motif: typeof corps.motif === "string" ? corps.motif : "",
      targetProviderId: id,
      req,
      metadata: { destinataire: `…${telephone.slice(-3)}` },
    });
  } catch (err) {
    const r = reponseMotifManquant(err);
    if (r) return r;
    throw err;
  }

  let canal;
  try {
    canal = await canalDepuisConnexion(id);
  } catch {
    return Response.json({ error: "Jeton illisible : ressaisissez-le (la clé de chiffrement a changé ?)." }, { status: 500 });
  }
  if (!canal) {
    return Response.json(
      { error: "Configuration serveur incomplète : CLE_CHIFFREMENT_SECRETS ou WHATSAPP_GRAPH_VERSION." },
      { status: 503 },
    );
  }

  const resultat = await canal.envoyer({
    telephone,
    prenom: "Test",
    offre: "Ceci est un message de test envoyé depuis Salonista.",
  });
  return Response.json(resultat, { status: resultat.ok ? 200 : 502 });
}
