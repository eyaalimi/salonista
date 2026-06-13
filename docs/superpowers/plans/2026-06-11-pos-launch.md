# POS Launch Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Salonista's POS deployable door-to-door in under 30 minutes: a service catalogue decoupled from the marketplace, an onboarding wizard, cash-drawer expenses + printable Z report, product cost + stock reception with margin display, and an 80mm thermal print refactor.

**Architecture:** Five feature sections built behind a shared `pos-launch` git branch. Each section gets one or more bite-sized tasks executed in order T1 → T2 → T3 → (T4 ‖ T5) → T6. Schema changes ship as four numbered migrations. The thermal layout is extracted from the existing `receipt.tsx` into `src/components/pos/thermal/` so receipts, the wizard's test ticket, and the Z report share one 80mm CSS block.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript · Prisma 7 (PostgreSQL) · Tailwind v4 · NextAuth v4 · Vitest (pure-logic tests only — no Prisma mocking, by codebase convention).

**Spec reference:** [docs/superpowers/specs/2026-06-11-pos-launch-design.md](../specs/2026-06-11-pos-launch-design.md)

---

## File structure (what gets created or modified)

### Created

| Path | Responsibility |
|---|---|
| `docs/pos-launch-audit.md` | Step 0 audit output — read by every implementer subagent |
| `docs/pos-printing.md` | Thermal printing setup + troubleshooting one-pager |
| `prisma/migrations/20260612120000_offer_marketplace_split/migration.sql` | Add `publishedToMarketplace`, make `originalPrice` nullable, backfill |
| `prisma/migrations/20260612121000_provider_onboarding/migration.sql` | Add `onboardingDismissedAt` to `ProviderProfile` |
| `prisma/migrations/20260612122000_drawer_expenses/migration.sql` | Add `ExpenseCategory` enum + `CashDrawerExpense` model |
| `prisma/migrations/20260612123000_product_cost_price/migration.sql` | Add `Product.costPrice` + `StockMovement.unitCost` |
| `src/lib/drawer-math.ts` | Pure `expectedCash()` + `variance()` functions |
| `src/lib/drawer-math.test.ts` | Vitest pure tests for variance math |
| `src/app/(pos)/pos/services/page.tsx` | Server entry for `/pos/services` |
| `src/components/pos/services-list-client.tsx` | Quick-add + inline edit table |
| `src/app/(pos)/pos/bienvenue/page.tsx` | Server entry for onboarding wizard |
| `src/app/(pos)/pos/bienvenue/test-print/page.tsx` | Ephemeral test-ticket print route |
| `src/components/pos/onboarding/wizard-client.tsx` | Wizard shell with stepper |
| `src/components/pos/onboarding/step1-info.tsx` | Salon info form |
| `src/components/pos/onboarding/step2-services.tsx` | Services quick-add + suggestion chips |
| `src/components/pos/onboarding/step3-products.tsx` | Optional product quick-add |
| `src/components/pos/onboarding/step4-team.tsx` | Employee + PIN management |
| `src/components/pos/onboarding/step5-drawer.tsx` | Open drawer + test ticket |
| `src/components/pos/onboarding/step6-done.tsx` | Recap + "Ouvrir la caisse" |
| `src/app/api/pos/drawer/expenses/route.ts` | POST/GET expenses for current OPEN session |
| `src/app/api/pos/drawer/expenses/[id]/route.ts` | DELETE expense (still-open guard) |
| `src/components/pos/expense-modal.tsx` | "Nouvelle dépense" modal |
| `src/app/(pos)/pos/cash-drawer/[id]/rapport/page.tsx` | Server-rendered Z report |
| `src/components/pos/thermal/thermal-layout.tsx` | `<ThermalLayout>` + primitives |
| `src/components/pos/thermal/receipt-content.tsx` | `<ReceiptContent>` body |
| `src/components/pos/thermal/test-ticket-content.tsx` | `<TestTicketContent>` body |
| `src/components/pos/thermal/z-report-content.tsx` | `<ZReportContent>` body |
| `src/app/api/pos/products/reception-bulk/route.ts` | Bulk PURCHASE endpoint |
| `src/app/(pos)/pos/products/reception/page.tsx` | Multi-product reception screen |
| `src/components/pos/reception-modal.tsx` | Single-product reception modal |
| `src/components/pos/reception-bulk-client.tsx` | Editable multi-product table |

### Modified

| Path | Why |
|---|---|
| `prisma/schema.prisma` | Schema for the 4 migrations + relations |
| `src/app/api/offers/route.ts` | Conditional validation; no slot regen on POS-only |
| `src/app/api/offers/[id]/route.ts` | Same conditional validation on PATCH |
| `src/app/page.tsx` | Filter homepage feed to `publishedToMarketplace: true` |
| `src/app/offres/page.tsx` | Same filter on public catalog |
| `src/app/offre/[id]/page.tsx` | 404 if `!publishedToMarketplace` |
| `src/app/api/collaborations/route.ts` | Influencer picker filter |
| `src/app/sitemap.ts` | Filter |
| `src/components/pos/rail.tsx` | Insert `/pos/services` rail item |
| `src/components/pos/pos-shell-client.tsx` | Onboarding redirect logic |
| `src/app/api/pos/catalog/route.ts` | Add `_count` for offers/products/sales + `onboardingDismissedAt` |
| `src/app/api/pos/cash-drawer/[id]/close/route.ts` | Use `expectedCash()` and subtract expenses |
| `src/components/pos/cash-drawer-indicator.tsx` | "Dépense" button |
| `src/components/pos/cash-drawer-detail-client.tsx` | Expense list + delete button |
| `src/app/api/pos/products/[id]/stock/route.ts` | Accept `unitCost` + `updateCostPrice` |
| `src/components/pos/products-list-client.tsx` | Per-row "Réception" button + margin badge |
| `src/components/pos/product-form.tsx` | Add `costPrice` field |
| `src/components/pos/analytics-client.tsx` | "Marge produits — estimation" card |
| `src/components/pos/receipt.tsx` | Becomes a thin wrapper around `<ThermalLayout>` |
| `src/components/pos/sale-detail-client.tsx` | "Réimprimer" button |
| `prisma/seed.ts` | 4 POS-only services + 2 costed products + 1 closed session w/ expenses |
| `CLAUDE.md` | "POS launch readiness additions" section |
| `CONTEXT.md` | Same narrative + rationale |

---

## Conventions used in every task

