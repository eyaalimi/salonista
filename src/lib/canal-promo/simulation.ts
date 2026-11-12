/**
 * Canal SIMULATION : ne contacte personne. Sert en developpement et pour les
 * demonstrations, quand PROMOS_SIMULATION=1 et que le salon n'a pas de
 * connexion WhatsApp. Rend un identifiant factice, que le webhook ne verra
 * jamais arriver — les destinataires restent donc « Envoye ».
 */

import { randomUUID } from "node:crypto";
import type { CanalPromo } from "./types";

export function creerCanalSimulation(): CanalPromo {
  return {
    async envoyer({ telephone }) {
      // Le numero est masque : un journal n'a pas a contenir la clientele.
      console.info(`[promos:simulation] envoi simulé vers …${telephone.slice(-3)}`);
      return { ok: true, messageIdExterne: `wamid.SIMULATION.${randomUUID()}` };
    },
  };
}
