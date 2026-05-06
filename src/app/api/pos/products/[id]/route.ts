import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireEmployee, toResponse } from "@/lib/employee-session";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let employee;
  try {
    employee = await requireEmployee();
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  const { id } = await ctx.params;
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product || product.providerId !== employee.providerId) {
    return Response.json({ error: "Produit introuvable" }, { status: 404 });
  }
  return Response.json(product);
}

type UpdateBody = {
  name?: string;
  description?: string | null;
  category?: string | null;
  sku?: string;
  barcode?: string | null;
  purchasePrice?: string | number;
  salePrice?: string | number;
  taxRate?: string | number;
  lowStockThreshold?: number;
  photo?: string | null;
  active?: boolean;
};

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let employee;
  try {
    employee = await requirePermission("products.manage");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  const { id } = await ctx.params;
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product || product.providerId !== employee.providerId) {
    return Response.json({ error: "Produit introuvable" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as UpdateBody | null;
  if (!body) return Response.json({ error: "Corps requis" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.description !== undefined) data.description = body.description;
  if (body.category !== undefined) data.category = body.category;
  if (body.sku !== undefined) data.sku = body.sku;
  if (body.barcode !== undefined) data.barcode = body.barcode;
  if (body.lowStockThreshold !== undefined) data.lowStockThreshold = body.lowStockThreshold;
  if (body.photo !== undefined) data.photo = body.photo;
  if (body.active !== undefined) data.active = body.active;

  if (body.purchasePrice !== undefined) {
    const n = Number(body.purchasePrice);
    if (!Number.isFinite(n) || n < 0)
      return Response.json({ error: "Prix d'achat invalide" }, { status: 400 });
    data.purchasePrice = n;
  }
  if (body.salePrice !== undefined) {
    const n = Number(body.salePrice);
    if (!Number.isFinite(n) || n < 0)
      return Response.json({ error: "Prix de vente invalide" }, { status: 400 });
    data.salePrice = n;
  }
  if (body.taxRate !== undefined) {
    const t = Number(body.taxRate);
    if (Number.isNaN(t) || t < 0 || t > 100)
      return Response.json({ error: "TVA invalide" }, { status: 400 });
    data.taxRate = t;
  }

  try {
    const updated = await prisma.product.update({ where: { id }, data });
    return Response.json(updated);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2002") {
      return Response.json(
        { error: "SKU ou code-barres déjà utilisé pour ce salon" },
        { status: 409 },
      );
    }
    throw err;
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let employee;
  try {
    employee = await requirePermission("products.manage");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  const { id } = await ctx.params;
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product || product.providerId !== employee.providerId) {
    return Response.json({ error: "Produit introuvable" }, { status: 404 });
  }
  // Soft delete — preserve historical sales references.
  const updated = await prisma.product.update({
    where: { id },
    data: { active: false },
  });
  return Response.json(updated);
}
