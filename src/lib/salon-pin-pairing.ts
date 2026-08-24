/**
 * Cookie d'appairage et tuiles employes — partages entre `/resolve` et
 * `/resolve/verify`.
 *
 * Une route Next.js ne peut exporter que ses gestionnaires HTTP : tout ce que
 * deux routes partagent doit vivre ici.
 */

import { prisma } from "@/lib/prisma";
import { couleurTuile, type TuileEmploye } from "@/lib/device-pairing";

export const REMEMBER_COOKIE = "salonista-provider";
const REMEMBER_MAX_AGE = 60 * 60 * 24 * 30; // 30 jours

/**
 * Cookie prouvant qu'un appareil est appaire a ce salon.
 *
 * `HttpOnly` : ce cookie autorise desormais l'affichage des employes, il n'a
 * plus rien a faire a portee d'un script de page. Il etait lisible en
 * JavaScript quand il ne servait qu'a se souvenir du dernier salon.
 */
export function cookieAppairage(providerId: string): string {
  return `${REMEMBER_COOKIE}=${providerId}; Path=/; Max-Age=${REMEMBER_MAX_AGE}; SameSite=Lax; HttpOnly`;
}

/** Cookie d'effacement, meme attributs — sinon le navigateur l'ignore. */
export function cookieEfface(): string {
  return `${REMEMBER_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly`;
}

/**
 * Les tuiles a afficher sur l'ecran de saisie du PIN.
 *
 * Strictement le necessaire : identifiant, prenom, role, presence d'un PIN,
 * couleur. Ni email, ni telephone, ni date de derniere connexion.
 */
export async function tuilesDuSalon(providerId: string): Promise<TuileEmploye[]> {
  const employes = await prisma.salonEmployee.findMany({
    where: { providerId, active: true },
    orderBy: [{ role: "asc" }, { displayName: "asc" }],
    select: { id: true, displayName: true, role: true, pinHash: true },
  });
  return employes.map((e) => ({
    id: e.id,
    displayName: e.displayName,
    role: e.role,
    hasPin: !!e.pinHash,
    avatarColor: couleurTuile(e.id),
  }));
}
