import { NextRequest } from "next/server";
import { verifierBearer } from "@/lib/webhook-whatsapp";
import { passerMoteur } from "@/lib/promos-moteur";

/**
 * POST — un passage du moteur d'envoi. Appele chaque minute par le cron du
 * serveur (scripts/deploy/promos-tick.sh), en local sur le port 3000.
 *
 * `Authorization: Bearer ${CRON_SECRET}`, compare a temps constant. Sans
 * CRON_SECRET configure, la route refuse tout : mieux vaut un moteur arrete
 * qu'un moteur declenchable par n'importe qui.
 */
export async function POST(req: NextRequest) {
  if (!verifierBearer(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ error: "Non autorisé" }, { status: 401 });
  }
  const bilan = await passerMoteur();
  return Response.json(bilan);
}
