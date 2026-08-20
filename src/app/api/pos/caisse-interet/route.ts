import { requireEmployee, toResponse } from "@/lib/employee-session";
import { prisma } from "@/lib/prisma";

/**
 * Enregistre l'interet d'un salon pour le module caisse.
 *
 * N'active RIEN : l'activation reste une decision commerciale, prise depuis
 * l'espace admin. Cette route ne fait que laisser une trace.
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

  // `upsert` et non `create` : la contrainte @@unique([providerId, feature])
  // ferait echouer un second clic. Ici il ne se passe simplement rien.
  await prisma.featureInterest.upsert({
    where: {
      providerId_feature: { providerId: employee.providerId, feature: "POS" },
    },
    create: { providerId: employee.providerId, feature: "POS" },
    update: {},
  });

  return Response.json({ ok: true });
}