- **Branch**: every task commits to `pos-launch`. The branch already exists locally; the spec doc is already committed there.
- **Commits**: one commit per task. Use a Conventional-Commit-style prefix (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`).
- **Prisma client regen**: local `npx prisma generate` is broken (corrupt `effect` package). After schema edits, run `npm run db:push -- --skip-generate` for local sanity if you must, but the generated client at `src/generated/prisma/` will *not* see the new fields until deploy regenerates. Use `as never` casts at call sites until then, exactly like the hardening pass did.
- **Migrations**: never run `prisma migrate dev` — write the SQL by hand under `prisma/migrations/<timestamp>_<name>/migration.sql`, edit `prisma/schema.prisma` to match, commit both. Deploy runs `prisma migrate deploy`.
- **French strings everywhere** in user-facing UI and error messages.
- **POS theme**: every page under `/pos/*` is scoped to `[data-pos-theme]`. Never leak POS styles into marketplace pages.
- **Money**: TND uses 3 decimals. Use `Decimal` from `@/generated/prisma/runtime/library` for arithmetic, never `Number`.

---

## Task 0 — Step 0 audit document

**Files:**
- Create: `docs/pos-launch-audit.md`

This is the audit that the spec's Section 0 makes mandatory. Every implementer subagent reads it before they start.

- [ ] **Step 0.1 — Grep all `prisma.offer.find*` call sites**

Run:
```bash
git grep -n "prisma\.offer\.find" -- src/
```

Expected: 15 hits across the files listed in the spec table. Record any new/missing files in the audit doc.

- [ ] **Step 0.2 — For each hit, classify "public" vs "internal"**

A call is *public* if its result is rendered to anyone who is not the salon owner (homepage feed, public catalog, sitemap, influencer picker showing offers from a salon the influencer doesn't own). All other reads are *internal*. Read each callsite end-to-end before classifying; do not guess from the file name alone.

- [ ] **Step 0.3 — Confirm POST `/api/offers` validation**

Read `src/app/api/offers/route.ts:50-103` (the POST handler) and write the exact required-fields list into the audit. The spec asserts: `title`, `originalPrice`, `discountPrice`, `category`, `durationMinutes` are all required, and `regenerateOfferSlots(offer.id)` is always called.

- [ ] **Step 0.4 — Confirm `/api/pos/catalog` shape**

Read `src/app/api/pos/catalog/route.ts` and write the response shape into the audit (offers select fields, products select fields, customers, employees, provider summary). Note that `offers` already filters on `active: true` and ignores `publishedToMarketplace`.

- [ ] **Step 0.5 — Confirm `receipt.tsx` already implements `@page 80mm`**

Read `src/components/pos/receipt.tsx`. Confirm `@page { size: 80mm auto; margin: 0; }` is already present and that styling uses `<style jsx global>`. Section 5 is a refactor (extract layout), not greenfield.

- [ ] **Step 0.6 — Search for any onboarding screen**

Run:
```bash
git grep -nlE "onboarding|bienvenue|wizard|getStarted" -- src/
```

Expected: no real onboarding screen exists. PWA install prompt or similar is fine; record what is found.

- [ ] **Step 0.7 — Confirm `Product.purchasePrice` is unread**

Run:
```bash
git grep -nE "(purchasePrice|product\.purchase)" -- src/
```

Expected: only the Prisma schema + generated client + seed mention it. No business logic reads it. If any business logic does read it, flag it and adjust Task 4 (we keep writing it in lockstep with `costPrice`).

- [ ] **Step 0.8 — Write the audit doc**

Write `docs/pos-launch-audit.md` with:
1. Confirmed call sites table (file, classification, why).
2. POST /api/offers current behaviour (paste the relevant fragment of route.ts with file:line).
3. `/api/pos/catalog` response shape (one paragraph + the select clauses).
4. `receipt.tsx` baseline (one paragraph: already 80mm-ready, refactor target).
5. Onboarding baseline (one paragraph: none).
6. `Product.purchasePrice` status (deprecated, unread).
7. Any deviations from the spec discovered along the way (each deviation: what, why, recommended adjustment).

- [ ] **Step 0.9 — Commit**

```bash
git add docs/pos-launch-audit.md
git commit -m "docs(pos-launch): step 0 audit — call sites, current routes, onboarding baseline"
```

---

## Section 1 — Decouple service catalogue from marketplace offers

### Task 1.1 — Migration: `publishedToMarketplace` + nullable `originalPrice`

**Files:**
- Create: `prisma/migrations/20260612120000_offer_marketplace_split/migration.sql`
- Modify: `prisma/schema.prisma`

- [ ] **Step 1.1.1 — Write the migration SQL**

Create the file with:

```sql
-- Add the marketplace publication flag.
ALTER TABLE "Offer" ADD COLUMN "publishedToMarketplace" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: every existing offer was created for the marketplace, so flip it on.
UPDATE "Offer" SET "publishedToMarketplace" = true;

-- POS-only services have no "barred price"; let originalPrice be NULL.
ALTER TABLE "Offer" ALTER COLUMN "originalPrice" DROP NOT NULL;
```

- [ ] **Step 1.1.2 — Update `prisma/schema.prisma`**

In the `model Offer { ... }` block, change `originalPrice  Decimal   @db.Decimal(10, 3)` to `originalPrice  Decimal?  @db.Decimal(10, 3)` and add `publishedToMarketplace Boolean @default(false)` next to `active`.

- [ ] **Step 1.1.3 — Commit**

```bash
git add prisma/migrations/20260612120000_offer_marketplace_split prisma/schema.prisma
git commit -m "feat(db): split offer marketplace flag from POS-only services"
```

### Task 1.2 — Conditional validation in `POST /api/offers`

**Files:**
- Modify: `src/app/api/offers/route.ts:50-103`

- [ ] **Step 1.2.1 — Add a `publishedToMarketplace` field to the body destructure**

Replace the destructure on line ~66 with:

```ts
const {
  title,
  description,
  originalPrice,
  discountPrice,
  category,
  photos,
  durationMinutes,
  taxRate,
  publishedToMarketplace = false,
} = body as {
  title?: string;
  description?: string | null;
  originalPrice?: string | number | null;
  discountPrice?: string | number;
  category?: string | null;
  photos?: string[];
  durationMinutes?: number;
  taxRate?: number;
  publishedToMarketplace?: boolean;
};
```

- [ ] **Step 1.2.2 — Replace the existing required-fields check with branched validation**

Replace the block beginning `if (!title || !originalPrice || !discountPrice || !category)` with:

```ts
const missing: string[] = [];
if (!title || !String(title).trim()) missing.push("titre");
if (discountPrice === undefined || discountPrice === null || Number(discountPrice) <= 0) {
  missing.push("prix");
}
const duration = Number(durationMinutes);
if (!ALLOWED_DURATIONS.includes(duration)) missing.push("durée");

const finalCategory = publishedToMarketplace
  ? category
  : (category ?? "AUTRE");

if (publishedToMarketplace) {
  if (!category) missing.push("catégorie");
  if (
    originalPrice === undefined ||
    originalPrice === null ||
    Number(originalPrice) < Number(discountPrice)
  ) {
    missing.push("prix barré (≥ prix actuel)");
  }
  if (!photos || photos.length === 0) missing.push("au moins une photo");
}

if (missing.length > 0) {
  return NextResponse.json(
    { error: `Champs requis manquants : ${missing.join(", ")}` },
    { status: 400 },
  );
}
```

- [ ] **Step 1.2.3 — Update the `prisma.offer.create` call**

Replace the existing `create` payload with:

```ts
const offer = await prisma.offer.create({
  data: {
    providerId: profile.id,
    title: String(title).trim(),
    description: description || null,
    originalPrice: publishedToMarketplace ? originalPrice : (originalPrice ?? null),
    discountPrice,
    category: finalCategory as never,
    photos: photos || [],
    durationMinutes: duration,
    taxRate: tax,
    publishedToMarketplace,
  } as never,
});
```

The `as never` cast is required twice: once on `category` because `finalCategory` is widened to `string | null | undefined`, once on the whole data object because the local Prisma client doesn't see `publishedToMarketplace` yet (broken `prisma generate`). Both casts go away when deploy regenerates.

- [ ] **Step 1.2.4 — Gate slot regeneration on `publishedToMarketplace`**

Replace the line `await regenerateOfferSlots(offer.id);` with:

```ts
if (publishedToMarketplace) {
  await regenerateOfferSlots(offer.id);
}
```

- [ ] **Step 1.2.5 — Commit**

```bash
git add src/app/api/offers/route.ts
git commit -m "feat(offers): conditional validation — POS-only vs marketplace"
```

### Task 1.3 — Conditional validation in `PATCH /api/offers/[id]`

**Files:**
- Modify: `src/app/api/offers/[id]/route.ts`

- [ ] **Step 1.3.1 — Read the current handler**

Run:
```bash
sed -n '1,200p' src/app/api/offers/\[id\]/route.ts
```

Confirm the PATCH currently accepts the same body shape as POST.

- [ ] **Step 1.3.2 — Add the same branched validation around the update**

Wrap the validation block in the PATCH handler with the same `missing[]` logic from Task 1.2 Step 1.2.2, but apply it only when the body explicitly sets `publishedToMarketplace: true` *or* the existing row is already published.

```ts
const existing = await prisma.offer.findUnique({ where: { id } });
if (!existing || existing.providerId !== profile.id) {
  return NextResponse.json({ error: "Offre introuvable" }, { status: 404 });
}

const willBePublished =
  body.publishedToMarketplace ?? (existing as { publishedToMarketplace?: boolean }).publishedToMarketplace ?? false;

if (willBePublished) {
  const missing: string[] = [];
  if (!body.category && !existing.category) missing.push("catégorie");
  const eff_original = body.originalPrice ?? existing.originalPrice;
  const eff_discount = body.discountPrice ?? existing.discountPrice;
  if (eff_original === null || eff_original === undefined || Number(eff_original) < Number(eff_discount)) {
    missing.push("prix barré (≥ prix actuel)");
  }
  const eff_photos = body.photos ?? existing.photos;
  if (!eff_photos || eff_photos.length === 0) missing.push("au moins une photo");
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Publication impossible — champs manquants : ${missing.join(", ")}` },
      { status: 400 },
    );
  }
}
```

- [ ] **Step 1.3.3 — Gate `regenerateOfferSlots` on the post-update `publishedToMarketplace`**

After the `prisma.offer.update` call, replace any unconditional `await regenerateOfferSlots(updated.id);` with:

```ts
if ((updated as { publishedToMarketplace?: boolean }).publishedToMarketplace) {
  await regenerateOfferSlots(updated.id);
}
```

- [ ] **Step 1.3.4 — Commit**

```bash
git add src/app/api/offers/\[id\]/route.ts
git commit -m "feat(offers): conditional validation + slot gating on PATCH"
```

### Task 1.4 — Filter public-facing call sites

**Files:**
- Modify: `src/app/page.tsx`, `src/app/offres/page.tsx`, `src/app/offre/[id]/page.tsx`, `src/app/api/offers/route.ts` (GET public branch only), `src/app/api/collaborations/route.ts`, `src/app/sitemap.ts`

For each file: locate the `prisma.offer.find*` call, add `publishedToMarketplace: true` to the `where`.

- [ ] **Step 1.4.1 — `src/app/page.tsx`**

Find the offers fetch (likely `prisma.offer.findMany({ where: { active: true } })`). Change to:

```ts
const offers = await prisma.offer.findMany({
  where: { active: true, publishedToMarketplace: true } as never,
  // ... rest unchanged
});
```

- [ ] **Step 1.4.2 — `src/app/offres/page.tsx`**

Same change to the offers query.

- [ ] **Step 1.4.3 — `src/app/offre/[id]/page.tsx`**

Find the single-offer fetch. After it, add a 404 short-circuit:

```ts
if (!offer || !offer.active || !(offer as { publishedToMarketplace?: boolean }).publishedToMarketplace) {
  notFound();
}
```

Make sure `notFound` is imported from `next/navigation`.

- [ ] **Step 1.4.4 — `src/app/api/offers/route.ts` GET public branch**

In the GET handler, the *provider* branch (the `if (session?.user?.role === "PROVIDER")` block) stays unchanged. In the *public* fallback (`const where: Record<string, unknown> = { active: true };`), add the marketplace filter:

```ts
const where: Record<string, unknown> = { active: true, publishedToMarketplace: true };
```

- [ ] **Step 1.4.5 — `src/app/api/collaborations/route.ts`**

Find the offers fetch used by the influencer picker. Add `publishedToMarketplace: true` to the `where`.

- [ ] **Step 1.4.6 — `src/app/sitemap.ts`**

Same change to the offers query (only published offers appear in the sitemap).

- [ ] **Step 1.4.7 — Commit**

```bash
git add src/app/page.tsx src/app/offres/page.tsx src/app/offre src/app/api/offers/route.ts src/app/api/collaborations/route.ts src/app/sitemap.ts
git commit -m "feat(marketplace): filter public-facing queries to publishedToMarketplace"
```

### Task 1.5 — `/pos/services` page + quick-add table

**Files:**
- Create: `src/app/(pos)/pos/services/page.tsx`
- Create: `src/components/pos/services-list-client.tsx`
- Modify: `src/components/pos/rail.tsx`

- [ ] **Step 1.5.1 — Create the server entry**

`src/app/(pos)/pos/services/page.tsx`:

```tsx
import { requirePermission } from "@/lib/employee-session";
import { prisma } from "@/lib/prisma";
import { ServicesListClient } from "@/components/pos/services-list-client";

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const employee = await requirePermission("products.manage");
  const offers = await prisma.offer.findMany({
    where: { providerId: employee.providerId },
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      discountPrice: true,
      durationMinutes: true,
      taxRate: true,
      active: true,
      publishedToMarketplace: true,
    } as never,
  });
  return <ServicesListClient initialOffers={offers as never} />;
}
```

- [ ] **Step 1.5.2 — Create the client component**

`src/components/pos/services-list-client.tsx`. Implements:
1. A table with columns: Nom · Prix · Durée · TVA · Actif · Statut marketplace.
2. A quick-add row above the table (always visible).
3. Inline edit on click of a row.
4. Keyboard: `N` focuses the quick-add Name field; `Enter` saves; `Escape` cancels.
5. Marketplace status badge with link to `/prestataire/offres/[id]`.

Full implementation:

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type Offer = {
  id: string;
  title: string;
  discountPrice: string;
  durationMinutes: number;
  taxRate: string;
  active: boolean;
  publishedToMarketplace: boolean;
};

const ALLOWED_DURATIONS = [15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240];

export function ServicesListClient({ initialOffers }: { initialOffers: Offer[] }) {
  const [offers, setOffers] = useState<Offer[]>(initialOffers);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const newNameRef = useRef<HTMLInputElement>(null);

  // Quick-add form state.
  const [qaTitle, setQaTitle] = useState("");
  const [qaPrice, setQaPrice] = useState("");
  const [qaDuration, setQaDuration] = useState(30);
  const [qaTax, setQaTax] = useState(19);

  // N global shortcut focuses the quick-add Name field.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "n" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        newNameRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const saveNew = useCallback(async () => {
    if (!qaTitle.trim() || !qaPrice || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: qaTitle.trim(),
          discountPrice: qaPrice,
          durationMinutes: qaDuration,
          taxRate: qaTax,
          publishedToMarketplace: false,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erreur");
        return;
      }
      setOffers((o) => [...o, json].sort((a, b) => a.title.localeCompare(b.title)));
      setQaTitle("");
      setQaPrice("");
      newNameRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }, [qaTitle, qaPrice, qaDuration, qaTax, busy]);

  async function toggleActive(o: Offer) {
    setBusy(true);
    try {
      const res = await fetch(`/api/offers/${o.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !o.active }),
      });
      if (res.ok) {
        setOffers((arr) => arr.map((x) => (x.id === o.id ? { ...x, active: !o.active } : x)));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full bg-pos-bg p-6 overflow-auto" data-pos-theme>
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-pos-ink">Services</h1>
        <span className="text-xs text-pos-ink-3">Raccourci : <kbd>N</kbd> pour un nouveau service</span>
      </header>

      {error && <div className="mb-4 px-3 py-2 rounded bg-red-50 text-red-800 text-sm">{error}</div>}

      {/* Quick-add row */}
      <div className="grid grid-cols-12 gap-2 mb-2 px-3 py-2 rounded border-2 border-pos-border-strong bg-pos-card">
        <input
          ref={newNameRef}
          className="col-span-4 px-2 py-1 rounded border border-pos-border bg-white"
          placeholder="Nom du service"
          value={qaTitle}
          onChange={(e) => setQaTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveNew();
            if (e.key === "Escape") {
              setQaTitle("");
              setQaPrice("");
            }
          }}
        />
        <input
          className="col-span-2 px-2 py-1 rounded border border-pos-border bg-white"
          type="number"
          step="0.001"
          placeholder="Prix DT"
          value={qaPrice}
          onChange={(e) => setQaPrice(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") saveNew(); }}
        />
        <select
          className="col-span-2 px-2 py-1 rounded border border-pos-border bg-white"
          value={qaDuration}
          onChange={(e) => setQaDuration(Number(e.target.value))}
        >
          {ALLOWED_DURATIONS.map((d) => <option key={d} value={d}>{d} min</option>)}
        </select>
        <input
          className="col-span-1 px-2 py-1 rounded border border-pos-border bg-white"
          type="number"
          step="0.01"
          value={qaTax}
          onChange={(e) => setQaTax(Number(e.target.value))}
        />
        <button
          className="col-span-3 px-3 py-1 rounded bg-pos-ink text-pos-bg disabled:opacity-50"
          disabled={busy || !qaTitle.trim() || !qaPrice}
          onClick={saveNew}
        >
          Ajouter
        </button>
      </div>

      {/* Table */}
      <table className="w-full text-sm">
        <thead className="text-pos-ink-3 text-xs uppercase tracking-wider">
          <tr>
            <th className="text-left px-3 py-2">Nom</th>
            <th className="text-right px-3 py-2">Prix</th>
            <th className="text-right px-3 py-2">Durée</th>
            <th className="text-right px-3 py-2">TVA</th>
            <th className="text-center px-3 py-2">Actif</th>
            <th className="text-left px-3 py-2">Statut</th>
          </tr>
        </thead>
        <tbody>
          {offers.map((o) => (
            <tr key={o.id} className="border-t border-pos-border hover:bg-pos-card/60">
              <td className="px-3 py-2">{o.title}</td>
              <td className="px-3 py-2 text-right">{Number(o.discountPrice).toFixed(3)} DT</td>
              <td className="px-3 py-2 text-right">{o.durationMinutes} min</td>
              <td className="px-3 py-2 text-right">{Number(o.taxRate).toFixed(2)}%</td>
              <td className="px-3 py-2 text-center">
                <input type="checkbox" checked={o.active} onChange={() => toggleActive(o)} />
              </td>
              <td className="px-3 py-2">
                {o.publishedToMarketplace ? (
                  <Link
                    href={`/prestataire/offres/${o.id}`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-50 text-green-800 text-xs"
                  >
                    Publié·e en ligne
                  </Link>
                ) : (
                  <Link
                    href={`/prestataire/offres/${o.id}`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-pos-border text-pos-ink-2 text-xs"
                  >
                    POS uniquement · Publier en ligne →
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 1.5.3 — Add the rail item**

In `src/components/pos/rail.tsx`, the imports already include `lucide-react`. Add `Scissors` to the import list. Then insert the rail item between Calendar and Customers:

```tsx
import {
  LayoutGrid,
  Calendar,
  Scissors,   // ← new
  Users,
  Package,
  Receipt,
  Wallet,
  BarChart3,
} from "lucide-react";

// ...

const items: RailItem[] = [
  { href: "/pos", label: "Caisse", shortcut: "1", icon: <LayoutGrid size={16} />, perm: "pos.sell" },
  { href: "/pos/calendar", label: "RDV du jour", shortcut: "B", icon: <Calendar size={16} />, perm: "bookings.view" },
  { href: "/pos/services", label: "Services", shortcut: "S", icon: <Scissors size={16} />, perm: "products.manage" }, // ← new
  { href: "/pos/customers", label: "Clients", shortcut: "C", icon: <Users size={16} />, perm: "customers.view" },
  { href: "/pos/products", label: "Produits", shortcut: "P", icon: <Package size={16} />, perm: "inventory.view" },
];
```

- [ ] **Step 1.5.4 — Smoke test the page**

Run `npm run dev`. Log in as a provider. Navigate to `/pos/services`. The page should render with the quick-add row and the list of existing services. Press `N`, type "Brushing test", price `25`, Enter. The new service appears in the table.

- [ ] **Step 1.5.5 — Commit**

```bash
git add src/app/\(pos\)/pos/services src/components/pos/services-list-client.tsx src/components/pos/rail.tsx
git commit -m "feat(pos): /pos/services quick-add and inline list"
```

---

## Section 2 — Onboarding wizard `/pos/bienvenue`

### Task 2.1 — Migration: `ProviderProfile.onboardingDismissedAt`

**Files:**
- Create: `prisma/migrations/20260612121000_provider_onboarding/migration.sql`
- Modify: `prisma/schema.prisma`

- [ ] **Step 2.1.1 — Write the SQL**

```sql
ALTER TABLE "ProviderProfile" ADD COLUMN "onboardingDismissedAt" TIMESTAMP(3);
```

- [ ] **Step 2.1.2 — Edit the schema**

In `model ProviderProfile { ... }`, after `receiptFooter   String?`, add:

```prisma
onboardingDismissedAt DateTime?
```

- [ ] **Step 2.1.3 — Commit**

```bash
git add prisma/migrations/20260612121000_provider_onboarding prisma/schema.prisma
git commit -m "feat(db): onboardingDismissedAt on ProviderProfile"
```

### Task 2.2 — `/api/pos/catalog` returns onboarding counts

**Files:**
- Modify: `src/app/api/pos/catalog/route.ts`

- [ ] **Step 2.2.1 — Add the three counts to the Promise.all**

In the `Promise.all` block (currently 5 queries), add a sixth:

```ts
const onboardingCountsP = prisma.providerProfile.findUnique({
  where: { id: providerId },
  select: {
    onboardingDismissedAt: true,
    _count: { select: { offers: true, products: true, sales: true } },
  } as never,
});
```

Add `onboardingCountsP` to the destructured await.

- [ ] **Step 2.2.2 — Include `onboarding` in the response**

At the bottom of the route, change the `Response.json` to:

```ts
return Response.json({
  refreshedAt: new Date().toISOString(),
  provider,
  offers,
  products,
  customers: customersWithWallets,
  employees,
  onboarding: onboardingCounts
    ? {
        dismissedAt: (onboardingCounts as { onboardingDismissedAt: Date | null }).onboardingDismissedAt,
        offersCount: (onboardingCounts as { _count: { offers: number } })._count.offers,
        productsCount: (onboardingCounts as { _count: { products: number } })._count.products,
        salesCount: (onboardingCounts as { _count: { sales: number } })._count.sales,
      }
    : null,
});
```

- [ ] **Step 2.2.3 — Commit**

```bash
git add src/app/api/pos/catalog/route.ts
git commit -m "feat(pos): catalog returns onboarding counts"
```

### Task 2.3 — Redirect in `pos-shell-client.tsx`

**Files:**
- Modify: `src/components/pos/pos-shell-client.tsx`

- [ ] **Step 2.3.1 — Add the redirect effect**

After the existing catalog-load `useEffect`, add:

```tsx
import { useRouter } from "next/navigation";
// ...
const router = useRouter();

useEffect(() => {
  if (!catalog) return;
  const onboarding = (catalog as { onboarding?: {
    dismissedAt: Date | string | null;
    offersCount: number;
    productsCount: number;
    salesCount: number;
  } | null }).onboarding;
  if (!onboarding) return;
  if (employee.role !== "OWNER") return;
  if (onboarding.dismissedAt) return;
  if (onboarding.offersCount > 0) return;
  if (onboarding.productsCount > 0) return;
  if (onboarding.salesCount > 0) return;
  router.replace("/pos/bienvenue");
}, [catalog, employee.role, router]);
```

- [ ] **Step 2.3.2 — Commit**

```bash
git add src/components/pos/pos-shell-client.tsx
git commit -m "feat(pos): redirect fresh owners to /pos/bienvenue"
```

### Task 2.4 — Wizard shell + stepper

**Files:**
- Create: `src/app/(pos)/pos/bienvenue/page.tsx`
- Create: `src/components/pos/onboarding/wizard-client.tsx`

- [ ] **Step 2.4.1 — Server entry**

```tsx
// src/app/(pos)/pos/bienvenue/page.tsx
import { requireEmployee } from "@/lib/employee-session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { WizardClient } from "@/components/pos/onboarding/wizard-client";

export const dynamic = "force-dynamic";

export default async function BienvenuePage() {
  const employee = await requireEmployee();
  if (employee.role !== "OWNER") redirect("/pos");

  const provider = await prisma.providerProfile.findUnique({
    where: { id: employee.providerId },
    select: {
      id: true,
      salonName: true,
      phone: true,
      address: true,
      city: true,
      matriculeFiscal: true,
      receiptFooter: true,
      onboardingDismissedAt: true,
      _count: { select: { offers: true, products: true, employees: true, sales: true, cashDrawerSessions: true } },
    } as never,
  });
  if (!provider) redirect("/pos");

  return <WizardClient initialProvider={provider as never} employeeId={employee.id} />;
}
```

- [ ] **Step 2.4.2 — Wizard shell with stepper**

```tsx
// src/components/pos/onboarding/wizard-client.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Step1Info } from "./step1-info";
import { Step2Services } from "./step2-services";
import { Step3Products } from "./step3-products";
import { Step4Team } from "./step4-team";
import { Step5Drawer } from "./step5-drawer";
import { Step6Done } from "./step6-done";

type Provider = {
  id: string;
  salonName: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  matriculeFiscal: string | null;
  receiptFooter: string | null;
  onboardingDismissedAt: Date | null;
  _count: { offers: number; products: number; employees: number; sales: number; cashDrawerSessions: number };
};

const STEPS = ["Infos salon", "Services", "Produits", "Équipe", "Tiroir & ticket", "Terminé"];

function localStorageGetSafe(key: string): string | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(key); } catch { return null; }
}

export function WizardClient({ initialProvider, employeeId }: { initialProvider: Provider; employeeId: string }) {
  const router = useRouter();
  const [provider, setProvider] = useState(initialProvider);
  const [forcedStep, setForcedStep] = useState<number | null>(null);

  const productsSkipped = localStorageGetSafe(`onboarding.productsSkipped.${provider.id}`);
  const testTicketPrintedAt = localStorageGetSafe(`onboarding.testTicketPrintedAt.${provider.id}`);

  const currentStep = useMemo(() => {
    if (forcedStep !== null) return forcedStep;
    if (!provider.salonName || !provider.phone) return 0;
    if (provider._count.offers === 0) return 1;
    if (provider._count.products === 0 && !productsSkipped) return 2;
    if (provider._count.employees === 0) return 3;
    if (provider._count.cashDrawerSessions === 0 || !testTicketPrintedAt) return 4;
    return 5;
  }, [provider, productsSkipped, testTicketPrintedAt, forcedStep]);

  async function dismiss() {
    await fetch("/api/provider/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboardingDismissedAt: new Date().toISOString() }),
    });
    router.replace("/pos");
  }

  return (
    <div className="min-h-screen bg-pos-bg p-6" data-pos-theme>
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-pos-ink">Bienvenue sur Salonista</h1>
        <button
          onClick={() => {
            if (confirm("Vous pourrez revenir plus tard, ou rouvrir le wizard depuis /pos/bienvenue.")) {
              dismiss();
            }
          }}
          className="text-sm text-pos-ink-3 hover:text-pos-ink"
        >
          Quitter sans terminer
        </button>
      </header>

      <div className="mb-8 flex gap-1">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`flex-1 h-1 rounded ${
              i < currentStep ? "bg-pos-accent" : i === currentStep ? "bg-pos-ink" : "bg-pos-border"
            }`}
            title={label}
          />
        ))}
      </div>

      <p className="text-xs uppercase tracking-wider text-pos-ink-3 mb-2">
        Étape {currentStep + 1}/6
      </p>
      <h2 className="text-xl font-semibold mb-6 text-pos-ink">{STEPS[currentStep]}</h2>

      {currentStep === 0 && <Step1Info provider={provider} onSaved={setProvider} onNext={() => setForcedStep(1)} />}
      {currentStep === 1 && <Step2Services provider={provider} onAdded={setProvider} onNext={() => setForcedStep(2)} onBack={() => setForcedStep(0)} />}
      {currentStep === 2 && <Step3Products provider={provider} onAdded={setProvider} onNext={() => setForcedStep(3)} onSkip={() => setForcedStep(3)} onBack={() => setForcedStep(1)} />}
      {currentStep === 3 && <Step4Team provider={provider} onAdded={setProvider} onNext={() => setForcedStep(4)} onBack={() => setForcedStep(2)} />}
      {currentStep === 4 && <Step5Drawer provider={provider} employeeId={employeeId} onDone={() => setForcedStep(5)} onBack={() => setForcedStep(3)} />}
      {currentStep === 5 && <Step6Done provider={provider} onFinish={dismiss} onBack={() => setForcedStep(4)} />}
    </div>
  );
}
```

- [ ] **Step 2.4.3 — Commit**

```bash
git add src/app/\(pos\)/pos/bienvenue/page.tsx src/components/pos/onboarding/wizard-client.tsx
git commit -m "feat(onboarding): wizard shell + stepper"
```

### Task 2.5 — Step 1 (Infos salon)

**Files:**
- Create: `src/components/pos/onboarding/step1-info.tsx`

- [ ] **Step 2.5.1 — Write the component**

```tsx
"use client";
import { useState } from "react";

type Provider = {
  id: string;
  salonName: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  matriculeFiscal: string | null;
  receiptFooter: string | null;
};

export function Step1Info({
  provider,
  onSaved,
  onNext,
}: {
  provider: Provider;
  onSaved: (p: Provider) => void;
  onNext: () => void;
}) {
  const [form, setForm] = useState({
    salonName: provider.salonName ?? "",
    phone: provider.phone ?? "",
    address: provider.address ?? "",
    city: provider.city ?? "",
    matriculeFiscal: provider.matriculeFiscal ?? "",
    receiptFooter: provider.receiptFooter ?? "Merci de votre visite !",
  });
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    await fetch("/api/provider/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    onSaved({ ...provider, ...form });
    setBusy(false);
  }

  const canContinue = form.salonName.trim() && form.phone.trim();

  return (
    <div className="max-w-xl space-y-4">
      <label className="block">
        <span className="text-sm text-pos-ink-2">Nom du salon</span>
        <input
          className="mt-1 block w-full px-3 py-2 rounded border border-pos-border bg-white"
          value={form.salonName}
          onChange={(e) => setForm({ ...form, salonName: e.target.value })}
          onBlur={save}
        />
      </label>
      <label className="block">
        <span className="text-sm text-pos-ink-2">Téléphone</span>
        <input
          className="mt-1 block w-full px-3 py-2 rounded border border-pos-border bg-white"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          onBlur={save}
        />
      </label>
      <label className="block">
        <span className="text-sm text-pos-ink-2">Adresse</span>
        <input
          className="mt-1 block w-full px-3 py-2 rounded border border-pos-border bg-white"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          onBlur={save}
        />
      </label>
      <label className="block">
        <span className="text-sm text-pos-ink-2">Ville</span>
        <input
          className="mt-1 block w-full px-3 py-2 rounded border border-pos-border bg-white"
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
          onBlur={save}
        />
      </label>
      <label className="block">
        <span className="text-sm text-pos-ink-2">Matricule fiscal <span className="text-pos-ink-3">(facultatif)</span></span>
        <input
          className="mt-1 block w-full px-3 py-2 rounded border border-pos-border bg-white"
          value={form.matriculeFiscal}
          onChange={(e) => setForm({ ...form, matriculeFiscal: e.target.value })}
          onBlur={save}
          placeholder="n° d'identification fiscale, optionnel"
        />
      </label>
      <label className="block">
        <span className="text-sm text-pos-ink-2">Message en bas de ticket</span>
        <textarea
          className="mt-1 block w-full px-3 py-2 rounded border border-pos-border bg-white"
          rows={3}
          value={form.receiptFooter}
          onChange={(e) => setForm({ ...form, receiptFooter: e.target.value })}
          onBlur={save}
        />
      </label>

      <div className="pt-4 flex justify-end">
        <button
          disabled={!canContinue || busy}
          onClick={onNext}
          className="px-5 py-2 rounded bg-pos-ink text-pos-bg disabled:opacity-50"
        >
          Suivant →
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2.5.2 — Commit**

```bash
git add src/components/pos/onboarding/step1-info.tsx
git commit -m "feat(onboarding): step 1 salon info form"
```

### Task 2.6 — Step 2 (Services with suggestion chips)

**Files:**
- Create: `src/components/pos/onboarding/step2-services.tsx`

- [ ] **Step 2.6.1 — Define chip presets**

Top of file:

```ts
const CHIPS: { label: string; duration: number }[] = [
  { label: "Brushing", duration: 30 },
  { label: "Coupe femme", duration: 45 },
  { label: "Coupe homme", duration: 20 },
  { label: "Couleur", duration: 90 },
  { label: "Mèches", duration: 120 },
  { label: "Lissage", duration: 120 },
  { label: "Soin visage", duration: 60 },
  { label: "Manucure", duration: 30 },
  { label: "Pédicure", duration: 45 },
  { label: "Épilation sourcils", duration: 15 },
];
```

- [ ] **Step 2.6.2 — Write the full component**

```tsx
"use client";
import { useState } from "react";

type Provider = { id: string; _count: { offers: number; products: number; employees: number; sales: number; cashDrawerSessions: number } };
type Added = { id: string; title: string; discountPrice: string; durationMinutes: number };

const CHIPS = [
  { label: "Brushing", duration: 30 },
  { label: "Coupe femme", duration: 45 },
  { label: "Coupe homme", duration: 20 },
  { label: "Couleur", duration: 90 },
  { label: "Mèches", duration: 120 },
  { label: "Lissage", duration: 120 },
  { label: "Soin visage", duration: 60 },
  { label: "Manucure", duration: 30 },
  { label: "Pédicure", duration: 45 },
  { label: "Épilation sourcils", duration: 15 },
];

export function Step2Services({
  provider,
  onAdded,
  onNext,
  onBack,
}: {
  provider: Provider;
  onAdded: (p: Provider) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState(30);
  const [added, setAdded] = useState<Added[]>([]);
  const [busy, setBusy] = useState(false);

  async function addOne() {
    if (!title.trim() || !price || busy) return;
    setBusy(true);
    const res = await fetch("/api/offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        discountPrice: price,
        durationMinutes: duration,
        publishedToMarketplace: false,
      }),
    });
    if (res.ok) {
      const o = await res.json();
      setAdded((arr) => [...arr, o]);
      onAdded({ ...provider, _count: { ...provider._count, offers: provider._count.offers + 1 } });
      setTitle("");
      setPrice("");
    }
    setBusy(false);
  }

  function applyChip(label: string, dur: number) {
    setTitle(label);
    setDuration(dur);
  }

  const canContinue = added.length > 0 || provider._count.offers > 0;

  return (
    <div className="max-w-2xl">
      <p className="text-sm text-pos-ink-2 mb-3">Cliquez sur une suggestion ou tapez un nom :</p>
      <div className="flex flex-wrap gap-2 mb-5">
        {CHIPS.map((c) => (
          <button
            key={c.label}
            onClick={() => applyChip(c.label, c.duration)}
            className="px-3 py-1 rounded-full border border-pos-border text-sm hover:bg-pos-card"
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-2 mb-3 px-3 py-2 rounded border border-pos-border-strong">
        <input
          className="col-span-5 px-2 py-1 rounded border border-pos-border bg-white"
          placeholder="Nom du service"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addOne(); }}
        />
        <input
          className="col-span-3 px-2 py-1 rounded border border-pos-border bg-white"
          type="number"
          step="0.001"
          placeholder="Prix DT"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addOne(); }}
        />
        <select
          className="col-span-2 px-2 py-1 rounded border border-pos-border bg-white"
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
        >
          {[15, 20, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240].map((d) => (
            <option key={d} value={d}>{d} min</option>
          ))}
        </select>
        <button
          disabled={busy || !title.trim() || !price}
          onClick={addOne}
          className="col-span-2 px-3 py-1 rounded bg-pos-ink text-pos-bg disabled:opacity-50"
        >
          Ajouter
        </button>
      </div>

      {added.length > 0 && (
        <ul className="text-sm mb-4">
          {added.map((a) => (
            <li key={a.id} className="py-1 border-t border-pos-border">
              {a.title} — {Number(a.discountPrice).toFixed(3)} DT — {a.durationMinutes} min
            </li>
          ))}
        </ul>
      )}

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="text-sm text-pos-ink-3">← Précédent</button>
        <button
          disabled={!canContinue}
          onClick={onNext}
          className="px-5 py-2 rounded bg-pos-ink text-pos-bg disabled:opacity-50"
        >
          Suivant →
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2.6.3 — Commit**

```bash
git add src/components/pos/onboarding/step2-services.tsx
git commit -m "feat(onboarding): step 2 services with chips + quick add"
```

### Task 2.7 — Steps 3, 4, 5, 6

This task bundles four small step components because each is < 60 lines and they share patterns. Each gets its own commit-able chunk inside the task — keep them as one commit at the end.

**Files:**
- Create: `src/components/pos/onboarding/step3-products.tsx`
- Create: `src/components/pos/onboarding/step4-team.tsx`
- Create: `src/components/pos/onboarding/step5-drawer.tsx`
- Create: `src/components/pos/onboarding/step6-done.tsx`

- [ ] **Step 2.7.1 — Step 3 (Produits, skippable)**

```tsx
"use client";
import { useState } from "react";

type Provider = { id: string; _count: { offers: number; products: number; employees: number; sales: number; cashDrawerSessions: number } };

export function Step3Products({
  provider, onAdded, onNext, onSkip, onBack,
}: {
  provider: Provider;
  onAdded: (p: Provider) => void;
  onNext: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const [name, setName] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [barcode, setBarcode] = useState("");
  const [stock, setStock] = useState(0);
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!name.trim() || !salePrice) return;
    setBusy(true);
    const res = await fetch("/api/pos/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        salePrice,
        costPrice: costPrice || null,
        barcode: barcode || null,
        stockQuantity: stock,
      }),
    });
    if (res.ok) {
      onAdded({ ...provider, _count: { ...provider._count, products: provider._count.products + 1 } });
      setName(""); setSalePrice(""); setCostPrice(""); setBarcode(""); setStock(0);
    }
    setBusy(false);
  }

  function skip() {
    if (typeof window !== "undefined") {
      try { window.localStorage.setItem(`onboarding.productsSkipped.${provider.id}`, "1"); } catch {}
    }
    onSkip();
  }

  return (
    <div className="max-w-2xl space-y-3">
      <p className="text-sm text-pos-ink-2">Ajoutez vos produits revendus (shampoings, masques…). Vous pouvez passer cette étape.</p>

      <input className="block w-full px-3 py-2 rounded border border-pos-border bg-white" placeholder="Nom du produit" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <input className="px-3 py-2 rounded border border-pos-border bg-white" type="number" step="0.001" placeholder="Prix de vente" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
        <input className="px-3 py-2 rounded border border-pos-border bg-white" type="number" step="0.001" placeholder="Prix d'achat HT (opt.)" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input className="px-3 py-2 rounded border border-pos-border bg-white" placeholder="Code-barres (scannez ici)" autoFocus value={barcode} onChange={(e) => setBarcode(e.target.value)} />
        <input className="px-3 py-2 rounded border border-pos-border bg-white" type="number" placeholder="Stock initial" value={stock} onChange={(e) => setStock(Number(e.target.value))} />
      </div>
      <button disabled={busy || !name.trim() || !salePrice} onClick={add} className="px-4 py-2 rounded bg-pos-ink text-pos-bg disabled:opacity-50">Ajouter ce produit</button>

      <div className="flex justify-between pt-4">
        <button onClick={onBack} className="text-sm text-pos-ink-3">← Précédent</button>
        <div className="flex gap-3">
          <button onClick={skip} className="px-4 py-2 text-sm text-pos-ink-2">Passer cette étape</button>
          <button onClick={onNext} disabled={provider._count.products === 0} className="px-5 py-2 rounded bg-pos-ink text-pos-bg disabled:opacity-50">Suivant →</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2.7.2 — Step 4 (Équipe, minimal inline form)**

```tsx
"use client";
import { useState } from "react";

type Provider = { id: string; _count: { offers: number; products: number; employees: number; sales: number; cashDrawerSessions: number } };

export function Step4Team({
  provider, onAdded, onNext, onBack,
}: {
  provider: Provider;
  onAdded: (p: Provider) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"CASHIER" | "STYLIST" | "MANAGER">("CASHIER");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    if (!displayName.trim() || pin.length < 4) {
      setError("Nom et PIN (4 à 6 chiffres) requis");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/pos/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: displayName.trim(), role, pin }),
    });
    if (res.ok) {
      onAdded({ ...provider, _count: { ...provider._count, employees: provider._count.employees + 1 } });
      setDisplayName(""); setPin("");
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Erreur");
    }
    setBusy(false);
  }

  return (
    <div className="max-w-2xl space-y-3">
      <p className="text-sm text-pos-ink-2">
        Chaque employé entre son PIN à la prise de poste pour identifier ses ventes et restreindre les actions sensibles.
      </p>
      {error && <div className="px-3 py-2 rounded bg-red-50 text-red-800 text-sm">{error}</div>}
      <div className="grid grid-cols-12 gap-2">
        <input className="col-span-5 px-3 py-2 rounded border border-pos-border bg-white" placeholder="Nom affiché" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        <select className="col-span-3 px-3 py-2 rounded border border-pos-border bg-white" value={role} onChange={(e) => setRole(e.target.value as "CASHIER" | "STYLIST" | "MANAGER")}>
          <option value="CASHIER">Caissier·ère</option>
          <option value="STYLIST">Coiffeur·euse</option>
          <option value="MANAGER">Manager</option>
        </select>
        <input className="col-span-2 px-3 py-2 rounded border border-pos-border bg-white" placeholder="PIN" type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
        <button disabled={busy} onClick={add} className="col-span-2 px-3 py-2 rounded bg-pos-ink text-pos-bg disabled:opacity-50">Ajouter</button>
      </div>

      <p className="text-sm text-pos-ink-3 pt-2">Employés ajoutés : {provider._count.employees}</p>

      <div className="flex justify-between pt-4">
        <button onClick={onBack} className="text-sm text-pos-ink-3">← Précédent</button>
        <button onClick={onNext} disabled={provider._count.employees === 0} className="px-5 py-2 rounded bg-pos-ink text-pos-bg disabled:opacity-50">Suivant →</button>
      </div>
    </div>
  );
}
```

If `POST /api/pos/employees` does not exist, the audit (Task 0) flags this and the implementer creates a minimal version that mirrors what `/prestataire/profil` does. Match the existing pattern; do not invent a new shape.

- [ ] **Step 2.7.3 — Step 5 (Tiroir + ticket test)**

```tsx
"use client";
import { useState } from "react";

type Provider = { id: string; salonName: string; _count: { cashDrawerSessions: number } };

export function Step5Drawer({
  provider, employeeId, onDone, onBack,
}: {
  provider: Provider;
  employeeId: string;
  onDone: () => void;
  onBack: () => void;
}) {
  const [openingFloat, setOpeningFloat] = useState("100.000");
  const [drawerOpen, setDrawerOpen] = useState(provider._count.cashDrawerSessions > 0);
  const [printed, setPrinted] = useState(false);
  const [busy, setBusy] = useState(false);

  async function openDrawer() {
    setBusy(true);
    const res = await fetch("/api/pos/cash-drawer/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openingFloat }),
    });
    if (res.ok) setDrawerOpen(true);
    setBusy(false);
  }

  function printTestTicket() {
    if (typeof window !== "undefined") {
      try { window.localStorage.setItem(`onboarding.testTicketPrintedAt.${provider.id}`, String(Date.now())); } catch {}
    }
    setPrinted(true);
    window.open("/pos/bienvenue/test-print", "_blank");
  }

  return (
    <div className="max-w-xl space-y-4">
      <section className="p-4 rounded border border-pos-border bg-pos-card">
        <h3 className="text-base font-medium mb-2">1. Ouvrir le tiroir</h3>
        {!drawerOpen ? (
          <div className="flex gap-2">
            <input className="px-3 py-2 rounded border border-pos-border bg-white" type="number" step="0.001" value={openingFloat} onChange={(e) => setOpeningFloat(e.target.value)} />
            <button disabled={busy} onClick={openDrawer} className="px-4 py-2 rounded bg-pos-ink text-pos-bg disabled:opacity-50">Ouvrir avec {openingFloat} DT</button>
          </div>
        ) : (
          <p className="text-sm text-green-800">✅ Caisse ouverte avec {Number(openingFloat).toFixed(3)} DT</p>
        )}
      </section>

      <section className="p-4 rounded border border-pos-border bg-pos-card">
        <h3 className="text-base font-medium mb-2">2. Tester l'imprimante</h3>
        {!printed ? (
          <button onClick={printTestTicket} disabled={!drawerOpen} className="px-4 py-2 rounded bg-pos-ink text-pos-bg disabled:opacity-50">
            Imprimer un ticket test
          </button>
        ) : (
          <p className="text-sm text-green-800">✅ Ticket test imprimé</p>
        )}
      </section>

      <div className="flex justify-between pt-4">
        <button onClick={onBack} className="text-sm text-pos-ink-3">← Précédent</button>
        <button onClick={onDone} disabled={!drawerOpen || !printed} className="px-5 py-2 rounded bg-pos-ink text-pos-bg disabled:opacity-50">
          Suivant →
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2.7.4 — Step 6 (Terminé)**

```tsx
"use client";

type Provider = { salonName: string; _count: { offers: number; products: number; employees: number; cashDrawerSessions: number } };

export function Step6Done({ provider, onFinish, onBack }: { provider: Provider; onFinish: () => void; onBack: () => void; }) {
  return (
    <div className="max-w-xl space-y-4">
      <div className="p-5 rounded border border-pos-border bg-pos-card">
        <h3 className="text-lg font-medium mb-3">Récapitulatif — {provider.salonName}</h3>
        <ul className="text-sm space-y-1 text-pos-ink-2">
          <li>{provider._count.offers} services</li>
          <li>{provider._count.products} produits</li>
          <li>{provider._count.employees} employés</li>
          <li>{provider._count.cashDrawerSessions} session(s) de caisse</li>
        </ul>
      </div>
      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="text-sm text-pos-ink-3">← Précédent</button>
        <button onClick={onFinish} className="px-5 py-2 rounded bg-pos-ink text-pos-bg">Ouvrir la caisse →</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2.7.5 — Commit all four steps**

```bash
git add src/components/pos/onboarding/step3-products.tsx src/components/pos/onboarding/step4-team.tsx src/components/pos/onboarding/step5-drawer.tsx src/components/pos/onboarding/step6-done.tsx
git commit -m "feat(onboarding): steps 3-6 products, team, drawer, done"
```

### Task 2.8 — Smoke test the wizard

- [ ] **Step 2.8.1 — Reset a provider profile to look fresh**

Run, locally:

```bash
sudo -u postgres psql salonista -c "UPDATE \"ProviderProfile\" SET \"onboardingDismissedAt\" = NULL;"
sudo -u postgres psql salonista -c "DELETE FROM \"Offer\";"
sudo -u postgres psql salonista -c "DELETE FROM \"Product\";"
sudo -u postgres psql salonista -c "DELETE FROM \"Sale\";"
```

(Local Postgres only. Never run this on prod.)

- [ ] **Step 2.8.2 — Walk the wizard**

`npm run dev`, log in as the provider, go to `/pos`. You should land on `/pos/bienvenue`. Complete each step. At step 5, the test ticket opens in a new tab and prints. At step 6, "Ouvrir la caisse" sets `onboardingDismissedAt`, sends you to `/pos`, and you never see the wizard again.

(Note: Task 5 implements `/pos/bienvenue/test-print`. Until then, this smoke test will 404 at the print tab — that is expected.)

---

## Section 3 — Cash drawer expenses + printable Z report

### Task 3.1 — Migration: `CashDrawerExpense`

**Files:**
- Create: `prisma/migrations/20260612122000_drawer_expenses/migration.sql`
- Modify: `prisma/schema.prisma`

- [ ] **Step 3.1.1 — Write the SQL**

```sql
CREATE TYPE "ExpenseCategory" AS ENUM ('FOURNISSEUR', 'LIVRAISON', 'AVANCE_SALAIRE', 'ENTRETIEN', 'AUTRE');

CREATE TABLE "CashDrawerExpense" (
  "id" TEXT NOT NULL,
  "cashDrawerSessionId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "amount" DECIMAL(10,3) NOT NULL,
  "reason" TEXT NOT NULL,
  "category" "ExpenseCategory" NOT NULL DEFAULT 'AUTRE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CashDrawerExpense_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CashDrawerExpense"
  ADD CONSTRAINT "CashDrawerExpense_cashDrawerSessionId_fkey"
  FOREIGN KEY ("cashDrawerSessionId") REFERENCES "CashDrawerSession"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CashDrawerExpense"
  ADD CONSTRAINT "CashDrawerExpense_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "SalonEmployee"("id")
  ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE INDEX "CashDrawerExpense_cashDrawerSessionId_idx" ON "CashDrawerExpense"("cashDrawerSessionId");
CREATE INDEX "CashDrawerExpense_employeeId_idx" ON "CashDrawerExpense"("employeeId");
```

- [ ] **Step 3.1.2 — Edit `prisma/schema.prisma`**

Add the enum at the top of the enum section:

```prisma
enum ExpenseCategory {
  FOURNISSEUR
  LIVRAISON
  AVANCE_SALAIRE
  ENTRETIEN
  AUTRE
}
```

Add the model:

```prisma
model CashDrawerExpense {
  id                    String           @id @default(cuid())
  cashDrawerSessionId   String
  employeeId            String
  amount                Decimal          @db.Decimal(10, 3)
  reason                String
  category              ExpenseCategory  @default(AUTRE)
  createdAt             DateTime         @default(now())

  cashDrawerSession CashDrawerSession @relation(fields: [cashDrawerSessionId], references: [id], onDelete: Restrict)
  employee          SalonEmployee     @relation("CashDrawerExpenseEmployee", fields: [employeeId], references: [id])

  @@index([cashDrawerSessionId])
  @@index([employeeId])
}
```

In `model CashDrawerSession`, add `expenses CashDrawerExpense[]`.

In `model SalonEmployee`, add `expensesRecorded CashDrawerExpense[] @relation("CashDrawerExpenseEmployee")`.

- [ ] **Step 3.1.3 — Commit**

```bash
git add prisma/migrations/20260612122000_drawer_expenses prisma/schema.prisma
git commit -m "feat(db): cash drawer expenses model + ExpenseCategory enum"
```

### Task 3.2 — Pure variance math + Vitest

**Files:**
- Create: `src/lib/drawer-math.ts`
- Create: `src/lib/drawer-math.test.ts`

- [ ] **Step 3.2.1 — Write the failing test first**

```ts
// src/lib/drawer-math.test.ts
import { describe, it, expect } from "vitest";
import { Decimal } from "@/generated/prisma/runtime/library";
import { expectedCash, variance } from "./drawer-math";

const D = (x: string) => new Decimal(x);

describe("expectedCash", () => {
  it("happy path: 100 + 820 − 60 − 35 = 825", () => {
    const r = expectedCash({ openingFloat: D("100.000"), cashSales: D("820.000"), cashRefunds: D("60.000"), expenses: D("35.000") });
    expect(r.toFixed(3)).toBe("825.000");
  });
  it("opening 0, no expenses, no refunds", () => {
    const r = expectedCash({ openingFloat: D("0"), cashSales: D("50.000"), cashRefunds: D("0"), expenses: D("0") });
    expect(r.toFixed(3)).toBe("50.000");
  });
  it("expenses > cashSales: variance allowed to go negative beyond cashSales", () => {
    const r = expectedCash({ openingFloat: D("100.000"), cashSales: D("20.000"), cashRefunds: D("0"), expenses: D("50.000") });
    expect(r.toFixed(3)).toBe("70.000");
  });
  it("3-decimal TND precision round-trips exact", () => {
    const r = expectedCash({ openingFloat: D("0.001"), cashSales: D("0.002"), cashRefunds: D("0"), expenses: D("0") });
    expect(r.toFixed(3)).toBe("0.003");
  });
});

describe("variance", () => {
  it("missing counted < expected returns negative", () => {
    expect(variance(D("825.000"), D("820.000")).toFixed(3)).toBe("-5.000");
  });
  it("excess counted > expected returns positive", () => {
    expect(variance(D("825.000"), D("830.000")).toFixed(3)).toBe("5.000");
  });
  it("counted = expected returns 0", () => {
    expect(variance(D("825.000"), D("825.000")).toFixed(3)).toBe("0.000");
  });
});
```

- [ ] **Step 3.2.2 — Run the failing test**

```bash
npx vitest run src/lib/drawer-math.test.ts
```

Expected: FAIL with `Cannot find module './drawer-math'`.

- [ ] **Step 3.2.3 — Implement**

```ts
// src/lib/drawer-math.ts
import { Decimal } from "@/generated/prisma/runtime/library";

export type DrawerInputs = {
  openingFloat: Decimal;
  cashSales: Decimal;
  cashRefunds: Decimal;
  expenses: Decimal;
};

/** openingFloat + cashSales − cashRefunds − expenses */
export function expectedCash(d: DrawerInputs): Decimal {
  return d.openingFloat.add(d.cashSales).sub(d.cashRefunds).sub(d.expenses);
}

/** counted − expected. Positive = excess, negative = missing. */
export function variance(expected: Decimal, counted: Decimal): Decimal {
  return counted.sub(expected);
}
```

- [ ] **Step 3.2.4 — Run tests, expect green**

```bash
npx vitest run src/lib/drawer-math.test.ts
```

Expected: 7 tests pass.

- [ ] **Step 3.2.5 — Commit**

```bash
git add src/lib/drawer-math.ts src/lib/drawer-math.test.ts
git commit -m "feat(drawer): pure expectedCash + variance with tests"
```

### Task 3.3 — Expense API routes

**Files:**
- Create: `src/app/api/pos/drawer/expenses/route.ts`
- Create: `src/app/api/pos/drawer/expenses/[id]/route.ts`

- [ ] **Step 3.3.1 — POST and GET on the collection**

```ts
// src/app/api/pos/drawer/expenses/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, toResponse } from "@/lib/employee-session";

const VALID_CATEGORIES = ["FOURNISSEUR", "LIVRAISON", "AVANCE_SALAIRE", "ENTRETIEN", "AUTRE"] as const;

export async function POST(req: NextRequest) {
  let employee;
  try { employee = await requirePermission("pos.cash_drawer"); }
  catch (err) { const r = toResponse(err); if (r) return r; throw err; }

  const body = (await req.json().catch(() => null)) as { amount?: number | string; reason?: string; category?: string } | null;
  const amount = Number(body?.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10000) {
    return Response.json({ error: "Montant invalide (1 à 10 000 DT)" }, { status: 400 });
  }
  const reason = String(body?.reason ?? "").trim();
  if (!reason) return Response.json({ error: "Motif requis" }, { status: 400 });
  const category = VALID_CATEGORIES.includes(body?.category as never) ? body!.category! : "AUTRE";

  try {
    const created = await prisma.$transaction(async (tx) => {
      const session = await tx.cashDrawerSession.findFirst({
        where: { providerId: employee.providerId, status: "OPEN" },
        select: { id: true },
      });
      if (!session) throw new Error("NO_OPEN_SESSION");
      return tx.cashDrawerExpense.create({
        data: {
          cashDrawerSessionId: session.id,
          employeeId: employee.id,
          amount: amount.toFixed(3),
          reason,
          category: category as never,
        } as never,
      });
    });
    return Response.json(created, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "NO_OPEN_SESSION") {
      return Response.json({ error: "Aucune caisse ouverte" }, { status: 409 });
    }
    throw err;
  }
}

export async function GET() {
  let employee;
  try { employee = await requirePermission("pos.cash_drawer"); }
  catch (err) { const r = toResponse(err); if (r) return r; throw err; }

  const session = await prisma.cashDrawerSession.findFirst({
    where: { providerId: employee.providerId, status: "OPEN" },
    select: { id: true },
  });
  if (!session) return Response.json({ sessionId: null, expenses: [], total: "0.000" });

  const expenses = await (prisma as never as { cashDrawerExpense: { findMany: (a: unknown) => Promise<Array<{ amount: { toString: () => string } }>> } })
    .cashDrawerExpense.findMany({
      where: { cashDrawerSessionId: session.id },
      orderBy: { createdAt: "asc" },
    });
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0).toFixed(3);
  return Response.json({ sessionId: session.id, expenses, total });
}
```

- [ ] **Step 3.3.2 — DELETE on the item**

```ts
// src/app/api/pos/drawer/expenses/[id]/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, toResponse } from "@/lib/employee-session";

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let employee;
  try { employee = await requirePermission("pos.refund"); }
  catch (err) { const r = toResponse(err); if (r) return r; throw err; }
  const { id } = await ctx.params;

  try {
    await prisma.$transaction(async (tx) => {
      const exp = await (tx as never as { cashDrawerExpense: { findUnique: (a: unknown) => Promise<{ cashDrawerSession: { providerId: string; status: string } } | null> } })
        .cashDrawerExpense.findUnique({
          where: { id },
          include: { cashDrawerSession: { select: { providerId: true, status: true } } },
        });
      if (!exp) throw new Error("NOT_FOUND");
      if (exp.cashDrawerSession.providerId !== employee.providerId) throw new Error("FORBIDDEN");
      if (exp.cashDrawerSession.status !== "OPEN") throw new Error("CLOSED");
      await (tx as never as { cashDrawerExpense: { delete: (a: unknown) => Promise<unknown> } })
        .cashDrawerExpense.delete({ where: { id } });
    });
    return new Response(null, { status: 204 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "NOT_FOUND") return Response.json({ error: "Dépense introuvable" }, { status: 404 });
    if (msg === "FORBIDDEN") return Response.json({ error: "Interdit" }, { status: 403 });
    if (msg === "CLOSED") return Response.json({ error: "Session fermée" }, { status: 409 });
    throw err;
  }
}
```

- [ ] **Step 3.3.3 — Commit**

```bash
git add src/app/api/pos/drawer/expenses
git commit -m "feat(pos): expense API — POST/GET collection, DELETE item"
```

### Task 3.4 — Update close route to use `expectedCash()` and subtract expenses

**Files:**
- Modify: `src/app/api/pos/cash-drawer/[id]/close/route.ts`

- [ ] **Step 3.4.1 — Import the helper + Decimal**

Add:

```ts
import { Decimal } from "@/generated/prisma/runtime/library";
import { expectedCash, variance } from "@/lib/drawer-math";
```

- [ ] **Step 3.4.2 — Replace the inline formula in the `$transaction`**

Inside the `$transaction`, after computing `cashSalesTotal` and `cashRefundsTotal`, add an expenses aggregate and call `expectedCash`:

```ts
const expensesAgg = await (tx as never as { cashDrawerExpense: { aggregate: (a: unknown) => Promise<{ _sum: { amount: { toString: () => string } | null } }> } })
  .cashDrawerExpense.aggregate({
    where: { cashDrawerSessionId: id },
    _sum: { amount: true },
  });
const expensesTotal = expensesAgg._sum.amount ? String(expensesAgg._sum.amount) : "0.000";

const expected = expectedCash({
  openingFloat: new Decimal(String(session.openingFloat)),
  cashSales: new Decimal(cashSalesTotal),
  cashRefunds: new Decimal(cashRefundsTotal),
  expenses: new Decimal(expensesTotal),
});
const varianceVal = variance(expected, new Decimal(closingStr));

const updated = await tx.cashDrawerSession.update({
  where: { id },
  data: {
    status: "CLOSED",
    closedAt: new Date(),
    closingCount: closingStr,
    expectedCash: expected.toFixed(3),
    variance: varianceVal.toFixed(3),
    closingNotes: body?.closingNotes ?? null,
  },
});

return {
  session: updated,
  summary: {
    openingFloat: String(session.openingFloat),
    cashSalesCount: cashPayments.length,
    cashSalesTotal,
    cashRefundsCount: refunds.length,
    cashRefundsTotal,
    expensesTotal,
    expectedCash: expected.toFixed(3),
    closingCount: closingStr,
    variance: varianceVal.toFixed(3),
  },
};
```

Remove the prior inline `subMoney(addMoney(...), ...)` block.

- [ ] **Step 3.4.3 — Commit**

```bash
git add src/app/api/pos/cash-drawer/\[id\]/close/route.ts
git commit -m "feat(drawer): subtract expenses + use expectedCash() helper on close"
```

### Task 3.5 — Expense modal + button in drawer indicator

**Files:**
- Create: `src/components/pos/expense-modal.tsx`
- Modify: `src/components/pos/cash-drawer-indicator.tsx`
- Modify: `src/components/pos/cash-drawer-detail-client.tsx`

- [ ] **Step 3.5.1 — Expense modal**

```tsx
"use client";
import { useState } from "react";

const CATEGORIES = [
  { value: "FOURNISSEUR", label: "Fournisseur" },
  { value: "LIVRAISON", label: "Livraison" },
  { value: "AVANCE_SALAIRE", label: "Avance" },
  { value: "ENTRETIEN", label: "Entretien" },
  { value: "AUTRE", label: "Autre" },
] as const;

export function ExpenseModal({ employeeName, onClose, onCreated }: { employeeName: string; onClose: () => void; onCreated: () => void; }) {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<typeof CATEGORIES[number]["value"]>("AUTRE");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/pos/drawer/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Number(amount), category, reason }),
    });
    if (res.ok) {
      onCreated();
      onClose();
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Erreur");
    }
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-pos-bg rounded-lg shadow-xl p-6 w-[420px]" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Nouvelle dépense</h2>
          <button onClick={onClose} className="text-pos-ink-3">×</button>
        </header>
        {error && <div className="mb-3 px-3 py-2 rounded bg-red-50 text-red-800 text-sm">{error}</div>}
        <label className="block mb-3">
          <span className="text-sm">Montant DT</span>
          <input className="mt-1 block w-full px-3 py-2 rounded border border-pos-border bg-white" type="number" step="0.001" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </label>
        <div className="mb-3">
          <span className="text-sm">Catégorie</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => setCategory(c.value)}
                className={`px-3 py-1 rounded-full text-sm border ${category === c.value ? "bg-pos-ink text-pos-bg border-pos-ink" : "border-pos-border"}`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <label className="block mb-3">
          <span className="text-sm">Motif</span>
          <input className="mt-1 block w-full px-3 py-2 rounded border border-pos-border bg-white" value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <p className="text-xs text-pos-ink-3 mb-4">Employé : {employeeName}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm">Annuler</button>
          <button disabled={busy || !amount || !reason.trim()} onClick={save} className="px-4 py-2 rounded bg-pos-ink text-pos-bg disabled:opacity-50">Enregistrer</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3.5.2 — Hook the button into `cash-drawer-indicator.tsx`**

Inside the indicator (the small drawer widget in the topbar), import the modal:

```tsx
import { ExpenseModal } from "./expense-modal";
```

Add local state and a button:

```tsx
const [expenseOpen, setExpenseOpen] = useState(false);
// ...
{drawerStatus === "OPEN" && (
  <button onClick={() => setExpenseOpen(true)} className="ml-2 text-xs px-2 py-0.5 rounded border border-pos-border hover:bg-pos-card">
    Dépense
  </button>
)}
{expenseOpen && (
  <ExpenseModal
    employeeName={employeeName}
    onClose={() => setExpenseOpen(false)}
    onCreated={() => { /* trigger refresh of expense list if visible */ }}
  />
)}
```

Read the existing `cash-drawer-indicator.tsx` first to wire `drawerStatus` and `employeeName` from real props/state. Adapt the snippet to actual prop names.

- [ ] **Step 3.5.3 — Expense list in `cash-drawer-detail-client.tsx`**

Add a section that fetches `GET /api/pos/drawer/expenses` on mount when the displayed session is OPEN, and renders the table. Render the `×` delete button only when `permissions["pos.refund"]` is true. Confirm dialog before fetch DELETE.

Skeleton:

```tsx
"use client";
// existing imports...
import { useEffect, useState } from "react";

type Expense = { id: string; amount: string; reason: string; category: string; createdAt: string; employee: { displayName: string } };

// inside the component, where the session detail panel is rendered:
const [expenses, setExpenses] = useState<Expense[]>([]);
const [total, setTotal] = useState("0.000");

useEffect(() => {
  if (session.status !== "OPEN") return;
  fetch("/api/pos/drawer/expenses").then(async (r) => {
    if (!r.ok) return;
    const j = await r.json();
    setExpenses(j.expenses);
    setTotal(j.total);
  });
}, [session.status]);

async function removeOne(id: string) {
  if (!confirm("Supprimer cette dépense ?")) return;
  const r = await fetch(`/api/pos/drawer/expenses/${id}`, { method: "DELETE" });
  if (r.ok) setExpenses((arr) => arr.filter((x) => x.id !== id));
}

// in JSX:
{expenses.length > 0 && (
  <section className="mt-6">
    <h3 className="text-sm uppercase tracking-wider text-pos-ink-3 mb-2">Dépenses ({expenses.length}) — Total {total} DT</h3>
    <ul className="text-sm">
      {expenses.map((e) => (
        <li key={e.id} className="flex justify-between py-1 border-t border-pos-border">
          <span>{e.category} {Number(e.amount).toFixed(3)} {new Date(e.createdAt).toLocaleTimeString("fr-FR")} {e.employee.displayName}</span>
          {permissions["pos.refund"] && session.status === "OPEN" && (
            <button onClick={() => removeOne(e.id)} className="text-red-700">×</button>
          )}
        </li>
      ))}
    </ul>
  </section>
)}
```

- [ ] **Step 3.5.4 — Commit**

```bash
git add src/components/pos/expense-modal.tsx src/components/pos/cash-drawer-indicator.tsx src/components/pos/cash-drawer-detail-client.tsx
git commit -m "feat(pos): expense modal + list in drawer detail"
```

### Task 3.6 — Z report server component + page

**Files:**
- Create: `src/app/(pos)/pos/cash-drawer/[id]/rapport/page.tsx`

This task depends on Section 5 Task 5.1 (`<ThermalLayout>`) and Task 5.4 (`<ZReportContent>`). If those are not yet implemented when this task runs, write the page to fall back to a plain HTML preview (no `<ThermalLayout>` wrapper) — the layout swap is a one-line change later.

- [ ] **Step 3.6.1 — Server component skeleton**

```tsx
// src/app/(pos)/pos/cash-drawer/[id]/rapport/page.tsx
import { requirePermission } from "@/lib/employee-session";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ZReportPrintFrame } from "@/components/pos/thermal/z-report-content";

export const dynamic = "force-dynamic";

export default async function ZReportPage({ params }: { params: Promise<{ id: string }> }) {
  const employee = await requirePermission("pos.cash_drawer");
  const { id } = await params;

  const session = await prisma.cashDrawerSession.findUnique({
    where: { id },
    include: { employee: { select: { displayName: true } } },
  });
  if (!session || session.providerId !== employee.providerId) notFound();

  const provider = await prisma.providerProfile.findUnique({
    where: { id: session.providerId },
    select: { salonName: true, address: true, city: true, phone: true, matriculeFiscal: true, receiptFooter: true },
  });

  const windowFilter = { gte: session.openedAt, lte: session.closedAt ?? new Date() };

  const [salesAgg, refundsAllAgg, refundsCashAgg, paymentsByMethod, taxGroups, expenses] = await Promise.all([
    prisma.sale.aggregate({
      where: { providerId: session.providerId, status: "PAID", closedAt: windowFilter },
      _count: true,
      _sum: { total: true, discountAmount: true, tipTotal: true },
    }),
    prisma.refund.aggregate({
      where: { sale: { providerId: session.providerId }, createdAt: windowFilter },
      _sum: { totalAmount: true },
    }),
    prisma.refund.aggregate({
      where: { sale: { providerId: session.providerId }, createdAt: windowFilter, refundMethod: "CASH" },
      _sum: { totalAmount: true },
    }),
    prisma.payment.groupBy({
      by: ["method"],
      where: { cashDrawerSessionId: id },
      _sum: { amount: true },
    }),
    prisma.saleItem.groupBy({
      by: ["taxRateSnapshot"],
      where: { sale: { providerId: session.providerId, closedAt: windowFilter } },
      _sum: { lineSubtotal: true, lineTaxAmount: true },
    }),
    (prisma as never as { cashDrawerExpense: { findMany: (a: unknown) => Promise<Array<{ id: string; amount: string; reason: string; category: string }>> } })
      .cashDrawerExpense.findMany({
        where: { cashDrawerSessionId: id },
        orderBy: { createdAt: "asc" },
      }),
  ]);

  const data = {
    provider,
    sessionNumber: session.id.slice(-4).toUpperCase(),
    openedAt: session.openedAt,
    closedAt: session.closedAt,
    openedBy: session.employee.displayName,
    salesCount: salesAgg._count,
    grossTotal: String(salesAgg._sum.total ?? "0.000"),
    discountsTotal: String(salesAgg._sum.discountAmount ?? "0.000"),
    tipsTotal: String(salesAgg._sum.tipTotal ?? "0.000"),
    refundsTotal: String(refundsAllAgg._sum.totalAmount ?? "0.000"),
    refundsCashTotal: String(refundsCashAgg._sum.totalAmount ?? "0.000"),
    paymentsByMethod: paymentsByMethod.map((p) => ({ method: p.method, amount: String(p._sum.amount ?? "0.000") })),
    taxBreakdown: taxGroups.map((t) => ({ rate: String(t.taxRateSnapshot), base: String(t._sum.lineSubtotal ?? "0.000"), tax: String(t._sum.lineTaxAmount ?? "0.000") })),
    expenses: expenses.map((e) => ({ id: e.id, amount: String(e.amount), reason: e.reason, category: e.category })),
    expensesTotal: expenses.reduce((s, e) => s + Number(e.amount), 0).toFixed(3),
    openingFloat: String(session.openingFloat),
    expectedCash: session.expectedCash ? String(session.expectedCash) : null,
    closingCount: session.closingCount ? String(session.closingCount) : null,
    variance: session.variance ? String(session.variance) : null,
  };

  return <ZReportPrintFrame data={data} />;
}
```

- [ ] **Step 3.6.2 — Commit**

```bash
git add src/app/\(pos\)/pos/cash-drawer/\[id\]/rapport
git commit -m "feat(drawer): Z report page (server-aggregated)"
```

### Task 3.7 — Wire "Imprimer le rapport Z" button

**Files:**
- Modify: `src/components/pos/cash-drawer-detail-client.tsx`

- [ ] **Step 3.7.1 — Add a "Imprimer le rapport Z" link**

Where the close-success state is rendered, add:

```tsx
{session.status !== "OPEN" && (
  <a
    href={`/pos/cash-drawer/${session.id}/rapport`}
    target="_blank"
    rel="noreferrer"
    className="inline-block px-4 py-2 rounded bg-pos-ink text-pos-bg text-sm"
  >
    Imprimer le rapport Z
  </a>
)}
```

- [ ] **Step 3.7.2 — Commit**

```bash
git add src/components/pos/cash-drawer-detail-client.tsx
git commit -m "feat(drawer): print Z report button on closed sessions"
```

---

## Section 4 — Product cost price + stock reception

### Task 4.1 — Migration: `Product.costPrice` + `StockMovement.unitCost`

**Files:**
- Create: `prisma/migrations/20260612123000_product_cost_price/migration.sql`
- Modify: `prisma/schema.prisma`

- [ ] **Step 4.1.1 — SQL**

```sql
ALTER TABLE "Product" ADD COLUMN "costPrice" DECIMAL(10,3);
ALTER TABLE "StockMovement" ADD COLUMN "unitCost" DECIMAL(10,3);
```

- [ ] **Step 4.1.2 — Schema**

In `model Product`, add `costPrice Decimal? @db.Decimal(10, 3)` (right after `salePrice`).

In `model StockMovement`, add `unitCost Decimal? @db.Decimal(10, 3)` (right after `delta`).

- [ ] **Step 4.1.3 — Commit**

```bash
git add prisma/migrations/20260612123000_product_cost_price prisma/schema.prisma
git commit -m "feat(db): Product.costPrice + StockMovement.unitCost"
```

### Task 4.2 — Extend `/api/pos/products/[id]/stock`

**Files:**
- Modify: `src/app/api/pos/products/[id]/stock/route.ts`

> **Spec drift note.** The spec table in Section 4 lists `products.manage` as the permission for this route. The existing route uses `inventory.edit`. Keeping `inventory.edit` here is correct (it's the existing single-product stock tick — cashiers use it; `products.manage` is for catalog-level operations). The bulk-reception route in Task 4.3 uses `products.manage` because bulk operations are a catalog-management action.

- [ ] **Step 4.2.1 — Extend the body type and validation**

Replace `type Body` with:

```ts
type Body = {
  delta?: number;
  reason?: StockMovementReason;
  note?: string | null;
  unitCost?: number | string | null;
  updateCostPrice?: boolean;
};
```

- [ ] **Step 4.2.2 — Snapshot `unitCost` on PURCHASE; optionally update `costPrice`**

Replace the `$transaction` body:

```ts
const updated = await prisma.$transaction(async (tx) => {
  const newStock = product.stockQuantity + body.delta!;
  const unitCost =
    body.reason === "PURCHASE" && body.unitCost !== undefined && body.unitCost !== null
      ? Number(body.unitCost).toFixed(3)
      : null;

  const movement = await tx.stockMovement.create({
    data: {
      productId: product.id,
      delta: body.delta!,
      reason: body.reason!,
      employeeId: employee.id,
      note: body.note ?? null,
      requiresReview: newStock < 0,
      unitCost,
    } as never,
  });

  const productUpdateData: Record<string, unknown> = { stockQuantity: newStock };
  if (body.updateCostPrice && body.reason === "PURCHASE" && unitCost) {
    productUpdateData.costPrice = unitCost;
  }
  const next = await tx.product.update({
    where: { id: product.id },
    data: productUpdateData as never,
  });
  return { product: next, movement };
});
```

- [ ] **Step 4.2.3 — Commit**

```bash
git add src/app/api/pos/products/\[id\]/stock/route.ts
git commit -m "feat(pos): single-product stock route snapshots unitCost on PURCHASE"
```

### Task 4.3 — Bulk reception API + UI

**Files:**
- Create: `src/app/api/pos/products/reception-bulk/route.ts`
- Create: `src/app/(pos)/pos/products/reception/page.tsx`
- Create: `src/components/pos/reception-bulk-client.tsx`

- [ ] **Step 4.3.1 — API**

```ts
// src/app/api/pos/products/reception-bulk/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, toResponse } from "@/lib/employee-session";

type Item = { productId: string; quantity: number; unitCost?: number | string | null; updateCostPrice?: boolean };

export async function POST(req: NextRequest) {
  let employee;
  try { employee = await requirePermission("products.manage"); }
  catch (err) { const r = toResponse(err); if (r) return r; throw err; }

  const body = (await req.json().catch(() => null)) as { items?: Item[] } | null;
  const items = body?.items ?? [];
  if (items.length === 0) return Response.json({ error: "Aucun item" }, { status: 400 });
  for (const it of items) {
    if (!it.productId || !Number.isFinite(it.quantity) || it.quantity <= 0) {
      return Response.json({ error: "Item invalide" }, { status: 400 });
    }
  }

  const results = await prisma.$transaction(async (tx) => {
    const out = [];
    for (const it of items) {
      const product = await tx.product.findUnique({ where: { id: it.productId } });
      if (!product || product.providerId !== employee.providerId) {
        throw new Error("FORBIDDEN_OR_NOT_FOUND");
      }
      const unitCost = it.unitCost !== undefined && it.unitCost !== null ? Number(it.unitCost).toFixed(3) : null;
      const newStock = product.stockQuantity + it.quantity;
      const movement = await tx.stockMovement.create({
        data: {
          productId: product.id,
          delta: it.quantity,
          reason: "PURCHASE",
          employeeId: employee.id,
          unitCost,
        } as never,
      });
      const updateData: Record<string, unknown> = { stockQuantity: newStock };
      if (it.updateCostPrice && unitCost) updateData.costPrice = unitCost;
      const updated = await tx.product.update({ where: { id: product.id }, data: updateData as never });
      out.push({ product: updated, movement });
    }
    return out;
  });

  return Response.json({ items: results });
}
```

- [ ] **Step 4.3.2 — Server entry**

```tsx
// src/app/(pos)/pos/products/reception/page.tsx
import { requirePermission } from "@/lib/employee-session";
import { prisma } from "@/lib/prisma";
import { ReceptionBulkClient } from "@/components/pos/reception-bulk-client";

export const dynamic = "force-dynamic";

export default async function ReceptionBulkPage() {
  const employee = await requirePermission("products.manage");
  const products = await prisma.product.findMany({
    where: { providerId: employee.providerId, active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, sku: true, barcode: true, costPrice: true as never } as never,
  });
  return <ReceptionBulkClient products={products as never} />;
}
```

- [ ] **Step 4.3.3 — Client component**

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Product = { id: string; name: string; sku: string; barcode: string | null; costPrice: string | null };
type Row = { productId: string; barcode: string; name: string; quantity: number; unitCost: string; updateCostPrice: boolean };

export function ReceptionBulkClient({ products }: { products: Product[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([{ productId: "", barcode: "", name: "", quantity: 0, unitCost: "", updateCostPrice: true }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(i: number, patch: Partial<Row>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }
  function addRow() {
    setRows((r) => [...r, { productId: "", barcode: "", name: "", quantity: 0, unitCost: "", updateCostPrice: true }]);
  }
  function onBarcodeBlur(i: number) {
    const row = rows[i];
    const match = products.find((p) => p.barcode === row.barcode || p.sku === row.barcode);
    if (match) update(i, { productId: match.id, name: match.name, unitCost: match.costPrice ?? "" });
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const items = rows
      .filter((r) => r.productId && r.quantity > 0)
      .map((r) => ({ productId: r.productId, quantity: r.quantity, unitCost: r.unitCost || null, updateCostPrice: r.updateCostPrice }));
    if (items.length === 0) { setError("Aucun item valide"); setBusy(false); return; }
    const res = await fetch("/api/pos/products/reception-bulk", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }),
    });
    if (res.ok) router.push("/pos/products");
    else { const j = await res.json().catch(() => ({})); setError(j.error ?? "Erreur"); }
    setBusy(false);
  }

  return (
    <div className="h-full bg-pos-bg p-6" data-pos-theme>
      <h1 className="text-xl font-semibold mb-4">Réception multiple</h1>
      {error && <div className="mb-3 px-3 py-2 rounded bg-red-50 text-red-800 text-sm">{error}</div>}
      <table className="w-full text-sm">
        <thead className="text-xs uppercase text-pos-ink-3">
          <tr>
            <th className="text-left px-2 py-1">Code-barres</th>
            <th className="text-left px-2 py-1">Produit</th>
            <th className="text-right px-2 py-1">Quantité</th>
            <th className="text-right px-2 py-1">Prix d'achat</th>
            <th className="text-center px-2 py-1">MAJ prix</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-pos-border">
              <td className="px-2 py-1">
                <input
                  className="px-2 py-1 rounded border border-pos-border bg-white w-full"
                  value={r.barcode}
                  onChange={(e) => update(i, { barcode: e.target.value })}
                  onBlur={() => onBarcodeBlur(i)}
                  autoFocus={i === rows.length - 1}
                />
              </td>
              <td className="px-2 py-1">{r.name || <span className="text-pos-ink-3">(inconnu)</span>}</td>
              <td className="px-2 py-1 text-right">
                <input className="px-2 py-1 rounded border border-pos-border bg-white w-24 text-right" type="number" value={r.quantity || ""} onChange={(e) => update(i, { quantity: Number(e.target.value) })} />
              </td>
              <td className="px-2 py-1 text-right">
                <input className="px-2 py-1 rounded border border-pos-border bg-white w-24 text-right" type="number" step="0.001" value={r.unitCost} onChange={(e) => update(i, { unitCost: e.target.value })} />
              </td>
              <td className="px-2 py-1 text-center">
                <input type="checkbox" checked={r.updateCostPrice} onChange={(e) => update(i, { updateCostPrice: e.target.checked })} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 flex gap-2">
        <button onClick={addRow} className="px-3 py-1 rounded border border-pos-border">+ Ligne</button>
        <button disabled={busy} onClick={submit} className="px-4 py-2 rounded bg-pos-ink text-pos-bg disabled:opacity-50">Valider la réception</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4.3.4 — Commit**

```bash
git add src/app/api/pos/products/reception-bulk src/app/\(pos\)/pos/products/reception src/components/pos/reception-bulk-client.tsx
git commit -m "feat(pos): bulk stock reception with costed PURCHASE"
```

### Task 4.4 — Per-product reception modal + margin badge

**Files:**
- Create: `src/components/pos/reception-modal.tsx`
- Modify: `src/components/pos/products-list-client.tsx`
- Modify: `src/components/pos/product-form.tsx`

- [ ] **Step 4.4.1 — Reception modal**

```tsx
"use client";
import { useState } from "react";

export function ReceptionModal({
  productId, productName, currentCost, onClose, onDone,
}: {
  productId: string;
  productName: string;
  currentCost: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [quantity, setQuantity] = useState(0);
  const [unitCost, setUnitCost] = useState(currentCost ?? "");
  const [updateCostPrice, setUpdateCostPrice] = useState(true);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const res = await fetch(`/api/pos/products/${productId}/stock`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        delta: quantity, reason: "PURCHASE",
        unitCost: unitCost || null, updateCostPrice, note: note || null,
      }),
    });
    if (res.ok) { onDone(); onClose(); }
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-pos-bg rounded-lg shadow-xl p-6 w-[420px]" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">Recevoir : {productName}</h2>
        <label className="block mb-3">
          <span className="text-sm">Quantité reçue</span>
          <input className="mt-1 block w-full px-3 py-2 rounded border border-pos-border bg-white" type="number" value={quantity || ""} onChange={(e) => setQuantity(Number(e.target.value))} autoFocus />
        </label>
        <label className="block mb-3">
          <span className="text-sm">Prix d'achat HT</span>
          <input className="mt-1 block w-full px-3 py-2 rounded border border-pos-border bg-white" type="number" step="0.001" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
          {currentCost && <p className="text-xs text-pos-ink-3 mt-1">Actuel : {Number(currentCost).toFixed(3)} DT</p>}
        </label>
        <label className="block mb-3">
          <input type="checkbox" checked={updateCostPrice} onChange={(e) => setUpdateCostPrice(e.target.checked)} />
          <span className="ml-2 text-sm">Mettre à jour le prix d'achat de référence</span>
        </label>
        <label className="block mb-4">
          <span className="text-sm">Note</span>
          <input className="mt-1 block w-full px-3 py-2 rounded border border-pos-border bg-white" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm">Annuler</button>
          <button disabled={busy || quantity <= 0} onClick={save} className="px-4 py-2 rounded bg-pos-ink text-pos-bg disabled:opacity-50">Valider</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4.4.2 — Add "Réception" button + margin badge in products-list-client**

For each product row, render:

```tsx
{p.costPrice !== null && Number(p.costPrice) > 0 && (
  <span className="text-xs px-2 py-0.5 rounded bg-green-50 text-green-800">
    Marge {(Number(p.salePrice) - Number(p.costPrice)).toFixed(3)} DT
    ({(((Number(p.salePrice) - Number(p.costPrice)) / Number(p.salePrice)) * 100).toFixed(0)}%)
  </span>
)}
<button onClick={() => setReceptionFor(p)} className="ml-2 text-xs px-2 py-0.5 rounded border">Réception</button>
```

Then render `<ReceptionModal>` conditionally when `receptionFor` is set.

- [ ] **Step 4.4.3 — Add `costPrice` to `product-form.tsx`**

Add a labelled input "Prix d'achat HT" bound to `formState.costPrice`. Submit serialises `costPrice` as a string with 3 decimals or null.

- [ ] **Step 4.4.4 — Commit**

```bash
git add src/components/pos/reception-modal.tsx src/components/pos/products-list-client.tsx src/components/pos/product-form.tsx
git commit -m "feat(pos): reception modal + margin badge + costPrice field"
```

### Task 4.5 — "Marge produits" card in analytics

**Files:**
- Modify: `src/components/pos/analytics-client.tsx`

- [ ] **Step 4.5.1 — Add a new card section**

Inside the analytics page, after the existing cards, fetch:

```ts
const [margin, setMargin] = useState<{ total: string; excludedCount: number } | null>(null);

useEffect(() => {
  fetch(`/api/pos/analytics/product-margin?from=${from}&to=${to}`)
    .then((r) => r.json()).then(setMargin);
}, [from, to]);
```

Render:

```tsx
{margin && (
  <article className="rounded border border-pos-border p-4">
    <h3 className="text-xs uppercase text-pos-ink-3 mb-2">Marge produits — estimation</h3>
    <p className="text-2xl font-semibold">{Number(margin.total).toFixed(3)} DT</p>
    {margin.excludedCount > 0 && (
      <p className="text-xs text-pos-ink-3 mt-1">{margin.excludedCount} produits sans coût exclus du calcul</p>
    )}
  </article>
)}
```

- [ ] **Step 4.5.2 — Create the analytics endpoint**

`src/app/api/pos/analytics/product-margin/route.ts`:

```ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, toResponse } from "@/lib/employee-session";

export async function GET(req: NextRequest) {
  let employee;
  try { employee = await requirePermission("analytics.view"); }
  catch (err) { const r = toResponse(err); if (r) return r; throw err; }

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const dateFilter: Record<string, unknown> = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);

  const items = await prisma.saleItem.findMany({
    where: {
      sale: { providerId: employee.providerId, status: "PAID", closedAt: from || to ? dateFilter : undefined },
      kind: "PRODUCT",
    },
    select: {
      quantity: true,
      priceSnapshot: true,
      product: { select: { costPrice: true as never } as never } as never,
    } as never,
  });

  let total = 0;
  let excluded = 0;
  for (const it of items as Array<{ quantity: number; priceSnapshot: string; product: { costPrice: string | null } | null }>) {
    const cost = it.product?.costPrice ? Number(it.product.costPrice) : null;
    if (cost === null) { excluded++; continue; }
    total += (Number(it.priceSnapshot) - cost) * it.quantity;
  }
  return Response.json({ total: total.toFixed(3), excludedCount: excluded });
}
```

- [ ] **Step 4.5.3 — Commit**

```bash
git add src/components/pos/analytics-client.tsx src/app/api/pos/analytics/product-margin
git commit -m "feat(analytics): product margin estimation card"
```

---

## Section 5 — Thermal print readiness (80mm)

### Task 5.1 — `<ThermalLayout>` + primitives

**Files:**
- Create: `src/components/pos/thermal/thermal-layout.tsx`

- [ ] **Step 5.1.1 — Layout + primitives**

```tsx
"use client";
import type { ReactNode } from "react";

export function ThermalLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style jsx global>{`
        @page { size: 80mm auto; margin: 0; }
        @media print {
          body > *:not(.thermal-print-root) { display: none !important; }
          .thermal-print-root { display: block !important; }
        }
        .thermal-print-root .thermal-doc {
          width: 80mm;
          padding: 5mm;
          font-family: ui-monospace, "Courier New", monospace;
          font-size: 11px;
          color: #000;
          background: #fff;
          line-height: 1.35;
        }
        .thermal-print-root .thermal-row { display: flex; justify-content: space-between; }
        .thermal-print-root hr.thermal-sep { border: none; border-top: 1px dashed #000; margin: 3mm 0; }
        .thermal-print-root .thermal-total { font-weight: bold; font-size: 13px; }
        .thermal-print-root .thermal-center { text-align: center; }
      `}</style>
      <div className="thermal-print-root">
        <div className="thermal-doc">{children}</div>
      </div>
    </>
  );
}

export function ThermalHeader({ provider, title }: {
  provider: { salonName?: string | null; address?: string | null; city?: string | null; phone?: string | null; matriculeFiscal?: string | null } | null;
  title?: string;
}) {
  return (
    <div className="thermal-center">
      <div style={{ fontWeight: "bold", fontSize: 13 }}>{provider?.salonName ?? "Salonista"}</div>
      {provider?.address && <div>{provider.address}</div>}
      {provider?.city && <div>{provider.city}</div>}
      {provider?.phone && <div>Tél: {provider.phone}</div>}
      {provider?.matriculeFiscal && <div>MF: {provider.matriculeFiscal}</div>}
      {title && <div style={{ marginTop: "2mm", fontWeight: "bold" }}>{title}</div>}
    </div>
  );
}

export function ThermalSeparator() { return <hr className="thermal-sep" />; }

export function ThermalRow({ label, value }: { label: string; value: string }) {
  return <div className="thermal-row"><span>{label}</span><span>{value}</span></div>;
}

export function ThermalTotal({ label, value }: { label: string; value: string }) {
  return <div className="thermal-row thermal-total"><span>{label}</span><span>{value}</span></div>;
}

export function ThermalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div style={{ fontWeight: "bold", marginTop: "2mm" }}>{title}</div>
      {children}
    </div>
  );
}

export function ThermalFooter({ text }: { text: string }) {
  return <div className="thermal-center" style={{ marginTop: "3mm", fontSize: 9 }}>{text}</div>;
}
```

- [ ] **Step 5.1.2 — Commit**

```bash
git add src/components/pos/thermal/thermal-layout.tsx
git commit -m "feat(pos): ThermalLayout + primitives"
```

### Task 5.2 — Migrate `receipt.tsx` to `<ReceiptContent>`

**Files:**
- Create: `src/components/pos/thermal/receipt-content.tsx`
- Modify: `src/components/pos/receipt.tsx`

- [ ] **Step 5.2.1 — Move presentation to `<ReceiptContent>`**

Create `receipt-content.tsx` with the body that the current `ReceiptPrintFrame` builds, but use `<ThermalHeader>`, `<ThermalSeparator>`, `<ThermalRow>`, `<ThermalTotal>` instead of inline divs. Add the spec deltas:

```tsx
"use client";
import type { ReceiptData } from "@/components/pos/receipt";
import { ThermalHeader, ThermalSeparator, ThermalRow, ThermalTotal, ThermalFooter } from "./thermal-layout";
import { formatDT } from "@/lib/money";

const METHOD_LABELS: Record<string, string> = {
  CASH: "Espèces", CARD: "Carte", TRANSFER: "Virement", OTHER: "Autre", LOYALTY_POINTS: "Points fidélité",
};

export function ReceiptContent({ data }: { data: ReceiptData }) {
  const cashPaid = data.payments.filter((p) => p.method === "CASH").reduce((s, p) => s + Number(p.amount), 0);
  const change = cashPaid - Number(data.total);
  return (
    <>
      <ThermalHeader provider={data.provider} />
      <ThermalSeparator />
      <div>Reçu N° {data.receiptNumber}</div>
      <div>{new Date(data.date).toLocaleString("fr-FR")}</div>
      <div>Caissier·ère : {data.employee.displayName}</div>
      {data.customerName && <div>Client : {data.customerName}</div>}
      {data.offline && (
        <>
          <div>(Hors ligne — sera synchronisé)</div>
          <div style={{ fontSize: 9 }}>N° définitif attribué à la synchronisation</div>
        </>
      )}
      <ThermalSeparator />
      {data.items.map((it, i) => (
        <div key={i}>
          <ThermalRow label={`${it.quantity}× ${it.name}`} value={formatDT(it.lineTotal)} />
          {it.assignedEmployee && (
            <div style={{ paddingLeft: "4mm", fontSize: 10 }}>par {it.assignedEmployee}</div>
          )}
        </div>
      ))}
      <ThermalSeparator />
      <ThermalRow label="Sous-total TTC" value={formatDT(data.subtotal)} />
      {Number(data.discountAmount) > 0 && <ThermalRow label="Remise" value={`-${formatDT(data.discountAmount)}`} />}
      {data.taxBreakdown.map((b, i) => (
        <ThermalRow key={i} label={`TVA ${b.rate}% sur ${formatDT(b.base)}`} value={formatDT(b.tax)} />
      ))}
      {Number(data.tipTotal) > 0 && <ThermalRow label="Pourboire" value={formatDT(data.tipTotal)} />}
      <ThermalTotal label="TOTAL" value={formatDT(data.total)} />
      <ThermalSeparator />
      {data.payments.map((p, i) => (
        <ThermalRow key={i} label={`${METHOD_LABELS[p.method] ?? p.method}${p.pointsRedeemed ? ` (${p.pointsRedeemed} pts)` : ""}`} value={formatDT(p.amount)} />
      ))}
      {change > 0 && <ThermalRow label="Rendu" value={formatDT(change.toFixed(3))} />}
      {data.provider?.receiptFooter && (
        <>
          <ThermalSeparator />
          <ThermalFooter text={data.provider.receiptFooter} />
        </>
      )}
    </>
  );
}
```

- [ ] **Step 5.2.2 — Rewrite `receipt.tsx` as a thin wrapper**

```tsx
"use client";
import { ThermalLayout } from "./thermal/thermal-layout";
import { ReceiptContent } from "./thermal/receipt-content";

export type ReceiptData = {
  // unchanged shape — keep the existing fields
  receiptNumber: string;
  provider: {
    salonName?: string | null; address?: string | null; city?: string | null;
    phone?: string | null; matriculeFiscal?: string | null; receiptFooter?: string | null;
  } | null;
  employee: { displayName: string };
  customerName: string | null;
  items: Array<{ name: string; quantity: number; assignedEmployee: string | null; lineTotal: string; taxRate: string }>;
  subtotal: string;
  discountAmount: string;
  taxBreakdown: Array<{ rate: string; base: string; tax: string }>;
  tipTotal: string;
  total: string;
  payments: Array<{ method: string; amount: string; pointsRedeemed?: number }>;
  date: string;
  offline: boolean;
  rewards?: {
    earned: number; redeemed: number; welcomeBonus: number; birthdayBonus: number; newBalance?: number;
  };
};

export function ReceiptPrintFrame({ data }: { data: ReceiptData }) {
  return (
    <ThermalLayout>
      <ReceiptContent data={data} />
    </ThermalLayout>
  );
}
```

(The rewards block fields are kept in `ReceiptData`. The minimal `ReceiptContent` above does *not* render rewards — port them over from the old `receipt.tsx` body in the same shape: `<ThermalSeparator/>` then the rewards rows. Copy the JSX from the original file to avoid behaviour drift.)

- [ ] **Step 5.2.3 — Commit**

```bash
git add src/components/pos/thermal/receipt-content.tsx src/components/pos/receipt.tsx
git commit -m "refactor(pos): receipt uses ThermalLayout + primitives, adds change due"
```

### Task 5.3 — `<TestTicketContent>` + `/pos/bienvenue/test-print`

**Files:**
- Create: `src/components/pos/thermal/test-ticket-content.tsx`
- Create: `src/app/(pos)/pos/bienvenue/test-print/page.tsx`

- [ ] **Step 5.3.1 — Test ticket content**

```tsx
"use client";
import { ThermalHeader, ThermalSeparator, ThermalRow, ThermalTotal, ThermalFooter } from "./thermal-layout";

export function TestTicketContent({ provider, employeeName }: {
  provider: { salonName?: string | null; address?: string | null; city?: string | null; phone?: string | null; matriculeFiscal?: string | null } | null;
  employeeName: string;
}) {
  return (
    <>
      <div style={{ border: "2px solid #000", padding: "2mm", textAlign: "center", marginBottom: "3mm", fontSize: 14, fontWeight: "bold" }}>
        TICKET TEST — sans valeur
      </div>
      <ThermalHeader provider={provider} />
      <ThermalSeparator />
      <div>Reçu N° TEST</div>
      <div>{new Date().toLocaleString("fr-FR")}</div>
      <div>Caissier·ère : {employeeName}</div>
      <ThermalSeparator />
      <ThermalRow label="1× Brushing" value="25.000" />
      <ThermalRow label="1× Coupe homme" value="15.000" />
      <ThermalSeparator />
      <ThermalTotal label="TOTAL" value="40.000" />
      <ThermalSeparator />
      <ThermalRow label="Espèces" value="40.000" />
      <ThermalFooter text="Si vous voyez ce ticket, votre imprimante est prête." />
    </>
  );
}
```

- [ ] **Step 5.3.2 — Test-print page**

```tsx
// src/app/(pos)/pos/bienvenue/test-print/page.tsx
import { requireEmployee } from "@/lib/employee-session";
import { prisma } from "@/lib/prisma";
import { TestTicketPrintFrame } from "@/components/pos/thermal/test-ticket-frame";

export const dynamic = "force-dynamic";

export default async function TestPrintPage() {
  const employee = await requireEmployee();
  const provider = await prisma.providerProfile.findUnique({
    where: { id: employee.providerId },
    select: { salonName: true, address: true, city: true, phone: true, matriculeFiscal: true },
  });
  return <TestTicketPrintFrame provider={provider} employeeName={employee.displayName} />;
}
```

- [ ] **Step 5.3.3 — Print frame + auto-print**

```tsx
// src/components/pos/thermal/test-ticket-frame.tsx
"use client";
import { useEffect } from "react";
import { ThermalLayout } from "./thermal-layout";
import { TestTicketContent } from "./test-ticket-content";

export function TestTicketPrintFrame({ provider, employeeName }: {
  provider: { salonName: string | null; address: string | null; city: string | null; phone: string | null; matriculeFiscal: string | null } | null;
  employeeName: string;
}) {
  useEffect(() => {
    const id = setTimeout(() => window.print(), 200);
    return () => clearTimeout(id);
  }, []);
  return (
    <ThermalLayout>
      <TestTicketContent provider={provider} employeeName={employeeName} />
    </ThermalLayout>
  );
}
```

- [ ] **Step 5.3.4 — Commit**

```bash
git add src/components/pos/thermal/test-ticket-content.tsx src/components/pos/thermal/test-ticket-frame.tsx src/app/\(pos\)/pos/bienvenue/test-print
git commit -m "feat(pos): test ticket print route + content"
```

### Task 5.4 — `<ZReportContent>` + auto-print

**Files:**
- Create: `src/components/pos/thermal/z-report-content.tsx`

- [ ] **Step 5.4.1 — Z report frame**

```tsx
"use client";
import { useEffect } from "react";
import { ThermalLayout, ThermalHeader, ThermalSeparator, ThermalRow, ThermalTotal } from "./thermal-layout";
import { formatDT } from "@/lib/money";

type ZReportData = {
  provider: { salonName?: string | null; address?: string | null; city?: string | null; phone?: string | null; matriculeFiscal?: string | null } | null;
  sessionNumber: string;
  openedAt: Date | string;
  closedAt: Date | string | null;
  openedBy: string;
  salesCount: number;
  grossTotal: string;
  discountsTotal: string;
  tipsTotal: string;
  refundsTotal: string;
  paymentsByMethod: Array<{ method: string; amount: string }>;
  taxBreakdown: Array<{ rate: string; base: string; tax: string }>;
  expenses: Array<{ id: string; amount: string; reason: string; category: string }>;
  expensesTotal: string;
  openingFloat: string;
  expectedCash: string | null;
  closingCount: string | null;
  variance: string | null;
};

const METHOD_LABELS: Record<string, string> = { CASH: "Espèces", CARD: "Carte", TRANSFER: "Virement", OTHER: "Autre", LOYALTY_POINTS: "Points" };

export function ZReportPrintFrame({ data }: { data: ZReportData }) {
  useEffect(() => {
    const id = setTimeout(() => window.print(), 200);
    return () => clearTimeout(id);
  }, []);

  const openedAtDate = new Date(data.openedAt);
  const closedAtDate = data.closedAt ? new Date(data.closedAt) : null;

  return (
    <ThermalLayout>
      <ThermalHeader provider={data.provider} title="RAPPORT Z" />
      <ThermalSeparator />
      <div>{openedAtDate.toLocaleDateString("fr-FR")} — Session #{data.sessionNumber}</div>
      <div>Ouverte {openedAtDate.toLocaleTimeString("fr-FR")} par {data.openedBy}</div>
      {closedAtDate && <div>Fermée {closedAtDate.toLocaleTimeString("fr-FR")} par {data.openedBy}</div>}
      <ThermalSeparator />
      <ThermalRow label="Ventes" value={String(data.salesCount)} />
      <ThermalRow label="Brut TTC" value={formatDT(data.grossTotal)} />
      {Number(data.discountsTotal) > 0 && <ThermalRow label="Remises" value={`-${formatDT(data.discountsTotal)}`} />}
      {Number(data.tipsTotal) > 0 && <ThermalRow label="Pourboires" value={`+${formatDT(data.tipsTotal)}`} />}
      {Number(data.refundsTotal) > 0 && <ThermalRow label="Remboursements" value={`-${formatDT(data.refundsTotal)}`} />}
      <ThermalSeparator />
      <div style={{ fontWeight: "bold" }}>Paiements</div>
      {data.paymentsByMethod.map((p, i) => (
        <ThermalRow key={i} label={METHOD_LABELS[p.method] ?? p.method} value={formatDT(p.amount)} />
      ))}
      <ThermalSeparator />
      <div style={{ fontWeight: "bold" }}>TVA</div>
      {data.taxBreakdown.map((t, i) => (
        <ThermalRow key={i} label={`${Number(t.rate).toFixed(0)}% sur ${formatDT(t.base)}`} value={formatDT(t.tax)} />
      ))}
      <ThermalSeparator />
      <div style={{ fontWeight: "bold" }}>Tiroir espèces</div>
      <ThermalRow label="Fond ouverture" value={formatDT(data.openingFloat)} />
      {Number(data.expensesTotal) > 0 && (
        <>
          <ThermalRow label="− Dépenses" value={formatDT(data.expensesTotal)} />
          {data.expenses.map((e) => (
            <div key={e.id} style={{ paddingLeft: "4mm", fontSize: 9 }}>{e.category} {formatDT(e.amount)} — {e.reason}</div>
          ))}
        </>
      )}
      {data.expectedCash && <ThermalRow label="Attendu" value={formatDT(data.expectedCash)} />}
      {data.closingCount && <ThermalRow label="Compté" value={formatDT(data.closingCount)} />}
      {data.variance && <ThermalTotal label="ÉCART" value={formatDT(data.variance)} />}
      <ThermalSeparator />
      <div style={{ textAlign: "center", fontSize: 9 }}>Rapport Z — Salonista</div>
    </ThermalLayout>
  );
}
```

- [ ] **Step 5.4.2 — Commit**

```bash
git add src/components/pos/thermal/z-report-content.tsx
git commit -m "feat(pos): ZReportPrintFrame (layout A, auto-print)"
```

### Task 5.5 — "Réimprimer" button + printing one-pager

**Files:**
- Modify: `src/components/pos/sale-detail-client.tsx`
- Create: `docs/pos-printing.md`

- [ ] **Step 5.5.1 — "Réimprimer" button**

Inside the sale detail client, mount a hidden `<ReceiptPrintFrame data={...} />` on demand and call `window.print()`:

```tsx
"use client";
import { useState } from "react";
import { ReceiptPrintFrame, type ReceiptData } from "@/components/pos/receipt";

const [printData, setPrintData] = useState<ReceiptData | null>(null);

function reprint() {
  setPrintData(buildReceiptDataFromSale(sale));
  setTimeout(() => window.print(), 200);
}

<button onClick={reprint} className="px-3 py-1 rounded border border-pos-border text-sm">Réimprimer</button>
{printData && <ReceiptPrintFrame data={printData} />}
```

`buildReceiptDataFromSale(sale)` is a local helper in the same file that maps the existing `Sale + items + payments + provider` JSON shape into `ReceiptData`. If a similar mapper already exists for the post-charge success path, extract it into `src/lib/receipt-data.ts` first and reuse.

- [ ] **Step 5.5.2 — Printing one-pager**

```markdown
# Salonista — Impression thermique 80 mm

## Setups supportés

- **PC + imprimante USB thermique** (Star, Epson, etc.) — fonctionne via la boîte de dialogue d'impression du navigateur. Sélectionner le format **80 × 297 mm** ou un format personnalisé.
- **Android + imprimante Bluetooth** — appairer dans les paramètres OS, puis utiliser la feuille d'impression du navigateur ou un plugin tiers (KingPrinter, etc.).
- **iPad** — AirPrint vers une imprimante compatible. Les imprimantes thermiques non-AirPrint nécessitent un dongle réseau.

## Dépannage

- **Page blanche** → confirmer que le format **80 mm** est bien sélectionné dans la boîte de dialogue.
- **Bord droit coupé** → confirmer que les marges sont à **0** dans la boîte de dialogue.
- **Police trop petite** → régler le zoom de l'imprimante au niveau OS.

## Non supporté (futur)

- Impression directe ESC/POS via Web Bluetooth.
- Ouverture automatique du tiroir-caisse.
```

- [ ] **Step 5.5.3 — Commit**

```bash
git add src/components/pos/sale-detail-client.tsx docs/pos-printing.md
git commit -m "feat(pos): reprint receipt + printing one-pager"
```

---

## Section 6 — Seed updates + docs

### Task 6.1 — Seed updates

**Files:**
- Modify: `prisma/seed.ts`

- [ ] **Step 6.1.1 — Add 4 POS-only services to Provider 1**

In the section that creates offers for Provider 1, append:

```ts
const posOnly = [
  { title: "Brushing express", discountPrice: "25.000", durationMinutes: 30 },
  { title: "Coupe homme", discountPrice: "15.000", durationMinutes: 20 },
  { title: "Massage du cuir chevelu", discountPrice: "35.000", durationMinutes: 30 },
  { title: "Démêlage long", discountPrice: "18.000", durationMinutes: 20 },
];
for (const o of posOnly) {
  await prisma.offer.create({
    data: {
      providerId: provider1.id,
      title: o.title,
      discountPrice: o.discountPrice,
      durationMinutes: o.durationMinutes,
      category: "AUTRE",
      taxRate: "19.00",
      photos: [],
      publishedToMarketplace: false,
    } as never,
  });
}
```

- [ ] **Step 6.1.2 — Update product seed for `costPrice`**

In the products block:

```ts
const shampoing = await prisma.product.create({
  data: {
    providerId: provider1.id,
    name: "Shampoing Schwarzkopf 250ml",
    sku: "SCH-250",
    salePrice: "28.000",
    purchasePrice: "15.500",
    costPrice: "15.500",
    stockQuantity: 12,
  } as never,
});
await prisma.product.create({
  data: {
    providerId: provider1.id,
    name: "Masque hydratant L'Oréal",
    sku: "LOR-100",
    salePrice: "22.000",
    purchasePrice: "11.000",
    costPrice: "11.000",
    stockQuantity: 8,
  } as never,
});
await prisma.stockMovement.create({
  data: {
    productId: shampoing.id,
    delta: 6,
    reason: "PURCHASE",
    unitCost: "15.500",
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  } as never,
});
```

- [ ] **Step 6.1.3 — Closed drawer session with expenses**

```ts
const yesterdayOpen = new Date(Date.now() - 24 * 60 * 60 * 1000); yesterdayOpen.setHours(9, 0, 0, 0);
const yesterdayClose = new Date(yesterdayOpen); yesterdayClose.setHours(19, 45, 0, 0);

const session = await prisma.cashDrawerSession.create({
  data: {
    providerId: provider1.id,
    employeeId: ownerEmployee.id,
    openedAt: yesterdayOpen,
    closedAt: yesterdayClose,
    status: "CLOSED",
    openingFloat: "100.000",
    closingCount: "245.000",
    expectedCash: "245.000",
    variance: "0.000",
  } as never,
});

await (prisma as never as { cashDrawerExpense: { createMany: (a: unknown) => Promise<unknown> } })
  .cashDrawerExpense.createMany({
    data: [
      { cashDrawerSessionId: session.id, employeeId: ownerEmployee.id, amount: "22.000", category: "LIVRAISON", reason: "Schwarzkopf", createdAt: new Date(yesterdayOpen.getTime() + 60 * 60 * 1000) },
      { cashDrawerSessionId: session.id, employeeId: ownerEmployee.id, amount: "8.000", category: "ENTRETIEN", reason: "Café équipe", createdAt: new Date(yesterdayOpen.getTime() + 4 * 60 * 60 * 1000) },
    ],
  });
```

- [ ] **Step 6.1.4 — Commit**

```bash
git add prisma/seed.ts
git commit -m "chore(seed): POS-only offers, costed products + costed PURCHASE, drawer + expenses"
```

### Task 6.2 — Update CLAUDE.md and CONTEXT.md

**Files:**
- Modify: `CLAUDE.md`
- Modify: `CONTEXT.md`

- [ ] **Step 6.2.1 — Append to CLAUDE.md**

Add a section "## POS launch readiness additions" listing the new schema fields, new routes (`/pos/services`, `/pos/bienvenue`, `/pos/cash-drawer/[id]/rapport`), and the `<ThermalLayout>` primitives location.

- [ ] **Step 6.2.2 — Append to CONTEXT.md**

Add the same section but in narrative form, including the rationale:
- Why `products.manage` is reused for `/pos/services` (avoid permission sprawl).
- Why `pos.refund` is reused for DELETE expense (manager-level money op).
- Why `originalPrice` is now nullable.
- Why FIFO is out of scope; `StockMovement.unitCost` is captured but unused.
- Why `Product.purchasePrice` is now deprecated in favour of `costPrice`.

- [ ] **Step 6.2.3 — Commit**

```bash
git add CLAUDE.md CONTEXT.md
git commit -m "docs: POS launch readiness — schema, routes, rationale"
```

### Task 6.3 — End-to-end smoke test

- [ ] **Step 6.3.1 — Fresh provider walkthrough**

Local Postgres, `npm run dev`:
1. Run a `db:seed` reset on a *fresh* provider (or wipe one as in Task 2.8).
2. Log in, navigate to `/pos`. The wizard appears.
3. Walk all 6 steps to completion.
4. Make 3 sales (1 CASH, 1 CARD, 1 product). Tip on at least one.
5. Open the expense modal, record `LIVRAISON 25.000 "Test fournisseur"`.
6. Close the drawer with the counted amount; click "Imprimer le rapport Z". Verify totals match.
7. On a service from the wizard, click "Publier en ligne →", complete the marketplace fields, save. Verify it appears on `/offres`.
8. Confirm no POS-only service appears on `/offres`.

If any check fails, file an issue *before* opening the PR. Do not paper over.

### Task 6.4 — Open PR

- [ ] **Step 6.4.1 — Push the branch**

```bash
git push -u origin pos-launch
```

- [ ] **Step 6.4.2 — Open the PR**

Title: `POS launch readiness — catalogue split, onboarding, expenses + Z report, stock costs, thermal print`

Body skeleton:

```markdown
## Audit findings
[paste docs/pos-launch-audit.md highlights]

## What
- **Section 1** — Offer.publishedToMarketplace + nullable originalPrice; 6 public call sites filtered.
- **Section 2** — `/pos/bienvenue` wizard (6 steps, escape hatch, localStorage skip flags).
- **Section 3** — `CashDrawerExpense` model + `expectedCash()` helper + `/pos/cash-drawer/[id]/rapport`.
- **Section 4** — `Product.costPrice` + costed PURCHASE flow + margin display + analytics card.
- **Section 5** — `<ThermalLayout>` primitives; receipt, test ticket, Z report all share the 80mm CSS.

## Migrations
- `20260612120000_offer_marketplace_split`
- `20260612121000_provider_onboarding`
- `20260612122000_drawer_expenses`
- `20260612123000_product_cost_price`

## Verification
- [ ] Screenshots: wizard each step, `/pos/services`, expense modal, Z report 80mm preview, receipt preview, margin display.
- [ ] Vitest output for `drawer-math.test.ts` (7 tests).
- [ ] Spec drift log: `inventory.edit` retained on `/api/pos/products/[id]/stock` (vs spec's `products.manage`). New bulk route uses `products.manage`. Rationale documented in plan Task 4.2.
```

---

## Spec coverage map

| Spec section | Plan tasks | Coverage |
|---|---|---|
| Section 0 (audit) | Task 0 | Full |
| Section 1 (catalogue split) | T1.1, T1.2, T1.3, T1.4, T1.5 | Full |
| Section 2 (wizard) | T2.1, T2.2, T2.3, T2.4, T2.5, T2.6, T2.7, T2.8 | Full |
| Section 3 (drawer expenses + Z report) | T3.1, T3.2, T3.3, T3.4, T3.5, T3.6, T3.7 | Full |
| Section 4 (cost price + reception) | T4.1, T4.2, T4.3, T4.4, T4.5 | Full |
| Section 5 (thermal print) | T5.1, T5.2, T5.3, T5.4, T5.5 | Full |
| Section 6 (seeds + docs) | T6.1, T6.2, T6.3, T6.4 | Full |

## Known spec drifts (documented in plan and PR)

1. **Permission on `/api/pos/products/[id]/stock`**: spec says `products.manage`, plan keeps `inventory.edit` to avoid breaking existing callers. Bulk route uses `products.manage`.
2. **`Step 4 — Équipe`** wires to `POST /api/pos/employees`; if that endpoint doesn't exist (Task 0 audit confirms), the implementer extends the wizard step to call whatever endpoint `/prestataire/profil` uses for employee creation, then notes the chosen endpoint in the PR.
