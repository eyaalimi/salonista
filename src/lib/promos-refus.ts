/**
 * Passe une cliente en « promos refusees » chez UN salon.
 *
 * Declencheurs : bouton « Ne plus recevoir », reponse STOP, ou erreur Meta
 * 131050 (elle a coupe les messages marketing dans WhatsApp — decision du
 * 12/11/2026 : on ne paie pas un essai voue a l'echec a chaque campagne).
 *
 * TOUTES les fiches de ce numero chez ce salon : un doublon de fiche ne doit
 * pas lui valoir de nouvelles promos. Jamais chez les autres salons : son
 * refus s'adresse au salon qui lui a ecrit (la fiche cliente appartient au
 * salon, voir CLAUDE.md §21).
 */

import { prisma } from "@/lib/prisma";
import { tryNormalizePhone } from "@/lib/phone";

export async function marquerPromosRefusees(providerId: string, telephoneMeta: string): Promise<number> {
  const normalise = tryNormalizePhone(`+${telephoneMeta.replace(/\D/g, "")}`);
  if (!normalise) return 0;
  const r = await prisma.customer.updateMany({
    where: { firstSalonId: providerId, phone: normalise, promosAcceptees: true },
    data: { promosAcceptees: false, promosRefuseesAt: new Date() },
  });
  return r.count;
}
