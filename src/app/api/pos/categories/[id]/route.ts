/**
 * Modifier ou supprimer une categorie de services.
 *
 * PATCH  { nom?, position? }
 * DELETE — supprime la categorie, PAS ses services.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, toResponse } from "@/lib/employee-session";
import { nomDejaPris, validerNomCategorie } from "@/lib/categorie-service";

/** Verifie que la categorie appartient bien au salon de l'appelant. */
async function categorieDuSalon(id: string, providerId: string) {
  return prisma.serviceCategory.findFirst({
    where: { id, providerId },
    select: { id: true, nom: true },
  });
}

export async function PATCH(
  req: NextRequest,
  // En Next 16, `params` est une PROMESSE.
  { params }: { params: Promise<{ id: string }> },
) {
  let employee;
  try {
    employee = await requirePermission("products.manage");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }

  const { id } = await params;
  const categorie = await categorieDuSalon(id, employee.providerId);
  // Un salon ne doit pas pouvoir deviner l'existence des categories d'un
  // autre : « introuvable » et « pas a toi » rendent le meme 404.
  if (!categorie) {
    return Response.json({ error: "Catégorie introuvable" }, { status: 404 });
  }

  const corps = (await req.json().catch(() => null)) as
    | { nom?: string; position?: number }
    | null;

  const data: { nom?: string; position?: number } = {};

  if (corps?.nom !== undefined) {
    const verdict = validerNomCategorie(corps.nom);
    if (!verdict.ok) {
      return Response.json({ error: verdict.message }, { status: 400 });
    }
    const autres = await prisma.serviceCategory.findMany({
      where: { providerId: employee.providerId, NOT: { id } },
      select: { nom: true },
    });
    if (nomDejaPris(verdict.nom, autres.map((c) => c.nom))) {
      return Response.json(
        { error: `« ${verdict.nom} » existe déjà.` },
        { status: 409 },
      );
    }
    data.nom = verdict.nom;
  }

  if (typeof corps?.position === "number" && Number.isFinite(corps.position)) {
    // Borne : une position negative ou demesuree casserait le tri sans
    // rien apporter.
    data.position = Math.max(0, Math.min(999, Math.trunc(corps.position)));
  }

  if (Object.keys(data).length === 0) {
    return Response.json({ error: "Rien à modifier" }, { status: 400 });
  }

  const miseAJour = await prisma.serviceCategory.update({
    where: { id },
    data,
    select: { id: true, nom: true, position: true },
  });

  return Response.json({ categorie: miseAJour });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let employee;
  try {
    employee = await requirePermission("products.manage");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }

  const { id } = await params;
  const categorie = await categorieDuSalon(id, employee.providerId);
  if (!categorie) {
    return Response.json({ error: "Catégorie introuvable" }, { status: 404 });
  }

  /*
   * La cle etrangere est en SetNull : les services de cette categorie
   * redeviennent « non classes » et restent parfaitement vendables. Supprimer
   * une categorie ne doit JAMAIS faire disparaitre un catalogue.
   *
   * On compte AVANT de supprimer, pour pouvoir le dire au salon.
   */
  const nbServices = await prisma.offer.count({ where: { categoryId: id } });
  await prisma.serviceCategory.delete({ where: { id } });

  return Response.json({
    ok: true,
    message:
      nbServices > 0
        ? `Catégorie supprimée. ${nbServices} service(s) sont redevenus « non classés ».`
        : "Catégorie supprimée.",
  });
}
