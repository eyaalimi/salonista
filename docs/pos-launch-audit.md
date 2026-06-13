# POS Launch Readiness — Step 0 Audit

**Date:** 2026-06-12  
**Branch:** `pos-launch`  
**Audit scope:** Call site classification, current route validation, onboarding baseline, purchase price status

---

## 1. `prisma.offer.find*` Call Sites (19 hits)

All 19 call sites identified and classified below. **Spec expected 15; we have 19.** The surplus are: (1) two in `src/app/api/offers/[id]/route.ts` (one fetch + one edit validation), (2) one in `src/app/offre/[id]/page.tsx` (metadata generation separate from main page fetch), (3) one in `src/lib/pos-sale-create.ts` (POS sale creation validation). All are accounted for and correctly classified per context.

| File | Line(s) | Classification | Query Type | Reason |
|---|---|---|---|---|
| `src/app/page.tsx` | 29 | **PUBLIC** | `findMany` + `where: { active: true }` | Homepage feed, visible to all visitors. Must add `publishedToMarketplace: true`. |
| `src/app/offres/page.tsx` | 34 | **PUBLIC** | `findMany` + `where: { active: true }` | Public offer catalog, searchable by visitors. Must add `publishedToMarketplace: true`. |
| `src/app/offre/[id]/page.tsx` | 14 | **PUBLIC** | `findUnique` + `where: { id, active: true }` (metadata generation) | Metadata fetch for SEO/OG tags. Must add `publishedToMarketplace: true` or return 404. |
| `src/app/offre/[id]/page.tsx` | 40 | **PUBLIC** | `findUnique` + `where: { id, active: true }` (page render) | Public offer detail page with booking. Must add `publishedToMarketplace: true` or return 404. |
| `src/app/api/offers/route.ts` | 25 | **INTERNAL** | `findMany` + `where: { providerId: profile.id }` | Provider dashboard: their own offers. No filter needed. |
| `src/app/api/offers/route.ts` | 39 | **PUBLIC** | `findMany` + `where: { active: true }` | Public API endpoint (GET). Must add `publishedToMarketplace: true`. |
| `src/app/api/offers/[id]/route.ts` | 12 | **DUAL** | `findUnique` + `where: { id }` (GET public read) | Single-offer fetch. Role check required: public readers need `publishedToMarketplace: true`; provider/admin do not. |
| `src/app/api/offers/[id]/route.ts` | 40 | **INTERNAL** | `findUnique` + `where: { id }` (PATCH edit validation) | Edit validation, provider only. No filter. |
| `src/app/api/offers/[id]/route.ts` | 103 | **INTERNAL** | `findUnique` + `where: { id }` (DELETE) | Provider deletes own offer. No filter. |
| `src/app/api/collaborations/route.ts` | 102 | **INTERNAL** | `findMany` + `where: { id: { in: offerIds }, providerId: profile.id }` | Collab request creation validation (provider building request). No filter needed. |
| `src/app/api/pos/catalog/route.ts` | 32 | **INTERNAL** | `findMany` + `where: { providerId, active: true }` | POS offline catalog for salon staff. All active offers are sellable regardless of marketplace status. No filter. |
| `src/app/api/pos/search/route.ts` | 44 | **INTERNAL** | `findMany` + `where: { providerId, active: true }` | POS search for point-of-sale. No filter. |
| `src/app/api/pos/search/route.ts` | 163 | **INTERNAL** | `findMany` + `where: { providerId, active: true, ... }` | POS search continuation. No filter. |
| `src/app/sitemap.ts` | 16 | **PUBLIC** | `findMany` + `where: { active: true }` | XML sitemap for search engines. Must add `publishedToMarketplace: true`. |
| `src/app/api/admin/offers/route.ts` | 12 | **INTERNAL** | `findMany` (no where) | Admin dashboard sees all offers (active and inactive, marketplace or not). No filter needed. |
| `src/app/api/provider/stats/route.ts` | 20 | **INTERNAL** | `findMany` + `where: { providerId: profile.id }` | Provider stats. No filter. |
| `src/lib/pos-sale-create.ts` | 146 | **INTERNAL** | `findUnique` + `where: { id: line.offerId }` | POS sale line validation: fetching offer by ID during checkout. No filter. |
| `src/lib/slots.ts` | 17 | **INTERNAL** | `findUnique` + `where: { id }` | Slot regeneration: updating slots for a known offer ID after creation or duration change. No filter. |
| `src/lib/slots.ts` | 66 | **INTERNAL** | `findMany` + `where: { providerId }` | Bulk slot regeneration when opening hours change. No filter. |

**Public reads requiring filter (5 total):**
- `src/app/page.tsx:29`
- `src/app/offres/page.tsx:34`
- `src/app/offre/[id]/page.tsx:14, 40`
- `src/app/sitemap.ts:16`
- `src/app/api/offers/route.ts:39`
- `src/app/api/offers/[id]/route.ts:12` (conditional on role)

