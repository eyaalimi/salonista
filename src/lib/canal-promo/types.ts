/**
 * Un canal d'envoi de promos. WhatsApp aujourd'hui ; le SMS viendra s'y
 * brancher sans toucher au moteur, qui ne connait que cette interface.
 */
export type ResultatEnvoi =
  | { ok: true; messageIdExterne: string }
  | { ok: false; code: string; message: string; definitive: boolean };

export interface CanalPromo {
  envoyer(args: { telephone: string; prenom: string | null; offre: string }): Promise<ResultatEnvoi>;
}
