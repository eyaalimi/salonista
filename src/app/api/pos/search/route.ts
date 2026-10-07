import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/modules";
import { requireEmployee, toResponse } from "@/lib/employee-session";
import { rankAndTake, synthesizeServiceCode, type ScoredCandidate } from "@/lib/pos-search";

const FREQUENTLY_USED_CACHE = new Map<string, { at: number; data: unknown }>();
const CACHE_TTL_MS = 60_000;

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

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 20)));

  // Empty query → return the full active catalog (sorted alphabetically),
  // so the POS grid always shows every service/product on first load.
  // Frequently-used ranking only kicks in when we have enough sales data
  // to make it useful; for now, showing everything is more useful than
  // showing 1 line because only 1 service has been sold.
  if (q.length === 0) {
    const cached = FREQUENTLY_USED_CACHE.get(employee.providerId);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return Response.json(cached.data);
    }
    const data = await fullCatalog(employee.providerId, limit);
    FREQUENTLY_USED_CACHE.set(employee.providerId, { at: Date.now(), data });
    return Response.json(data);
  }

  // Active query → fetch all active offers + products and rank in JS. Single
  // salon catalogs are bounded (≪1000 rows); ranking in app code is simpler
  // and lets us reuse the same scorer for offline mode.
  const [offers, products] = await Promise.all([
    prisma.offer.findMany({
      where: { providerId: employee.providerId, active: true },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        discountPrice: true,
        taxRate: true,
        durationMinutes: true,
        photos: true,
      },
    }),
    prisma.product.findMany({
      where: { providerId: employee.providerId, active: true },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        sku: true,
        barcode: true,
        salePrice: true,
        taxRate: true,
        stockQuantity: true,
        lowStockThreshold: true,
        photo: true,
      },
    }),
  ]);

  const candidates: ScoredCandidate[] = [
    ...offers.map((o) => ({
      kind: "SERVICE" as const,
      id: o.id,
      name: o.title,
      description: o.description ?? null,
      category: o.category ?? null,
      code: synthesizeServiceCode(o.title, o.durationMinutes),
      salePrice: String(o.discountPrice),
      taxRate: String(o.taxRate),
      duration: o.durationMinutes,
      photo: o.photos?.[0] ?? null,
    })),
    ...products.map((p) => ({
      kind: "PRODUCT" as const,
      id: p.id,
      name: p.name,
      description: p.description ?? null,
      category: p.category ?? null,
      code: p.barcode ?? p.sku,
      salePrice: String(p.salePrice),
      taxRate: String(p.taxRate),
      stock: { quantity: p.stockQuantity, threshold: p.lowStockThreshold },
      photo: p.photo ?? null,
    })),
  ];

  const scored = rankAndTake(candidates, q, limit);

  return Response.json({
    query: q,
    results: scored.map((s) => ({
      kind: s.kind,
      id: s.id,
      name: s.name,
      category: s.category,
      subtitle: s.kind === "SERVICE" ? `${s.duration} min` : null,
      code: s.code,
      salePrice: s.salePrice,
      taxRate: s.taxRate,
      duration: s.duration,
      stock: s.stock
        ? {
            quantity: s.stock.quantity,
            threshold: s.stock.threshold,
            status:
              s.stock.quantity <= 0 ? "out" : s.stock.quantity <= s.stock.threshold ? "low" : "ok",
          }
        : undefined,
      photo: s.photo,
      score: s.score,
    })),
  });
}

async function fullCatalog(providerId: string, _limit: number) {
  // Cap defensively in case a salon has thousands of items; UI scrolls.
  const TAKE = 200;
  const [offers, products] = await Promise.all([
    prisma.offer.findMany({
      where: { providerId, active: true },
      orderBy: { title: "asc" },
      take: TAKE,
      select: {
        id: true,
        title: true,
        category: true,
        discountPrice: true,
        taxRate: true,
        durationMinutes: true,
        photos: true,
      },
    }),
    prisma.product.findMany({
      where: { providerId, active: true },
      orderBy: { name: "asc" },
      take: TAKE,
      select: {
        id: true,
        name: true,
        category: true,
        sku: true,
        barcode: true,
        salePrice: true,
        taxRate: true,
        stockQuantity: true,
        lowStockThreshold: true,
        photo: true,
      },
    }),
  ]);

  const results = [
    ...offers.map((o) => ({
      kind: "SERVICE" as const,
      id: o.id,
      name: o.title,
      category: o.category ?? null,
      subtitle: `${o.durationMinutes} min`,
      code: synthesizeServiceCode(o.title, o.durationMinutes),
      salePrice: String(o.discountPrice),
      taxRate: String(o.taxRate),
      duration: o.durationMinutes,
      photo: o.photos?.[0] ?? null,
      score: 0,
    })),
    ...products.map((p) => ({
      kind: "PRODUCT" as const,
      id: p.id,
      name: p.name,
      category: p.category ?? null,
      subtitle: null,
      code: p.barcode ?? p.sku,
      salePrice: String(p.salePrice),
      taxRate: String(p.taxRate),
      duration: undefined as number | undefined,
      stock: {
        quantity: p.stockQuantity,
        threshold: p.lowStockThreshold,
        status:
          p.stockQuantity <= 0
            ? ("out" as const)
            : p.stockQuantity <= p.lowStockThreshold
              ? ("low" as const)
              : ("ok" as const),
      },
      photo: p.photo ?? null,
      score: 0,
    })),
  ];

  return { query: "", results };
}