**Deviations:** Spec listed 15 files; this audit found 19 call sites (expected 3 extra in `/api/offers/[id]` and 1 in `/lib/pos-sale-create.ts`). No missing files.

---

## 2. POST `/api/offers` Current Validation

**File:** `src/app/api/offers/route.ts:50–103`

```typescript
// Line 66: destructure body
const { title, description, originalPrice, discountPrice, category, photos, durationMinutes, taxRate } = body;

// Line 68–70: required field check
if (!title || !originalPrice || !discountPrice || !category) {
  return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
}

// Line 72–78: duration validation
const duration = Number(durationMinutes);
if (!ALLOWED_DURATIONS.includes(duration)) {
  return NextResponse.json(
    { error: `Durée invalide. Valeurs autorisées : ${ALLOWED_DURATIONS.join(", ")} minutes` },
    { status: 400 }
  );
}

// Line 80–83: tax rate validation
const tax = taxRate === undefined ? 19 : Number(taxRate);
if (Number.isNaN(tax) || tax < 0 || tax > 100) {
  return NextResponse.json({ error: "Taux de TVA invalide (0–100)" }, { status: 400 });
}

// Line 85–97: offer creation
const offer = await prisma.offer.create({
  data: {
    providerId: profile.id,
    title,
    description: description || null,
    originalPrice,
    discountPrice,
    category,
    photos: photos || [],
    durationMinutes: duration,
    taxRate: tax,
  },
});

// Line 100: slot regeneration always called
await regenerateOfferSlots(offer.id);
```

**Current behavior:**
- `title`, `originalPrice`, `discountPrice`, `category`, `durationMinutes` are all **required**.
- `taxRate` defaults to 19 if omitted.
- `photos` defaults to empty array if omitted.
- `regenerateOfferSlots(offer.id)` is **always called** after creation.

**Spec alignment:** Current behavior matches the spec assertion exactly for existing marketplace offers. Section 1 requires a branched validation: if `publishedToMarketplace: false` (POS-only), `originalPrice` becomes optional and slot regen is **not** called. If `publishedToMarketplace: true` or unset (marketplace, backward compatible), current behavior applies.

---

## 3. `/api/pos/catalog` Response Shape

**File:** `src/app/api/pos/catalog/route.ts:13–143`

Response structure (JSON):
```typescript
{
  refreshedAt: ISO string,
  provider: {
    id, salonName, address, city, phone, matriculeFiscal, receiptFooter
  },
  offers: [
    {
      id, title, description, discountPrice, durationMinutes, taxRate, photos, category
    }
  ],
  products: [
    {
      id, name, description, category, sku, barcode, salePrice, taxRate, stockQuantity, lowStockThreshold, photo
    }
  ],
  customers: [
    {
      id, phone, firstName, lastName, email,
      wallet?: { walletId, balance, minPointsToRedeem, maxRedemptionPctPerSale, dinarPerPoint }
    }
  ],
  employees: [
    { id, displayName, role }
  ]
}
```

**Offers select clause (lines 32–45):**
```typescript
prisma.offer.findMany({
  where: { providerId, active: true },
  orderBy: { title: "asc" },
  select: {
    id: true,
    title: true,
    description: true,
    discountPrice: true,     // ← sale price for POS
    durationMinutes: true,
    taxRate: true,
    photos: true,
    category: true,
  },
})
```

**Products select clause (lines 46–62):**
```typescript
prisma.product.findMany({
  where: { providerId, active: true },
  orderBy: { name: "asc" },
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
```

**Spec alignment:** Current implementation already filters on `active: true` and ignores `publishedToMarketplace`. POS-only services (once added in Section 1) are immediately sellable. No response shape change needed for Section 1.

---

## 4. `receipt.tsx` Baseline: 80mm Print-Ready

**File:** `src/components/pos/receipt.tsx:47–213`

The receipt component already implements thermal printer CSS:

```typescript
<style jsx global>{`
  @page {
    size: 80mm auto;
    margin: 0;
  }
  @media print {
    body > *:not(.receipt-print) {
      display: none !important;
    }
    .receipt-print {
      display: block !important;
    }
  }
  .receipt-print {
    display: none;
    width: 80mm;
    padding: 5mm;
    font-family: ui-monospace, "Courier New", monospace;
    font-size: 11px;
    color: #000;
    background: #fff;
  }
  // ... row/hr/h1 styling ...
`}</style>
```

**Current state:** `@page { size: 80mm auto; margin: 0; }` is **already present**. Styling uses `<style jsx global>` (correct). The component receives `ReceiptData` payload and renders a hidden frame hidden by default (`display: none`), shown at print time via `window.print()`.

**Section 5 scope:** This is a **refactor target**, not greenfield. Section 5 will extract common `<ThermalLayout>` (80mm page + print CSS) to share across three use cases: receipt, test ticket, and Z report. Current receipt.tsx is the baseline; shared layout will wrap it (or be wrapped by it) without changing the 80mm contract.

