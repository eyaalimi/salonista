import { requireEmployee, toResponse } from "@/lib/employee-session";
import { prisma } from "@/lib/prisma";

/**
 * Masque la carte de demarrage pour ce salon.
 *
 * `onboardingDismissedAt` existait deja dans le schema (schema.prisma:221) :
 * aucune migration n'est necessaire.
 *
 * ATTENTION : cette colonne est PARTAGEE avec l'assistant d'installation de
 * la caisse (`api/pos/onboarding/route.ts`, branche `finish`). Les deux
 * chemins ne se croisent pas aujourd'hui — un salon avec la caisse atterrit
 * sur `/pos` et non sur le calendrier, donc il ne voit jamais cette carte.
 * Mais si les conditions de redirection de l'assistant sont un jour
 * assouplies, « Masquer » ici supprimerait aussi son ecran de bienvenue.
 */
export async function POST() {
  let employee;
  try {
    employee = await requireEmployee();
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }

  await prisma.providerProfile.update({
    where: { id: employee.providerId },
    data: { onboardingDismissedAt: new Date() } as never,
  });

  return Response.json({ ok: true });
}
