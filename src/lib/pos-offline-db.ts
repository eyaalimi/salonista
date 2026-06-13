/**
 * IndexedDB layer for the POS offline shell.
 *
 * Stores:
 *   - `catalog`        — primer payload from /api/pos/catalog
 *   - `pending_sales`  — sales created offline, awaiting server confirmation
 *   - `sync_log`       — append-only log of recent sync attempts (capped)
 *   - `cart_draft`     — per-employee in-progress cart
 */

import { openDB, type IDBPDatabase } from "idb";
import type { SalePayload } from "@/lib/pos-sale-create";

const DB_NAME = "salonista-pos";
const DB_VERSION = 1;
const SYNC_LOG_LIMIT = 200;

type CachedOffer = {
  id: string;
  title: string;
  description: string | null;
  discountPrice: string;
  durationMinutes: number;
  taxRate: string;
  photos: string[];
  category: string;
};

type CachedProduct = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  sku: string;
  barcode: string | null;
  salePrice: string;
  taxRate: string;
  stockQuantity: number;
  lowStockThreshold: number;
  photo: string | null;
};

export type CachedCustomerWallet = {
  walletId: string;
  balance: number;
  minPointsToRedeem: number;
  maxRedemptionPctPerSale: number;
  dinarPerPoint: string;
};

type CachedCustomer = {
  id: string;
  phone: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  wallet?: CachedCustomerWallet;
};

export type { CachedCustomer };

export type CachedCatalogProvider = {
  id: string;
  salonName: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  matriculeFiscal: string | null;
  receiptFooter: string | null;
};

export type CatalogOnboarding = {
  dismissedAt: Date | string | null;
  offersCount: number;
  productsCount: number;
  salesCount: number;
};

type CachedEmployee = {
  id: string;
  displayName: string;
  role: string;
};

export type CachedCatalog = {
  refreshedAt: string;
  provider: CachedCatalogProvider | null;
  onboarding?: CatalogOnboarding | null;
  offers: CachedOffer[];
  products: CachedProduct[];
  customers: CachedCustomer[];
  employees: CachedEmployee[];
  cashDrawer?: { openSessionId: string | null };
};

export type PendingSale = {
  offlineId: string;
  payload: SalePayload & { clientTotal?: string };
  status: "pending" | "syncing" | "failed";
  createdAt: string;
  lastError?: string;
};

export type SyncLogEntry = {
  id: number;
  at: string;
  outcomes: Array<{ offlineId: string; status: string; error?: string }>;
};

export type SyncResult = {
  offlineId: string;
  status: "ok" | "duplicate" | "conflict" | "error";
  saleId?: string;
  receiptNumber?: string;
  error?: string;
  conflicts?: unknown[];
};

let _db: IDBPDatabase | null = null;

async function db() {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB not available in this environment");
  }
  if (_db) return _db;
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains("catalog")) {
        database.createObjectStore("catalog");
      }
      if (!database.objectStoreNames.contains("pending_sales")) {
        database.createObjectStore("pending_sales", { keyPath: "offlineId" });
      }
      if (!database.objectStoreNames.contains("sync_log")) {
        database.createObjectStore("sync_log", { keyPath: "id", autoIncrement: true });
      }
      if (!database.objectStoreNames.contains("cart_draft")) {
        database.createObjectStore("cart_draft");
      }
    },
  });
  return _db;
}

// ---------- Catalog ----------