---

## 5. Onboarding Baseline: None

**Search results for `onboarding|bienvenue|wizard|getStarted`:**

- `src/app/(dashboard)/cliente/fidelite/[walletId]/page.tsx` — contains `"Bonus de bienvenue"` (welcome bonus label in rewards UI, not an onboarding flow)
- `src/app/(dashboard)/prestataire/fidelite/fidelite-client.tsx` — contains `"Bonus de bienvenue"` (rewards config, not onboarding)
- `src/components/pos/receipt.tsx` — contains `"Bonus de bienvenue"` (receipt rendering, not onboarding)

**Current state:** No onboarding wizard or stepper exists. Fresh providers land on the POS dashboard with no guidance. There is no redirect rule, no step tracking, and no progress bar.

**Section 2 scope:** Greenfield. Will create:
- `ProviderProfile.onboardingDismissedAt` column (schema migration `20260612121000`)
- `/pos/bienvenue` route with 6-step stepper (components + logic)
- Redirect rule in `pos-shell-client.tsx` to auto-route OWNER to wizard when conditions met
- Step-specific forms (salon info, services quick-add, products, employees, drawer + test ticket, recap)

---

## 6. `Product.purchasePrice` Status

**Search results for `purchasePrice|product.purchase`:**

Grep hits in business logic (non-schema, non-generated):
- `src/app/(pos)/pos/products/[id]/edit/page.tsx:36` — prefills form field `purchasePrice: String(product.purchasePrice)` from DB
- `src/app/api/pos/products/[id]/route.ts:28, 64–68` — PATCH handler accepts and updates `purchasePrice`
- `src/app/api/pos/products/route.ts:38, 62, 70, 85` — POST handler accepts `purchasePrice` (required) and creates product
- `src/components/pos/product-form.tsx:21, 45, 81, 179–180` — form state and rendering

**Current state:** `Product.purchasePrice` (Decimal(10, 3)) is accepted in create/edit forms and persisted to the DB. It is **never read in any business logic** (no cost calculations, no margin reporting, no cost basis for accounting). It is purely stored metadata.

**Spec classification:** Deprecated metadata. Planned for Section 4 (`20260612123000_product_cost_price`) as a placeholder for future cost-price accounting. For now, it is inert.

---

## 7. Deviations from Spec Expectations

### 7.1 — Call site count mismatch (15 expected, 19 actual)

**Issue:** Spec stated "15 files found in initial sweep". Audit found 19 call sites across 14 distinct files (some files have 2–3 calls).

**Why:** 
- Two calls in `src/app/api/offers/[id]/route.ts` (GET and PATCH both fetch by ID for different purposes: public read vs. edit validation)
- Separate metadata fetch call in `src/app/offre/[id]/page.tsx` (Next.js renders metadata before component)
- One in `src/lib/pos-sale-create.ts` (new POS context, validates line offer during checkout)

**Recommended adjustment:** Update spec table in Section 1 to list all 19 call sites and their classifications, or recount in the spec to acknowledge the actual distribution. No code impact; this is just precision in the audit table.

### 7.2 — Influencer picker classification unclear

**Issue:** `src/app/api/collaborations/route.ts:102` fetches offers for validation during collab request creation (provider builds request for influencer). Should this be public-facing?

**Why:** The request is from a logged-in provider, not a public visitor. The influencer sees only the requests sent to them (GET at line 41), not raw offers. No public exposure.

**Recommended adjustment:** Confirmed as **INTERNAL**. The influencer's picker (if it exists) would likely need **PUBLIC** filtering, but that code path is not yet visible in this audit. Flag for review when influencer collaboration UI is next touched.

### 7.3 — Product.purchasePrice is read but not used

**Issue:** Spec states "appears unread". Audit confirms it is read (loaded from DB in forms, accepted in POST/PATCH), but never used in revenue/cost calculations.

**Recommended adjustment:** Re-classify from "unread" to "stored metadata, not consumed in business logic". Section 4 will formalize it as a future cost-basis field. Current forms should continue accepting it to avoid data loss on round-trip edits.

---

## Summary

- **Call sites:** 19 across 14 files, classified per public/internal split.
- **POST `/api/offers` validation:** Requires `title`, `originalPrice`, `discountPrice`, `category`, `durationMinutes`; always calls slot regen.
- **`/api/pos/catalog`:** Returns offers (no `publishedToMarketplace` field in response), products, customers, employees, provider summary.
- **`receipt.tsx`:** Already 80mm-ready (`@page { size: 80mm auto }`); refactor target for shared layout in Section 5.
- **Onboarding:** None exists; Section 2 is greenfield.
- **`Product.purchasePrice`:** Stored metadata, not consumed in business logic; deprecated placeholder for Section 4.

All call sites are accounted for. No blocking issues found. Ready to proceed with Section 1 migration and filtering.
