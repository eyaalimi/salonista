/**
 * Verification du PIN d'un employe, avec verrouillage et limite de debit.
 *
 * Adaptateur : la decision de verrouillage vit dans `pin-lockout.ts` et la
 * fenetre de debit dans `rate-limit-decision.ts`, tous deux purs et testes.
 * Ici, seulement la base et bcrypt.
 */

import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  apresEchec,
  apresSucces,
  estVerrouille,
  messageVerrou,
  secondesRestantes,
} from "@/lib/pin-lockout";
import { verifierLimite } from "@/lib/rate-limit";
import { LIMITE_PIN, messageLimite } from "@/lib/rate-limit-decision";
import { EVENEMENTS } from "@/lib/evenement-salon";
import {
  enregistrerEvenementSalon,
  salonDeLEmployee,
} from "@/lib/evenement-salon-ecriture";

/**
 * Message unique pour tout echec de PIN.
 *
 * Ne distingue jamais « employe inconnu » de « PIN faux » : la difference
 * dirait a un attaquant quels identifiants existent.
 */
const PIN_INCORRECT = "PIN incorrect";

export class PinVerrouilleError extends Error {}

/**
 * Verifie le PIN, ou jette.
 *
 * @throws {PinVerrouilleError} compte verrouille, ou trop de tentatives
 * @throws {Error} PIN incorrect
 */
export async function verifierPinEmploye(
  employeeId: string,
  pin: string,
  maintenant: Date = new Date(),
): Promise<void> {
  // La limite porte sur TOUTES les tentatives, pas seulement les echecs :
  // elle arrete aussi un script qui rejouerait un PIN devine.
  const limite = await verifierLimite(`pin:${employeeId}`, LIMITE_PIN, maintenant);
  if (!limite.ok) {
    throw new PinVerrouilleError(messageLimite(limite.resetDansMs));
  }

  const employe = await prisma.salonEmployee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      active: true,
      pinHash: true,
      pinFailedAttempts: true,
      pinLockedUntil: true,
    },
  });

  if (!employe || !employe.active || !employe.pinHash) {
    throw new Error(PIN_INCORRECT);
  }

  // Le verrou est verifie AVANT de comparer : comparer un hash bcrypt coute
  // ~100 ms, autant ne pas l'offrir a qui est deja bloque.
  if (estVerrouille(employe, maintenant)) {
    throw new PinVerrouilleError(
      messageVerrou(secondesRestantes(employe, maintenant)),
    );
  }

  const ok = await compare(pin, employe.pinHash);

  if (ok) {
    // Ecriture inutile si le compteur est deja propre : le cas courant.
    if (employe.pinFailedAttempts !== 0 || employe.pinLockedUntil !== null) {
      await prisma.salonEmployee.update({
        where: { id: employe.id },
        data: apresSucces(),
      });
    }
    return;
  }

  const suite = apresEchec(employe, maintenant);
  await prisma.salonEmployee.update({
    where: { id: employe.id },
    data: suite,
  });

  /*
   * ON GARDE UNE TRACE DE L'ECHEC.
   *
   * `pinFailedAttempts` repart a zero au premier succes — et aussi au moment
   * du verrouillage : il ne donne donc AUCUN historique. Une employee qui se
   * fait verrouiller chaque matin et finit par entrer laisse un compteur a
   * zero, alors que c'est exactement le salon qu'il faut rappeler.
   *
   * Le PIN essaye n'est jamais enregistre, seulement qu'un echec a eu lieu.
   * `pinLockedUntil` non nul distingue le verrouillage du simple echec, sans
   * redupliquer le seuil de `pin-lockout.ts`.
   */
  void salonDeLEmployee(employe.id).then((providerId) => {
    if (!providerId) return;
    return enregistrerEvenementSalon(
      suite.pinLockedUntil ? EVENEMENTS.PIN_VERROUILLAGE : EVENEMENTS.PIN_INCORRECT,
      { providerId, employeeId: employe.id },
    );
  });

  throw new Error(PIN_INCORRECT);
}
