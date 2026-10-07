/**
 * Les categories de services d'un salon.
 *
 * GET  — la liste, dans l'ordre des onglets.
 * POST — en creer une.
 *
 * Les decisions (validation du nom, doublons, ordre) vivent dans
 * `src/lib/categorie-service.ts`, pur et teste. Ici on lit et on ecrit.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, toResponse } from "@/lib/employee-session";
import {
  CATEGORIES_MAX,
  nomDejaPris,
  prochainePosition,
  trierCategories,
  validerNomCategorie,
} from "@/lib/categorie-service";

export async function GET() {
  let employee;
  try {
    // `products.manage` : gerer ses categories releve du catalogue, comme
    // creer un service. Une caissiere les VOIT dans la grille sans avoir le
    // droit de les modifier.
    employee = await requirePermission("products.manage");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }

  const categories = await prisma.serviceCategory.findMany({
    where: { providerId: employee.providerId },
    select: {
      id: true,
      nom: true,
      position: true,
      _count: { select: { offers: true } },
    },
  });

  return Response.json({
    categories: trierCategories(categories).map((c) => ({
      id: c.id,
      nom: c.nom,
      position: c.position,
      nbServices: c._count.offers,
    })),
  });
}

export async function POST(req: NextRequest) {
  let employee;
  try {
    employee = await requirePermission("products.manage");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }

  const corps = (await req.json().catch(() => null)) as { nom?: string } | null;
  const verdict = validerNomCategorie(corps?.nom);
  if (!verdict.ok) {
    return Response.json({ error: verdict.message }, { status: 400 });
  }

  const existantes = await prisma.serviceCategory.findMany({
    where: { providerId: employee.providerId },
    select: { nom: true, position: true },
  });

  if (existantes.length >= CATEGORIES_MAX) {
    return Response.json(
      {
        error: `${CATEGORIES_MAX} catégories au maximum. Au-delà, les onglets deviennent illisibles au comptoir.`,
      },
      { status: 409 },
    );
  }

  // Doublon insensible a la casse ET aux accents : « Épilation » et
  // « epilation » sont une seule categorie. L'index unique de Postgres ne
  // comparerait que les octets et les laisserait passer tous les deux.
  if (nomDejaPris(verdict.nom, existantes.map((c) => c.nom))) {
    return Response.json(
      { error: `« ${verdict.nom} » existe déjà.` },
      { status: 409 },
    );
  }

  const creee = await prisma.serviceCategory.create({
    data: {
      providerId: employee.providerId,
      nom: verdict.nom,
      position: prochainePosition(existantes.map((c) => c.position)),
    },
    select: { id: true, nom: true, position: true },
  });

  return Response.json({ categorie: { ...creee, nbServices: 0 } }, { status: 201 });
}