// Kept for future "recommended" mode but not currently wired — empty query
// returns the full catalog instead (see fullCatalog above). Prefixed with _
// so eslint/tsc don't flag it.
async function _frequentlyUsed(providerId: string, limit: number) {
  // Top by 30-day SaleItem volume, mixed services/products.
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const items = await prisma.saleItem.findMany({
    where: {
      sale: {
        providerId,
        status: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] },
        closedAt: { gte: since },
      },
    },
    select: {
      kind: true,
      offerId: true,
      productId: true,
      quantity: true,
    },
  });

  const offerVol = new Map<string, number>();
  const productVol = new Map<string, number>();
  for (const it of items) {
    if (it.kind === "SERVICE" && it.offerId) {
      offerVol.set(it.offerId, (offerVol.get(it.offerId) ?? 0) + it.quantity);
    } else if (it.kind === "PRODUCT" && it.productId) {
      productVol.set(it.productId, (productVol.get(it.productId) ?? 0) + it.quantity);
    }
  }

  const offerIds = [...offerVol.keys()];
  const productIds = [...productVol.keys()];
  const [offers, products] = await Promise.all([
    offerIds.length
      ? prisma.offer.findMany({
          where: { id: { in: offerIds }, active: true },
          select: {
            id: true,
            title: true,
            description: true,
            category: true,
            discountPrice: true,
            taxRate: true,
            durationMinutes: true,
            photos: true,
          },
        })
      : [],
    productIds.length
      ? prisma.product.findMany({
          where: { id: { in: productIds }, active: true },
          select: {
            id: true,
            name: true,
            description: true,
            category: true,
            sku: true,
            barcode: true,
            salePrice: true,
            taxRate: true,
            stockQuantity: true,
            lowStockThreshold: true,
            photo: true,
          },
        })
      : [],
  ]);

  const merged: ScoredCandidate[] = [
    ...offers.map((o) => ({
      kind: "SERVICE" as const,
      id: o.id,
      name: o.title,
      description: o.description ?? null,
      category: o.category ?? null,
      code: synthesizeServiceCode(o.title, o.durationMinutes),
      salePrice: String(o.discountPrice),
      taxRate: String(o.taxRate),
      duration: o.durationMinutes,
      photo: o.photos?.[0] ?? null,
      recentSalesVolume: offerVol.get(o.id) ?? 0,
    })),
    ...products.map((p) => ({
      kind: "PRODUCT" as const,
      id: p.id,
      name: p.name,
      description: p.description ?? null,
      category: p.category ?? null,
      code: p.barcode ?? p.sku,
      salePrice: String(p.salePrice),
      taxRate: String(p.taxRate),
      stock: { quantity: p.stockQuantity, threshold: p.lowStockThreshold },
      photo: p.photo ?? null,
      recentSalesVolume: productVol.get(p.id) ?? 0,
    })),
  ];

  // q is "" → every candidate gets recentSalesVolume as score (per scoreCandidate)
  const scored = rankAndTake(merged, "", limit);

  return {
    query: "",
    results: scored.map((s) => ({
      kind: s.kind,
      id: s.id,
      name: s.name,
      category: s.category,
      subtitle: s.kind === "SERVICE" ? `${s.duration} min` : null,
      code: s.code,
      salePrice: s.salePrice,
      taxRate: s.taxRate,
      duration: s.duration,
      stock: s.stock
        ? {
            quantity: s.stock.quantity,
            threshold: s.stock.threshold,
            status:
              s.stock.quantity <= 0 ? "out" : s.stock.quantity <= s.stock.threshold ? "low" : "ok",
          }
        : undefined,
      photo: s.photo,
      score: s.score,
    })),
  };
}
