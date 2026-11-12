/**
 * Webhook WhatsApp Cloud — verification de signature et lecture du corps.
 * Pur (node:crypto seulement), donc teste sans serveur.
 *
 * Meta signe chaque notification : en-tete `X-Hub-Signature-256:
 * sha256=<hex>`, HMAC-SHA256 du corps BRUT avec le secret de l'application
 * (WHATSAPP_APP_SECRET). « Brut » compte : re-serialiser un JSON parse change
 * les espaces et casse la signature. La route lit donc `req.text()` avant
 * tout `JSON.parse`.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Egalite en temps constant. Une comparaison `===` s'arrete au premier
 * caractere different : en mesurant le temps de reponse, on devinerait un
 * secret caractere par caractere.
 */
export function egaliteTempsConstant(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) {
    // Comparer quand meme, pour ne pas trahir la longueur par le temps.
    timingSafeEqual(ba, ba);
    return false;
  }
  return timingSafeEqual(ba, bb);
}

export function verifierSignature(
  corpsBrut: string,
  entete: string | null | undefined,
  secret: string | undefined,
): boolean {
  if (!secret || !entete || !entete.startsWith("sha256=")) return false;
  const attendu = createHmac("sha256", secret).update(corpsBrut, "utf8").digest("hex");
  return egaliteTempsConstant(entete.slice("sha256=".length).toLowerCase(), attendu);
}

/** `Authorization: Bearer <CRON_SECRET>` du moteur d'envoi. */
export function verifierBearer(entete: string | null | undefined, secret: string | undefined): boolean {
  if (!secret || !entete || !entete.startsWith("Bearer ")) return false;
  return egaliteTempsConstant(entete.slice("Bearer ".length), secret);
}

export type EvenementStatut = {
  messageId: string;
  statut: string;
  codeErreur: string | null;
  messageErreur: string | null;
};

export type EvenementMessage = {
  phoneNumberId: string;
  /** Numero de la cliente, chiffres seuls avec indicatif (format Meta). */
  de: string;
  /** Texte du bouton (`button.text`) ou du message (`text.body`). */
  texte: string | null;
};

/**
 * Extrait les statuts et les messages entrants d'une notification Meta.
 * Tolerant : un champ manquant fait ignorer l'element, jamais planter la
 * route — Meta reessaie pendant 36 h une notification qu'on n'acquitte pas.
 *
 * Les reponses de bouton arrivent en `type: "button"` (`button.text`) ;
 * les boutons interactifs en `interactive.button_reply.title`. On accepte
 * les trois formes, plus le texte libre.
 */
export function lireNotification(corps: unknown): {
  statuts: EvenementStatut[];
  messages: EvenementMessage[];
} {
  const statuts: EvenementStatut[] = [];
  const messages: EvenementMessage[] = [];
  const entries = (corps as { entry?: unknown[] } | null)?.entry;
  if (!Array.isArray(entries)) return { statuts, messages };

  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const value = (change as { value?: Record<string, unknown> })?.value;
      if (!value) continue;
      const phoneNumberId = String(
        (value.metadata as { phone_number_id?: unknown } | undefined)?.phone_number_id ?? "",
      );

      for (const s of Array.isArray(value.statuses) ? value.statuses : []) {
        const st = s as { id?: unknown; status?: unknown; errors?: Array<{ code?: unknown; title?: unknown; message?: unknown }> };
        if (typeof st.id !== "string" || typeof st.status !== "string") continue;
        const err = Array.isArray(st.errors) ? st.errors[0] : undefined;
        statuts.push({
          messageId: st.id,
          statut: st.status,
          codeErreur: err?.code !== undefined ? String(err.code) : null,
          messageErreur: err ? String(err.message ?? err.title ?? "") || null : null,
        });
      }

      for (const m of Array.isArray(value.messages) ? value.messages : []) {
        const msg = m as {
          from?: unknown;
          type?: unknown;
          text?: { body?: unknown };
          button?: { text?: unknown; payload?: unknown };
          interactive?: { button_reply?: { title?: unknown } };
        };
        if (typeof msg.from !== "string" || !phoneNumberId) continue;
        const texte =
          msg.type === "button"
            ? String(msg.button?.text ?? msg.button?.payload ?? "")
            : msg.type === "interactive"
              ? String(msg.interactive?.button_reply?.title ?? "")
              : msg.type === "text"
                ? String(msg.text?.body ?? "")
                : "";
        messages.push({ phoneNumberId, de: msg.from.replace(/\D/g, ""), texte: texte || null });
      }
    }
  }
  return { statuts, messages };
}
