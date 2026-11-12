/**
 * Moteur d'envoi des promos — un « passage ».
 *
 * SANS FILE D'ATTENTE EXTERNE (pas de Redis sur le serveur) : la base EST la
 * file. Un passage est declenche chaque minute par le cron
 * (`/api/internal/promos/tick`) et une fois juste apres la creation d'une
 * campagne. Jamais d'envoi dans la requete HTTP de la caisse.
 *
 * DEUX PASSAGES SIMULTANES N'ENVOIENT JAMAIS DEUX FOIS. La reservation est
 * UNE requete SQL : `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED)`
 * qui passe les lignes en RESERVE. Un second passage saute les lignes
 * verrouillees par le premier, puis ne les voit plus (elles ne sont plus
 * EN_ATTENTE). Le verrou ne dure que cette requete ; l'envoi, lui, se fait
 * hors transaction, ce qui evite de garder des verrous pendant 60 appels
 * reseau.
 *
 * BAIL DE 5 MINUTES. Si le processus meurt en plein envoi (deploiement,
 * plantage), ses lignes RESERVE repassent EN_ATTENTE au passage suivant.
 * Revers assume : un message parti juste avant la mort du processus, sans
 * avoir ete enregistre, repartira une fois.
 */

import { prisma } from "@/lib/prisma";
import { obtenirCanal, type CanalPromo } from "@/lib/canal-promo";
import {
  BAIL_RESERVATION_MS,
  CODE_MARKETING_REFUSE,
  LOT_PAR_PASSAGE,
  apresTentative,
} from "@/lib/promos";
import { marquerPromosRefusees } from "@/lib/promos-refus";

const PAUSE_ENTRE_ENVOIS_MS = 100;

type Reserve = {
  id: string;
  campagneId: string;
  telephone: string;
  prenom: string | null;
  tentatives: number;
};

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function passerMoteur(maintenant: Date = new Date()): Promise<{
  envoyes: number;
  echecs: number;
  reessais: number;
  terminees: number;
}> {
  const bilan = { envoyes: 0, echecs: 0, reessais: 0, terminees: 0 };

  // 1. Baux expires : un passage mort laisse ses lignes a reprendre.
  await prisma.destinatairePromo.updateMany({
    where: { statut: "RESERVE", reserveLe: { lt: new Date(maintenant.getTime() - BAIL_RESERVATION_MS) } },
    data: { statut: "EN_ATTENTE", reserveLe: null },
  });

  // 2. Campagnes programmees dont l'heure est venue.
  await prisma.campagnePromo.updateMany({
    where: {
      statut: "PROGRAMMEE",
      OR: [{ programmeeLe: null }, { programmeeLe: { lte: maintenant } }],
    },
    data: { statut: "EN_COURS" },
  });

  // 3. Reservation atomique (voir l'en-tete).
  //
  // La date passe en texte ISO caste en `timestamp` : Prisma stocke de l'UTC
  // dans des colonnes SANS fuseau, et un `Date` passe tel quel serait
  // converti selon le fuseau de la session PostgreSQL.
  const horodatage = maintenant.toISOString();
  const reserves = await prisma.$queryRaw<Reserve[]>`
    UPDATE "DestinatairePromo" AS d
    SET "statut" = 'RESERVE', "reserveLe" = ${horodatage}::timestamp, "majLe" = ${horodatage}::timestamp
    WHERE d."id" IN (
      SELECT d2."id"
      FROM "DestinatairePromo" d2
      JOIN "CampagnePromo" c ON c."id" = d2."campagneId"
      WHERE d2."statut" = 'EN_ATTENTE' AND c."statut" = 'EN_COURS'
      ORDER BY c."creeLe" ASC, d2."id" ASC
      LIMIT ${LOT_PAR_PASSAGE}
      FOR UPDATE OF d2 SKIP LOCKED
    )
    RETURNING d."id", d."campagneId", d."telephone", d."prenom", d."tentatives"`;

  // 4. Envoi, campagne par campagne.
  const parCampagne = new Map<string, Reserve[]>();
  for (const r of reserves) {
    const l = parCampagne.get(r.campagneId) ?? [];
    l.push(r);
    parCampagne.set(r.campagneId, l);
  }

  for (const [campagneId, lot] of parCampagne) {
    const campagne = await prisma.campagnePromo.findUnique({
      where: { id: campagneId },
      select: { providerId: true, canal: true, texteOffre: true },
    });
    if (!campagne) continue;

    let canal: CanalPromo | null = null;
    try {
      canal = await obtenirCanal(campagne.providerId, campagne.canal);
    } catch (err) {
      // Jeton illisible (cle changee) : jamais le detail, qui pourrait citer
      // le blob.
      console.error("[promos] canal indisponible:", err instanceof Error ? err.name : "erreur");
    }
    if (!canal) {
      // WhatsApp deconnecte entre la creation et l'envoi : on n'attend pas
      // indefiniment une reconnexion qui peut ne jamais venir.
      await prisma.destinatairePromo.updateMany({
        where: { id: { in: lot.map((d) => d.id) }, statut: "RESERVE" },
        data: { statut: "ECHEC", erreur: "WhatsApp n'est plus connecté pour ce salon", reserveLe: null },
      });
      bilan.echecs += lot.length;
      continue;
    }

    for (const d of lot) {
      // Arret demande pendant le passage : on n'envoie plus rien. La route
      // d'arret a deja passe ces lignes en NON_ENVOYE.
      const etat = await prisma.campagnePromo.findUnique({ where: { id: campagneId }, select: { statut: true } });
      if (etat?.statut !== "EN_COURS") break;

      const resultat = await canal.envoyer({ telephone: d.telephone, prenom: d.prenom, offre: campagne.texteOffre });
      const suite = apresTentative({ tentatives: d.tentatives, resultat });

      if (resultat.ok) {
        // Sans condition sur le statut : le message EST parti, meme si un
        // arret est arrive entre-temps. L'ecran doit le compter.
        await prisma.destinatairePromo.update({
          where: { id: d.id },
          data: {
            statut: "ENVOYE",
            messageIdExterne: resultat.messageIdExterne,
            tentatives: suite.tentatives,
            erreur: null,
            envoyeLe: new Date(),
            reserveLe: null,
          },
        });
        bilan.envoyes++;
      } else {
        await prisma.destinatairePromo.updateMany({
          where: { id: d.id, statut: "RESERVE" },
          data: { statut: suite.statut, tentatives: suite.tentatives, erreur: suite.erreur, reserveLe: null },
        });
        if (suite.statut === "ECHEC") bilan.echecs++;
        else bilan.reessais++;
        if (resultat.code === CODE_MARKETING_REFUSE) {
          await marquerPromosRefusees(campagne.providerId, d.telephone);
        }
      }
      await pause(PAUSE_ENTRE_ENVOIS_MS);
    }
  }

  // 5. Campagnes sans plus rien a envoyer.
  const finies = await prisma.campagnePromo.findMany({
    where: {
      statut: "EN_COURS",
      destinataires: { none: { statut: { in: ["EN_ATTENTE", "RESERVE"] } } },
    },
    select: { id: true },
  });
  if (finies.length > 0) {
    const r = await prisma.campagnePromo.updateMany({
      where: { id: { in: finies.map((c) => c.id) }, statut: "EN_COURS" },
      data: { statut: "TERMINEE", termineeLe: new Date() },
    });
    bilan.terminees = r.count;
  }

  return bilan;
}