export async function refreshCatalog(): Promise<CachedCatalog | null> {
  try {
    const res = await fetch("/api/pos/catalog", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as CachedCatalog;
    const d = await db();
    await d.put("catalog", data, "primary");
    return data;
  } catch {
    return null;
  }
}

export async function getCachedCatalog(): Promise<CachedCatalog | null> {
  const d = await db();
  return ((await d.get("catalog", "primary")) as CachedCatalog) ?? null;
}

export async function findCachedOffers(): Promise<CachedOffer[]> {
  return (await getCachedCatalog())?.offers ?? [];
}

export async function findCachedProducts(): Promise<CachedProduct[]> {
  return (await getCachedCatalog())?.products ?? [];
}

export async function findCachedProductByBarcode(barcode: string): Promise<CachedProduct | null> {
  const products = await findCachedProducts();
  return products.find((p) => p.barcode === barcode) ?? null;
}

export async function findCachedCustomerByPhone(phone: string): Promise<CachedCustomer | null> {
  const cat = await getCachedCatalog();
  return cat?.customers.find((c) => c.phone === phone) ?? null;
}

export async function searchCachedCustomers(prefix: string): Promise<CachedCustomer[]> {
  const cat = await getCachedCatalog();
  if (!cat) return [];
  const q = prefix.trim().toLowerCase();
  if (!q) return cat.customers;
  return cat.customers.filter((c) => {
    const name = `${c.firstName ?? ""} ${c.lastName ?? ""}`.toLowerCase();
    return c.phone.includes(q) || name.includes(q);
  });
}

/**
 * Phase 2 Design 2 — universal-search fallback for offline mode.
 * Mirrors the server's ranking algorithm against the cached catalog.
 */
export async function searchCachedCatalog(q: string, limit: number) {
  const cat = await getCachedCatalog();
  if (!cat) return { query: q, results: [] };
  const search = await import("@/lib/pos-search");
  const candidates: import("@/lib/pos-search").ScoredCandidate[] = [
    ...cat.offers.map((o) => ({
      kind: "SERVICE" as const,
      id: o.id,
      name: o.title,
      description: o.description ?? null,
      category: o.category ?? null,
      code: search.synthesizeServiceCode(o.title, o.durationMinutes),
      salePrice: o.discountPrice,
      taxRate: o.taxRate,
      duration: o.durationMinutes,
      photo: o.photos?.[0] ?? null,
    })),
    ...cat.products.map((p) => ({
      kind: "PRODUCT" as const,
      id: p.id,
      name: p.name,
      description: p.description ?? null,
      category: p.category ?? null,
      code: p.barcode ?? p.sku,
      salePrice: p.salePrice,
      taxRate: p.taxRate,
      stock: { quantity: p.stockQuantity, threshold: p.lowStockThreshold },
      photo: p.photo ?? null,
    })),
  ];
  const scored = search.rankAndTake(candidates, q, limit);
  return {
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
  };
}

// ---------- Pending sales ----------

export async function queueSale(payload: SalePayload & { clientTotal?: string }): Promise<void> {
  if (!payload.offlineId) throw new Error("offlineId required");
  const d = await db();
  const entry: PendingSale = {
    offlineId: payload.offlineId,
    payload,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  await d.put("pending_sales", entry);
}

export async function listPendingSales(): Promise<PendingSale[]> {
  const d = await db();
  return ((await d.getAll("pending_sales")) as PendingSale[]) ?? [];
}

export async function clearSyncedSale(offlineId: string): Promise<void> {
  const d = await db();
  await d.delete("pending_sales", offlineId);
}

export async function markSaleFailed(offlineId: string, error: string): Promise<void> {
  const d = await db();
  const entry = (await d.get("pending_sales", offlineId)) as PendingSale | undefined;
  if (!entry) return;
  entry.status = "failed";
  entry.lastError = error;
  await d.put("pending_sales", entry);
}

// Module-level mutex to prevent two callers from sending the same offlineIds
// in parallel (e.g. Background Sync + manual reconnect both fire at once).
let _syncInFlight: Promise<SyncResult[]> | null = null;

export async function attemptSync(): Promise<SyncResult[]> {
  if (_syncInFlight) return _syncInFlight;
  _syncInFlight = doAttemptSync().finally(() => {
    _syncInFlight = null;
  });
  return _syncInFlight;
}

async function doAttemptSync(): Promise<SyncResult[]> {
  const list = await listPendingSales();
  if (list.length === 0) return [];

  const d = await db();
  // Mark all as syncing.
  for (const item of list) {
    item.status = "syncing";
    await d.put("pending_sales", item);
  }

  let res: Response;
  try {
    res = await fetch("/api/pos/sales/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sales: list.map((it) => it.payload) }),
    });
  } catch (err) {
    // Network failure — revert to pending and bail.
    for (const item of list) {
      item.status = "pending";
      await d.put("pending_sales", item);
    }
    return list.map((it) => ({
      offlineId: it.offlineId,
      status: "error",
      error: err instanceof Error ? err.message : "Network error",
    }));
  }

  if (!res.ok) {
    for (const item of list) {
      item.status = "pending";
      await d.put("pending_sales", item);
    }
    return list.map((it) => ({
      offlineId: it.offlineId,
      status: "error",
      error: `HTTP ${res.status}`,
    }));
  }

  const { results } = (await res.json()) as { results: SyncResult[] };

  for (const r of results) {
    if (r.status === "ok" || r.status === "duplicate") {
      await clearSyncedSale(r.offlineId);
    } else {
      await markSaleFailed(r.offlineId, r.error ?? r.status);
    }
  }

  // Append to sync log (capped).
  await d.add("sync_log", {
    at: new Date().toISOString(),
    outcomes: results.map((r) => ({
      offlineId: r.offlineId,
      status: r.status,
      error: r.error,
    })),
  });
  const all = (await d.getAll("sync_log")) as SyncLogEntry[];
  if (all.length > SYNC_LOG_LIMIT) {
    const sorted = all.sort((a, b) => a.id - b.id);
    const toRemove = sorted.slice(0, all.length - SYNC_LOG_LIMIT);
    for (const e of toRemove) await d.delete("sync_log", e.id);
  }

  return results;
}

// ---------- Cart drafts ----------

export async function saveCartDraft(employeeId: string, cart: unknown): Promise<void> {
  const d = await db();
  await d.put("cart_draft", { savedAt: new Date().toISOString(), cart }, employeeId);
}

export async function loadCartDraft(employeeId: string): Promise<unknown | null> {
  const d = await db();
  const entry = (await d.get("cart_draft", employeeId)) as
    | { savedAt: string; cart: unknown }
    | undefined;
  return entry?.cart ?? null;
}

export async function clearCartDraft(employeeId: string): Promise<void> {
  const d = await db();
  await d.delete("cart_draft", employeeId);
}
