/**
 * Canal WhatsApp Cloud (API officielle de Meta).
 *
 * UNIQUEMENT l'API officielle : une librairie qui pilote WhatsApp Web
 * (whatsapp-web.js, Baileys…) ferait bannir le numero du salon.
 *
 * Hors conversation ouverte par la cliente, seul un MODELE approuve peut
 * partir : {{1}} = prenom, {{2}} = offre (voir src/lib/promos.ts).
 *
 * LE JETON NE SORT JAMAIS D'ICI : il n'apparait ni dans les erreurs rendues,
 * ni dans les journaux. Les erreurs ne reprennent que `code` et `message` de
 * la reponse Meta.
 */

import { estErreurDefinitive, prenomPourModele } from "../promos";
import type { CanalPromo, ResultatEnvoi } from "./types";

const DELAI_MS = 15_000;

export type ConfigWhatsapp = {
  phoneNumberId: string;
  jeton: string;
  nomModele: string;
  langueModele: string;
  /** "v27.0" — lue dans WHATSAPP_GRAPH_VERSION, jamais codee en dur. */
  versionGraph: string;
};

export function creerCanalWhatsapp(config: ConfigWhatsapp): CanalPromo {
  return {
    async envoyer({ telephone, prenom, offre }): Promise<ResultatEnvoi> {
      const url = `https://graph.facebook.com/${encodeURIComponent(config.versionGraph)}/${encodeURIComponent(config.phoneNumberId)}/messages`;
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.jeton}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: telephone,
            type: "template",
            template: {
              name: config.nomModele,
              language: { code: config.langueModele },
              components: [
                {
                  type: "body",
                  parameters: [
                    // Jamais vide : Meta ne documente pas l'envoi d'une
                    // variable vide. « 3zizti » remplace le prenom absent.
                    { type: "text", text: prenomPourModele(prenom) },
                    { type: "text", text: offre },
                  ],
                },
              ],
            },
          }),
          signal: AbortSignal.timeout(DELAI_MS),
          cache: "no-store",
        });
      } catch (err) {
        // Reseau coupe ou delai depasse : temporaire, le moteur reessaiera.
        const delai = err instanceof Error && err.name === "TimeoutError";
        return {
          ok: false,
          code: delai ? "DELAI" : "RESEAU",
          message: delai ? "Délai de 15 s dépassé" : "Meta injoignable",
          definitive: false,
        };
      }

      const corps = (await res.json().catch(() => null)) as {
        messages?: Array<{ id?: string }>;
        error?: { code?: number | string; message?: string; error_data?: { details?: string } };
      } | null;

      const id = corps?.messages?.[0]?.id;
      if (res.ok && id) return { ok: true, messageIdExterne: id };

      const code = corps?.error?.code !== undefined ? String(corps.error.code) : `HTTP_${res.status}`;
      const message = (corps?.error?.error_data?.details || corps?.error?.message || `Réponse ${res.status}`).slice(0, 300);
      return { ok: false, code, message, definitive: estErreurDefinitive(code) };
    },
  };
}
