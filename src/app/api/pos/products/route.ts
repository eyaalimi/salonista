import { NextRequest } from "next/server";
import { tauxTvaApplicable } from "@/lib/tva-salon";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/modules";
import { requireEmployee, requirePermission, toResponse } from "@/lib/employee-session";

export async function GET(req: NextRequest) {
  let employee;
  try {
    employee = await requireEmployee();
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  try {
    await requireModule(employee.providerId, "POS");
  } catch {
    return Response.json({ error: "Module POS non activé" }, { status: 403 });
  }

  const includeInactive = req.nextUrl.searchParams.get("all") === "1";
  const products = await prisma.product.findMany({
    where: {
      providerId: employee.providerId,
      ...(includeInactive ? {} : { active: true }),
    },
    orderBy: { name: "asc" },
  });
  return Response.json(products);
}

type CreateBody = {
  name?: string;
  description?: string | null;
  category?: string | null;
  sku?: string;
  barcode?: string | null;
  purchasePrice?: string | number;
  salePrice?: string | number;
  taxRate?: string | number;
  stockQuantity?: number;
  lowStockThreshold?: number;
  photo?: string | null;
};

export async function POST(req: NextRequest) {
  let employee;
  try {
    employee = await requirePermission("products.manage");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  try {
    await requireModule(employee.providerId, "POS");
  } catch {
    return Response.json({ error: "Module POS non activé" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as CreateBody | null;
  if (!body?.name || !body.sku || body.salePrice === undefined || body.purchasePrice === undefined) {
    return Response.json({ error: "Champs requis manquants" }, { status: 400 });
  }

  // Meme regle que pour les offres : un salon non assujetti obtient 0 %,
  // quel que soit le taux envoye.
  const regime = await prisma.providerProfile.findUnique({
    where: { id: employee.providerId },
    select: { vatRegistered: true },
  });
  const tax = tauxTvaApplicable(regime?.vatRegistered ?? false, body.taxRate);
  const purchase = Number(body.purchasePrice);
  const sale = Number(body.salePrice);
  if (!Number.isFinite(purchase) || purchase < 0 || !Number.isFinite(sale) || sale < 0) {
    return Response.json({ error: "Prix invalide" }, { status: 400 });
  }

  try {
    const product = await prisma.product.create({
      data: {
        providerId: employee.providerId,
        name: body.name,
        description: body.description ?? null,
        category: body.category ?? null,
        sku: body.sku,
        barcode: body.barcode ?? null,
        purchasePrice: purchase,
        salePrice: sale,
        taxRate: tax,
        stockQuantity: body.stockQuantity ?? 0,
        lowStockThreshold: body.lowStockThreshold ?? 5,
        photo: body.photo ?? null,
      },
    });

    if ((body.stockQuantity ?? 0) > 0) {
      await prisma.stockMovement.create({
        data: {
          productId: product.id,
          delta: body.stockQuantity!,
          reason: "PURCHASE",
          employeeId: employee.id,
          note: "Stock initial",
        },
      });
    }

    return Response.json(product, { status: 201 });
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
