import { requireEmployee, toResponse } from "@/lib/employee-session";
import { prisma } from "@/lib/prisma";

/**
 * Masque la carte de demarrage pour ce salon.
 *
 * `onboardingDismissedAt` existait deja dans le schema (schema.prisma:221) :
 * aucune migration n'est necessaire.
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
