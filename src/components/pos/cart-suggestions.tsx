"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Sparkles, X } from "lucide-react";
import { usePosStore } from "@/lib/pos-store";
import { getCachedCatalog } from "@/lib/pos-offline-db";
import { formatDT } from "@/lib/money";

type CachedProduct = {
  id: string;
  name: string;
  category: string | null;
  sku: string;
  barcode: string | null;
  salePrice: string;
  taxRate: string;
  stockQuantity: number;
  lowStockThreshold: number;
  photo: string | null;
};

/**
 * Maps a service Category enum to keywords typically found in product
 * categories or names. A product matches the active service if any of its
 * text fields contains at least one keyword (case + accent insensitive).
 */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  COIFFURE: [
    "coiffure", "cheveux", "capillaire", "shampooing", "shampoing",
    "soin", "huile", "argan", "kératine", "keratine", "masque",
    "spray", "serum", "sérum", "balayage", "couleur",
  ],
  ESTHETIQUE: [
    "esthétique", "esthetique", "soin", "visage", "peau", "crème", "creme",
    "lotion", "tonique", "masque", "gommage", "sérum", "serum", "anti-age",
  ],
  ONGLERIE: [
    "ongle", "ongles", "vernis", "manucure", "pédicure", "pedicure",
    "polish", "gel", "base", "top coat",
  ],
  MASSAGE: [
    "massage", "huile", "relaxation", "détente", "detente", "aromathérapie",
    "aromatherapie", "bougie",
  ],
  PARFUMERIE: ["parfum", "fragrance", "eau de toilette", "edp", "edt"],
  AUTRE: [],
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function matchesService(product: CachedProduct, serviceCategory: string): boolean {
  const keywords = CATEGORY_KEYWORDS[serviceCategory] ?? [];
  if (keywords.length === 0) return false;
  const hay = normalize(
    `${product.name} ${product.category ?? ""} ${product.sku}`,
  );
  return keywords.some((k) => hay.includes(normalize(k)));
}

export function CartSuggestions() {
  const cart = usePosStore((s) => s.cart);
  const addLine = usePosStore((s) => s.addLine);
  const [products, setProducts] = useState<CachedProduct[]>([]);
  const [offerCategories, setOfferCategories] = useState<Map<string, string>>(new Map());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cat = await getCachedCatalog();
      if (cancelled || !cat) return;
      setProducts(cat.products as CachedProduct[]);
      const map = new Map<string, string>();
      for (const o of cat.offers) map.set(o.id, o.category);
      setOfferCategories(map);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const suggestions = useMemo<CachedProduct[]>(() => {
    if (cart.length === 0 || products.length === 0) return [];

    // Categories of services currently in the cart.
    const activeCategories = new Set<string>();
    for (const line of cart) {
      if (line.kind !== "SERVICE" || !line.offerId) continue;
      const cat = offerCategories.get(line.offerId);
      if (cat) activeCategories.add(cat);
    }
    if (activeCategories.size === 0) return [];

    // Product IDs already in the cart.
    const inCart = new Set(
      cart.filter((l) => l.kind === "PRODUCT" && l.productId).map((l) => l.productId!),
    );

    const matched: CachedProduct[] = [];
    for (const p of products) {
      if (inCart.has(p.id)) continue;
      if (dismissed.has(p.id)) continue;
      if (p.stockQuantity <= 0) continue;
      for (const cat of activeCategories) {
        if (matchesService(p, cat)) {
          matched.push(p);
          break;
        }
      }
      if (matched.length >= 4) break;
    }
    return matched;
  }, [cart, products, offerCategories, dismissed]);

  if (suggestions.length === 0) return null;

  function addProduct(p: CachedProduct) {
    addLine({
      uid: `cl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kind: "PRODUCT",
      productId: p.id,
      nameSnapshot: p.name,
      priceSnapshot: p.salePrice,
      taxRateSnapshot: p.taxRate,
      quantity: 1,
    });
  }

  return (
    <div className="border-t border-pos-border bg-pos-accent/5 px-3 py-2">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Sparkles size={12} className="text-pos-accent" />
        <span className="text-[10px] uppercase tracking-[0.18em] text-pos-accent font-semibold">
          Suggestions
        </span>
      </div>
      <ul className="space-y-1">
        {suggestions.map((p) => (
          <li
            key={p.id}
            className="flex items-center gap-2 bg-white border border-pos-border rounded-md px-2 py-1.5"
          >
            {p.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.photo}
                alt=""
                className="w-7 h-7 rounded object-cover shrink-0"
                loading="lazy"
              />
            ) : (
              <span className="w-7 h-7 rounded bg-pos-accent/15 text-pos-accent text-[10px] font-semibold flex items-center justify-center shrink-0">
                {p.name.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-pos-ink truncate capitalize leading-tight">
                {p.name}
              </div>
              <div className="text-[10px] text-pos-ink-3 pos-mono leading-tight">
                {formatDT(p.salePrice)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => addProduct(p)}
              aria-label="Ajouter au panier"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-pos-accent text-white hover:bg-pos-accent/90 shrink-0"
            >
              <Plus size={14} />
            </button>
            <button
              type="button"
              onClick={() =>
                setDismissed((prev) => {
                  const next = new Set(prev);
                  next.add(p.id);
                  return next;
                })
              }
              aria-label="Ignorer"
              className="text-pos-ink-4 hover:text-pos-danger shrink-0"
            >
              <X size={12} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
