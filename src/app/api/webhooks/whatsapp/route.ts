import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { egaliteTempsConstant, lireNotification, verifierSignature } from "@/lib/webhook-whatsapp";
import { CODE_MARKETING_REFUSE, estDesinscription, statutApresEvenement } from "@/lib/promos";
import { marquerPromosRefusees } from "@/lib/promos-refus";

/**
 * Webhook WhatsApp Cloud (Meta).
 *
 * GET : verification de l'abonnement (hub.mode / hub.verify_token /
 * hub.challenge).
 *
 * POST : statuts des messages (sent / delivered / read / failed) et messages
 * entrants (« Ne plus recevoir », STOP). La SIGNATURE est verifiee sur le
 * corps brut AVANT toute lecture : sans elle, n'importe qui pourrait
 * desinscrire les clientes d'un salon ou fausser ses statistiques.
 *
 * IDEMPOTENT : Meta renvoie une notification pendant 36 h tant qu'elle n'est
 * pas acquittee, et peut livrer les evenements dans le desordre. Chaque
 * traitement peut donc etre rejoue sans effet (statut qui n'avance que vers
 * l'avant, refus deja pose ignore).
 *
 * 200 des que la notification est traitee — ces traitements sont quelques
 * ecritures. Seule une panne de base repond 500, pour que Meta reessaie
 * plutot que de perdre un evenement.
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const attendu = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (
    p.get("hub.mode") === "subscribe" &&
    attendu &&
    egaliteTempsConstant(p.get("hub.verify_token") ?? "", attendu)
  ) {
    return new Response(p.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("Interdit", { status: 403 });
}

export async function POST(req: NextRequest) {
  const brut = await req.text();
  if (!verifierSignature(brut, req.headers.get("x-hub-signature-256"), process.env.WHATSAPP_APP_SECRET)) {
    return new Response("Signature invalide", { status: 401 });
  }

  let corps: unknown;
  try {
    corps = JSON.parse(brut);
  } catch {
    return new Response("OK", { status: 200 });
  }
  const { statuts, messages } = lireNotification(corps);

  try {
    for (const s of statuts) {
      const d = await prisma.destinatairePromo.findUnique({
        where: { messageIdExterne: s.messageId },
        select: { id: true, statut: true, telephone: true, campagne: { select: { providerId: true } } },
      });
      if (!d) continue;
      const nouveau = statutApresEvenement(d.statut, s.statut);
      if (nouveau) {
        await prisma.destinatairePromo.updateMany({
          // Condition sur l'ancien statut : deux notifications traitees en
          // parallele ne s'ecrasent pas.
          where: { id: d.id, statut: d.statut },
          data: {
            statut: nouveau,
            ...(nouveau === "ECHEC"
              ? { erreur: `${s.codeErreur ?? "?"} — ${s.messageErreur ?? "échec signalé par WhatsApp"}`.slice(0, 500) }
              : {}),
          },
        });
      }
      if (s.statut === "failed" && s.codeErreur === CODE_MARKETING_REFUSE) {
        await marquerPromosRefusees(d.campagne.providerId, d.telephone);
      }
    }

    for (const m of messages) {
      if (!estDesinscription(m.texte)) continue;
      const connexion = await prisma.connexionWhatsapp.findFirst({
        where: { phoneNumberId: m.phoneNumberId },
        select: { providerId: true },
      });
      if (connexion) await marquerPromosRefusees(connexion.providerId, m.de);
    }
  } catch (err) {
    console.error("[webhook-whatsapp] traitement:", err instanceof Error ? err.message : "erreur");
    return new Response("Erreur", { status: 500 });
  }

  return new Response("OK", { status: 200 });
}
