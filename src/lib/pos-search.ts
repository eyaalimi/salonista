/**
 * Phase 2 Design 2 — universal search ranking + frequently-used cache.
 *
 * Used by:
 *   - GET /api/pos/search   (server-side, accent-insensitive via Postgres unaccent)
 *   - searchCachedCatalog() (client-side, in-memory ranking over IndexedDB cache
 *     when offline)
 */

export type ScoredCandidate = {
  kind: "SERVICE" | "PRODUCT";
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  code: string;
  salePrice: string;
  taxRate: string;
  duration?: number;
  stock?: { quantity: number; threshold: number };
  photo?: string | null;
  /** SaleItem.quantity sum over the last 30 days, used as a tiebreaker. */
  recentSalesVolume?: number;
};

/** Lowercase + strip combining accents (NFD normalization). */
export function deburr(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Service codes: "SVC-{SLUG}-{DURATION}" (display only). */
export function synthesizeServiceCode(name: string, durationMinutes: number): string {
  const slug = deburr(name).replace(/[^a-z]/g, "").toUpperCase().slice(0, 5) || "SVC";
  return `SVC-${slug}-${durationMinutes}`;
}

/**
 * Same scorer for services and products so they interleave naturally.
 * See spec §5 for the score weights.
 */
export function scoreCandidate(c: ScoredCandidate, q: string): number {
  if (q.length === 0) return c.recentSalesVolume ?? 0;
  const dq = deburr(q);
  const dn = deburr(c.name);
  const dDesc = deburr(c.description ?? "");
  const dCat = deburr(c.category ?? "");
  const dCode = deburr(c.code);

  // Exact barcode / SKU
  if (c.kind === "PRODUCT") {
    if (dCode === dq) return 1000;
    if (dCode.includes(dq) && dq.length >= 4) return 900;
  }

  // Name starts with q
  if (dn.startsWith(dq)) {
    const wholeWord = new RegExp(`(^|\\s)${dq.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`).test(dn);
    return 500 + (wholeWord ? 50 : 0);
  }

  // Name contains q
  if (dn.includes(dq)) return 200;

  // Description
  if (dDesc.includes(dq)) return 50;

  // Category
  if (dCat.includes(dq)) return 25;

  return 0;
}

export function rankAndTake(
  candidates: ScoredCandidate[],
  q: string,
  limit: number,
): Array<ScoredCandidate & { score: number }> {
  const scored = candidates
    .map((c) => ({ ...c, score: scoreCandidate(c, q) }))
    .filter((c) => c.score > 0 || q.length === 0)
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      const av = a.recentSalesVolume ?? 0;
      const bv = b.recentSalesVolume ?? 0;
      if (av !== bv) return bv - av;
      return a.name.localeCompare(b.name, "fr");
    });
  return scored.slice(0, limit);
}
