/**
 * Choix du canal d'un salon.
 *
 * - Connexion WhatsApp ACTIVE (+ cle de chiffrement + version Graph) :
 *   canal reel.
 * - Salon de DEMONSTRATION sans connexion, avec PROMOS_SIMULATION=1 :
 *   simulation. Un vrai salon, jamais (voir `modePromos`).
 * - Sinon : liens wa.me, envoyes a la main par la gerante. Aucun canal
 *   automatique : le moteur ne touche pas ces campagnes.
 *
 * JAMAIS de canal reel si la connexion n'est pas ACTIVE. Et une connexion en
 * brouillon ne bascule pas en simulation : les fondateurs sont en train de la
 * saisir, mieux vaut un « pas encore connecte » franc qu'un faux envoi.
 */

import { prisma } from "@/lib/prisma";
import { cleChiffrementPresente, dechiffrer } from "@/lib/chiffrement";
import { creerCanalSimulation } from "./simulation";
import { creerCanalWhatsapp } from "./whatsapp-cloud";
import { TEXTE_FIN_LIEN, modePromos, type ModePromos } from "@/lib/promos";
import type { CanalPromo } from "./types";

export type { CanalPromo, ResultatEnvoi } from "./types";
export { creerCanalSimulation, creerCanalWhatsapp };

export type { ModePromos };

export function simulationActivee(): boolean {
  return process.env.PROMOS_SIMULATION === "1";
}

/**
 * Ce que l'ecran doit savoir du canal — SANS le jeton, qui n'est meme pas lu.
 */
export async function etatPromos(providerId: string): Promise<{
  mode: ModePromos;
  numeroAffiche: string | null;
  prixMessageDT: string | null;
  texteFinModele: string;
  /** Mode WHATSAPP mais configuration serveur incomplete. */
  configIncomplete: boolean;
}> {
  const [c, salon] = await Promise.all([
    prisma.connexionWhatsapp.findUnique({
      where: { providerId },
      select: { statut: true, numeroAffiche: true, prixMessageDT: true, texteFinModele: true },
    }),
    prisma.providerProfile.findUnique({ where: { id: providerId }, select: { demo: true } }),
  ]);
  const mode = modePromos({
    statutConnexion: c?.statut ?? null,
    simulationActivee: simulationActivee(),
    salonDemo: salon?.demo === true,
  });
  if (mode === "WHATSAPP" && c) {
    return {
      mode: "WHATSAPP",
      numeroAffiche: c.numeroAffiche,
      prixMessageDT: c.prixMessageDT ? String(c.prixMessageDT) : null,
      texteFinModele: c.texteFinModele,
      configIncomplete: !cleChiffrementPresente() || !process.env.WHATSAPP_GRAPH_VERSION,
    };
  }
  if (mode === "SIMULATION") {
    return {
      mode: "SIMULATION",
      numeroAffiche: null,
      prixMessageDT: null,
      texteFinModele: "Nestanewk 3andna 💖",
      configIncomplete: false,
    };
  }
  // Liens wa.me : gratuit, depuis le WhatsApp du salon (voir `modePromos`).
  return { mode: "LIEN", numeroAffiche: null, prixMessageDT: null, texteFinModele: TEXTE_FIN_LIEN, configIncomplete: false };
}

/** Canal reel a partir d'une connexion, quel que soit son statut (envoi de test). */
export async function canalDepuisConnexion(providerId: string): Promise<CanalPromo | null> {
  const c = await prisma.connexionWhatsapp.findUnique({ where: { providerId } });
  const version = process.env.WHATSAPP_GRAPH_VERSION;
  if (!c || !version || !cleChiffrementPresente()) return null;
  return creerCanalWhatsapp({
    phoneNumberId: c.phoneNumberId,
    jeton: dechiffrer(c.jetonChiffre),
    nomModele: c.nomModele,
    langueModele: c.langueModele,
    versionGraph: version,
  });
}

/**
 * Le canal d'une CAMPAGNE. Le canal enregistre a sa creation fait foi : une
 * campagne de demonstration ne part JAMAIS en reel, meme si le salon est
 * connecte entre-temps ; une campagne WhatsApp ne part que si la connexion
 * est toujours ACTIVE.
 */
export async function obtenirCanal(
  providerId: string,
  canalCampagne: "WHATSAPP" | "SIMULATION" | "LIEN",
): Promise<CanalPromo | null> {
  if (canalCampagne === "SIMULATION") return creerCanalSimulation();
  // Une campagne par liens n'a pas de canal automatique : c'est la gerante
  // qui envoie. (Le moteur ne la reserve d'ailleurs jamais.)
  if (canalCampagne === "LIEN") return null;
  const c = await prisma.connexionWhatsapp.findUnique({
    where: { providerId },
    select: { statut: true },
  });
  if (c?.statut !== "ACTIVE") return null;
  return canalDepuisConnexion(providerId);
}
