# POS Launch Readiness — Design Spec

**Date:** 2026-06-11
**Branch:** `pos-launch`
**Goal:** Make Salonista's POS deployable door-to-door in <30 min, fully decoupled from the marketplace UX, with auditable cash drawer + thermal-printable receipts and Z reports.

---

## Decisions captured (Q1–Q7)

| # | Decision | Choice | Why |
|---|---|---|---|
| Q1 | `Offer.originalPrice` for POS-only services | Make it **nullable** | POS-only services have no "barred price"; nullable is the cleanest signal. |
| Q2 | Permission for `/pos/services` | Reuse **`products.manage`** | Same concept (manage sellable items), avoid permission sprawl. Documented in CONTEXT.md. |
| Q3 | Onboarding wizard layout | **Stepper on top, one step per screen** | Simplest, mobile-friendly, mirrors the door-to-door flow. |
| Q4 | "Publish to marketplace" UX | **Link from `/pos/services` → `/prestataire/offres/[id]`** | One source of truth for the marketplace editor; `/pos/services` stays fast. |
| Q5 | Z report layout (80mm) | **Dense, totals right-aligned** | Most compact, scannable, classic POS look. |
| Q6 | DELETE expense permission | Reuse **`pos.refund`** | Already the "manager-level" gate for sensitive money ops. |
| Q7 | Print code structure | **Shared `<ThermalLayout>` + 3 children** | Single source for 80mm CSS, consistent across receipts/test ticket/Z report. |

---

## Section 0 — Cross-cutting architecture

### Step 0 audit (mandatory before any code)

Produce `docs/pos-launch-audit.md` first. It must document:

1. All `prisma.offer.find*` call sites and whether each is "public" (must filter `publishedToMarketplace: true`) or "internal" (no filter). 15 files found in initial sweep — confirm and list.
2. Current `POST /api/offers` validation: `title`, `originalPrice`, `discountPrice`, `category`, `durationMinutes` all required, slot regen always triggered.
3. `/api/pos/catalog` returns active offers + products + customers + employees + provider summary; uses `discountPrice` as the sale price.
4. `src/components/pos/receipt.tsx` already implements `@page 80mm auto`; refactor target, not greenfield.
5. Onboarding state today: none. Fresh providers land on an empty POS dashboard with no guidance.
6. `Product.purchasePrice` exists but appears unread — confirm by audit, document as deprecated.

The PR description starts by quoting this audit. **Any deviation from this spec must be justified there.**

### Migrations (sequential, dated)

```
20260612120000_offer_marketplace_split        ← Section 1
20260612121000_provider_onboarding            ← Section 2
20260612122000_drawer_expenses                ← Section 3
20260612123000_product_cost_price             ← Section 4
```

Section 5 is code-only (no schema).

### Branch + execution

- Branch `pos-launch` off `main`.
- `subagent-driven-development` with implementer + spec-review + code-quality-review per task.
- Task order: **T1 → T2 → T3 → (T4 ∥ T5)**. T2 depends on T1's quick-add form; T4 and T5 are independent and can dispatch in parallel.
- Local `prisma generate` is broken; use `as never` casts where new fields aren't yet visible in the generated client. Deploy regenerates correctly.

---

## Section 1 — Decouple service catalogue from marketplace offers

### Schema (migration `20260612120000_offer_marketplace_split`)

```sql
ALTER TABLE "Offer" ADD COLUMN "publishedToMarketplace" BOOLEAN NOT NULL DEFAULT false;
UPDATE "Offer" SET "publishedToMarketplace" = true;  -- backfill: existing offers were marketplace
ALTER TABLE "Offer" ALTER COLUMN "originalPrice" DROP NOT NULL;
```

`originalPrice` becomes nullable. `category` stays non-null at the DB level; POS-only creation defaults it to `AUTRE` in code.

### Validation split — `POST /api/offers` and `PATCH /api/offers/[id]`

Shared body, branched on `publishedToMarketplace`:

| Field | POS-only (`false`) | Marketplace (`true`) |
|---|---|---|
| `title` | required (non-empty) | required (non-empty) |
| `discountPrice` (the charged price) | required, > 0 | required, > 0 |
| `durationMinutes` | required, in `ALLOWED_DURATIONS` | required, in `ALLOWED_DURATIONS` |
| `taxRate` | optional in body, defaults to 19 (schema default) | optional in body, defaults to 19 |
| `originalPrice` | optional, may be null | required, must be ≥ `discountPrice` |
| `category` | optional in body, defaults to `AUTRE` | required, user-chosen |
| `photos` | empty array tolerated | required, length ≥ 1 |
| `regenerateOfferSlots()` | **not called** | called after create/update |

A `publishedToMarketplace: false → true` transition is rejected (HTTP 400, French message listing missing fields) if marketplace validation fails. The reverse transition (`true → false`) is allowed and **stops slot generation for future dates** but never deletes existing bookings: `BookingItem.slotId` has `onDelete: Restrict`, so slot deletion is naturally blocked.

### Marketplace queries — filter

The 15 `prisma.offer.find*` call sites identified must be classified by the audit. Public-facing queries add `where: { publishedToMarketplace: true, active: true }`. Internal queries (POS catalog, provider dashboard, admin, seed, stats) keep their current `where`.

**Confirmed list (15 hits — subject to audit):**

| File | Filter? |
|---|---|
| `src/app/page.tsx` (homepage feed) | yes |
| `src/app/offres/page.tsx` (public catalog) | yes |
| `src/app/offre/[id]/page.tsx` (offer detail) | yes (404 if POS-only) |
| `src/app/api/offers/route.ts` GET public branch | yes |
| `src/app/api/offers/route.ts` GET provider branch | no |
| `src/app/api/offers/[id]/route.ts` (single fetch) | yes for public reads, no for provider/admin |
| `src/app/api/collaborations/route.ts` (influencer picker) | yes |
| `src/app/sitemap.ts` | yes |
| `src/app/api/admin/offers/route.ts` | no (admin sees all) |
| `src/app/api/provider/stats/route.ts` | no |
| `src/app/api/pos/catalog/route.ts` | no (register sells all) |
| `src/app/api/pos/search/route.ts` | no |
| `src/lib/pos-sale-create.ts` | no |
| `src/lib/slots.ts` | no |
| `src/generated/prisma/models/Offer.ts` | no (generated) |
| `src/generated/prisma/internal/class.ts` | no (generated) |

### `/pos/services` screen

- Rail item between Calendrier and Produits.
- Permission `products.manage`.
- Single page (no sub-route). Table: Nom · Prix · Durée · TVA · Actif · Statut marketplace.
- Quick-add row at top, opened by `N` shortcut or focusing the last empty row's first field. `Enter` saves and adds next row. `Escape` cancels.
- Inline edit on click. `Enter` saves, `Escape` cancels.
- Marketplace status badge: green "Publié·e en ligne" linking to `/prestataire/offres/[id]`, or grey "POS uniquement" with a "Publier en ligne →" link to the same editor.
- Active toggle: checkbox per row, saved immediately.
- POS theme (`[data-pos-theme]`).

### POS catalog

No change to `/api/pos/catalog`. It already filters on `active: true` and ignores `publishedToMarketplace`. POS-only services are sellable immediately on creation.

### Acceptance

1. Fresh provider, 0 services. Open `/pos/services`, press `N`, add 10 lines in <3 min, no photo prompt.
2. Visit `/offres` (public catalog) → these services do not appear.
3. Visit `/pos`, search → all 10 are sellable.
4. Click "Publier en ligne →" on a row → lands on `/prestataire/offres/[id]`, fill photos+category+originalPrice, check "Publier", save → appears on `/offres` and slots are generated.

---

## Section 2 — Onboarding wizard `/pos/bienvenue`

### Schema (migration `20260612121000_provider_onboarding`)

```sql
ALTER TABLE "ProviderProfile" ADD COLUMN "onboardingDismissedAt" TIMESTAMP(3);
```

One column. Per-step progress is recomputed from real data on every load; there is no need to persist "user was on step 3".

### Redirect logic

In `pos-shell-client.tsx`, when an OWNER mounts `/pos`:

```
IF employee.role === "OWNER"
   AND providerProfile.onboardingDismissedAt === null
   AND offersCount === 0
   AND productsCount === 0
   AND salesCount === 0
THEN router.replace("/pos/bienvenue")
```

The counts are added to the `/api/pos/catalog` response (cheap `_count`).

### Stepper

Six steps, one per screen. Progress bar at top. Completion is derived per load:

| # | Step | Considered complete when |
|---|---|---|
| 1 | Infos salon | `salonName` and `phone` both non-empty (matricule/footer optional) |
| 2 | Services | `offers.count >= 1` |
| 3 | Produits | `products.count >= 1` **OR** marked skipped via `localStorage["onboarding.productsSkipped"]` (client-side flag, salon-scoped key) |
| 4 | Équipe | `employees.count >= 1` (the OWNER themselves counts) |
| 5 | Tiroir & ticket | `cashDrawerSessions.count >= 1` AND `localStorage["onboarding.testTicketPrintedAt"]` non-empty (any value, presence-only check, salon-scoped key) |
| 6 | Terminé | "Ouvrir la caisse" clicked → `onboardingDismissedAt = NOW()` + redirect `/pos` |

### Per-step components

**Step 1 — Infos salon.** Controlled form, fields: `salonName`, `phone`, `address`, `city`, `matriculeFiscal` (with tooltip "n° d'identification fiscale, optionnel"), `receiptFooter` (3-line textarea, prefill "Merci de votre visite !"). Saves via `PATCH /api/provider/profile` on blur. "Suivant →" enabled when `salonName` + `phone` are filled.

**Step 2 — Services.** Reuses the quick-add form from `/pos/services` in compact embedded mode. Suggestion chips above: `[Brushing] [Coupe femme] [Coupe homme] [Couleur] [Mèches] [Lissage] [Soin visage] [Manucure] [Pédicure] [Épilation sourcils]`. Click a chip → prefills a row with the typical duration (Brushing 30, Couleur 90, …). Price always left empty. Service list shown below the form. "Suivant →" enabled at ≥1 service.

**Step 3 — Produits (skippable).** Quick form: `name`, `salePrice`, `taxRate` (default 19), `barcode` (hint "Scannez ici"), `stockQuantity`, `costPrice` (optional — see Section 4). "Passer cette étape" + "Suivant →" buttons.

**Step 4 — Équipe.** Reuses `EmployeeManagement` from `/prestataire/profil` if present (audit confirms). Otherwise a minimal inline form: `displayName` + `role` (CASHIER/STYLIST/MANAGER) + `pin` (4–6 digits). One-line explanation: "Chaque employé entre son PIN à la prise de poste pour identifier ses ventes et restreindre les actions sensibles."

**Step 5 — Tiroir & ticket test.** Two actions:
1. **Ouvrir le tiroir** — numpad modal for `openingFloat` → `POST /api/pos/cash-drawer/open`. Success state: "✅ Caisse ouverte avec 100.000 DT".
2. **Imprimer un ticket test** — button generates an **ephemeral** sale (not persisted) using `<TestTicketContent>` (Section 5). The bandeau "**TICKET TEST — sans valeur**" is rendered prominently. Fictive lines (Brushing 25.000, Coupe homme 15.000, total 40.000). Sets `testTicketPrintedAt` cookie. State: "✅ Ticket test imprimé".

**Step 6 — Terminé.** Recap card (nom salon, X services, Y produits, Z employés, tiroir ouvert). Button "Ouvrir la caisse" → `PATCH /api/provider/profile { onboardingDismissedAt: now }` + `router.replace("/pos")`.

### Skip and resume

- Steps 1, 5, 6 are mandatory (no "Passer" link). Steps 2, 3, 4 have a "Passer" link in the footer (Step 2 hides "Passer" if `offers.count === 0` — at least one service required to demo the POS).
- If the browser closes mid-wizard, reopening `/pos` triggers the redirect rule; the wizard mounts and computes the current step from real data.

### Escape hatch

Top-right "Quitter sans terminer" link → confirm `"Vous pourrez revenir plus tard, ou rouvrir le wizard depuis /pos/bienvenue."` → sets `onboardingDismissedAt = NOW()` and redirects to `/pos`. Manual re-entry is always possible by typing `/pos/bienvenue` in the URL bar.

### Acceptance

1. Fresh provider → `/pos` redirects to `/pos/bienvenue`.
2. Complete all six steps in <30 min → lands on `/pos` with a usable register.
3. Provider with any existing sale → never redirected.
4. Owner quits mid-wizard via the escape hatch → returns to `/pos`, never re-redirected.

---

## Section 3 — Cash drawer expenses + printable Z report

### Schema (migration `20260612122000_drawer_expenses`)

```prisma
enum ExpenseCategory {
  FOURNISSEUR
  LIVRAISON
  AVANCE_SALAIRE
  ENTRETIEN
  AUTRE
}

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

Plus the inverse relation on `CashDrawerSession.expenses` and `SalonEmployee.expensesRecorded`. `onDelete: Restrict` on the session — a session with expenses cannot be deleted.

### API

| Route | Method | Permission | Guards |
|---|---|---|---|
| `/api/pos/drawer/expenses` | POST | `pos.cash_drawer` | OPEN session for this provider; amount > 0 and ≤ 10000; `reason` non-empty |
| `/api/pos/drawer/expenses` | GET | `pos.cash_drawer` | returns expenses of the OPEN session + running total |
| `/api/pos/drawer/expenses/[id]` | DELETE | `pos.refund` | session must still be OPEN |

The POST wraps the status check + insert in a `$transaction` to prevent the race where the session closes between check and insert.

### UI

Button "Dépense" in `<CashDrawerIndicator>` (topbar). Modal:

```
┌────────────────────────────────────────┐
│ Nouvelle dépense                    × │
├────────────────────────────────────────┤
│ Montant      [    25.000      ] DT     │
│                                        │
│ Catégorie                              │
│ [Fournisseur] [Livraison]              │
│ [Avance] [Entretien] [Autre]           │
│                                        │
│ Motif        [______________________]  │
│                                        │
│ Employé : Anissa (auto)                │
│                                        │
│        [Annuler]   [Enregistrer]       │
└────────────────────────────────────────┘
```

Amount field uses the numpad pattern from `charge-modal.tsx` on tablet.

Expense list in `/pos/cash-drawer/[id]` panel:

```
DÉPENSES (3) — Total 35.000 DT
──────────────────────────────
Livraison    22.000  10:42  Anissa  [×]
Entretien     8.000  14:15  Karim   [×]
Avance        5.000  16:30  Anissa  [×]
```

The `×` only shows when `permissions["pos.refund"]` is true. Confirm dialog before DELETE.

### Variance math — pure function + tests

`src/lib/drawer-math.ts`:

```typescript
import { Decimal } from "@/generated/prisma/runtime/library";

export type DrawerInputs = {
  openingFloat: Decimal;
  cashSales: Decimal;
  cashRefunds: Decimal;
  expenses: Decimal;
};

export function expectedCash(d: DrawerInputs): Decimal {
  return d.openingFloat.add(d.cashSales).sub(d.cashRefunds).sub(d.expenses);
}

export function variance(expected: Decimal, counted: Decimal): Decimal {
  return counted.sub(expected); // positive = excess, negative = missing
}
```

Vitest tests in `src/lib/drawer-math.test.ts` (codebase convention: pure logic only, no Prisma mocking):

- happy path: 100 + 820 − 60 − 35 = 825, counted 825 → variance 0.000
- missing: counted 820 → variance −5.000
- excess: counted 830 → variance +5.000
- precision: 3-decimal TND values round-trip exact
- edge: opening 0, no expenses, no refunds
- edge: expenses > cashSales (variance allowed to go negative beyond cashSales)

The close route (`/api/pos/cash-drawer/[id]/close/route.ts`) is modified to call `expectedCash(...)` instead of inlining the formula, after adding `tx.cashDrawerExpense.aggregate({ where: { cashDrawerSessionId: id }, _sum: { amount: true } })` inside the transaction.

### Rapport Z (layout A — Q5)

**Server component:** `src/app/(pos)/pos/cash-drawer/[id]/rapport/page.tsx`. Computes all aggregates server-side; passes the result to client component `<ZReportPrintFrame>` (which wraps `<ZReportContent>` in `<ThermalLayout>` — Section 5).

**No new API route** — the server component reads directly via Prisma.

**Aggregations (all scoped to the session window):**

| Section | Source |
|---|---|
| Sales count + gross TTC | `prisma.sale.aggregate({ where: { providerId, status: "PAID", closedAt: { gte: openedAt, lte: closedAt } }, _count: true, _sum: { total: true } })` |
| Discounts total | `_sum.discountAmount` same filter |
| Tips total | `_sum.tipTotal` same filter |
| Refunds total (all methods, header line) | `prisma.refund.aggregate({ where: { sale: { providerId }, createdAt: { gte: openedAt, lte: closedAt } }, _sum: { totalAmount: true } })` |
| Cash refunds (used for drawer variance) | same query with `refundMethod: "CASH"` added |
| Payments by method | `prisma.payment.groupBy({ by: ["method"], where: { cashDrawerSessionId: id }, _sum: { amount: true } })` |
| TVA by rate | `prisma.saleItem.groupBy({ by: ["taxRateSnapshot"], where: { sale: { providerId, closedAt: { ... } } }, _sum: { lineSubtotal: true, lineTaxAmount: true } })` |
| Expenses detailed + total | `prisma.cashDrawerExpense.findMany({ where: { cashDrawerSessionId: id }, orderBy: { createdAt: "asc" } })` |
| Drawer: opening, expected, counted, variance | from `session` row directly |

### Layout (dense, totals right, layout A)

```
        SALON ANISSA
        Av. H. Bourguiba
        MF: 1234567A
─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
RAPPORT Z
10/06/2026 — Session #142
Ouverte 09:00 par Anissa
Fermée 19:45 par Anissa
─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
Ventes                    23
Brut TTC          1 245.000
Remises             -32.000
Pourboires          +45.000
Remboursements      -60.000
─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
Paiements
Espèces             820.000
Carte               380.000
Virement             45.000
─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
TVA
19% sur 1 045.000   198.550
 7% sur    95.000     6.650
─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
Tiroir espèces
Fond ouverture      100.000
− Dépenses           35.000
  Livraison  22.000
  Entretien   8.000
  Avance      5.000
Attendu             885.000
Compté              885.000
ÉCART                 0.000
─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
   Rapport Z — Salonista
```

### Print trigger

After `POST /api/pos/cash-drawer/[id]/close` succeeds, the success screen shows a "Imprimer le rapport Z" button → navigates to `/pos/cash-drawer/[id]/rapport` and calls `window.print()` 200 ms after mount. Also accessible from `/pos/cash-drawer` (history list) on each closed session.

### Immutability

CLOSED / RECONCILED sessions reject POST and DELETE on `/api/pos/drawer/expenses`. Expenses themselves are not editable — to correct, the owner creates a new compensating expense (only while the session is still OPEN).

### Acceptance

1. Open drawer with float 100; ring up 1 CASH sale of 50; record 1 expense of 20 → `expectedCash = 100 + 50 − 0 − 20 = 130`. Count 130 → variance 0.
2. Close the drawer → "Imprimer le rapport Z" → print preview opens with expenses listed, TVA per rate present.
3. `drawer-math.test.ts` green.
4. DELETE on a CLOSED session's expense → 409.

---

## Section 4 — Product cost price + stock reception

### Schema (migration `20260612123000_product_cost_price`)

```sql
ALTER TABLE "Product" ADD COLUMN "costPrice" DECIMAL(10,3);
ALTER TABLE "StockMovement" ADD COLUMN "unitCost" DECIMAL(10,3);
```

Both nullable. Many salons will not track cost — we tolerate NULL and silently disable margin calculations.

`Product.purchasePrice` already exists, non-null. If the audit confirms it is unread, we **keep it** (no destructive migration), do **not write** to it in new flows, **add `costPrice` as the canonical cost source**, and note it as deprecated in CONTEXT.md for a future cleanup.

### API

| Route | Method | Permission | Behavior |
|---|---|---|---|
| `/api/pos/products/[id]/stock` (existing, extended) | POST | `products.manage` | Body: `{ delta, reason, note?, unitCost?, updateCostPrice? }`. When `reason === "PURCHASE"` and `unitCost` provided, snapshot to `StockMovement.unitCost`. If `updateCostPrice: true` **and** `reason === "PURCHASE"` **and** `unitCost` is provided, set `Product.costPrice = unitCost`. `updateCostPrice` is silently ignored for non-PURCHASE reasons (UI never offers the checkbox outside reception). All in a `$transaction`. |
| `/api/pos/products/reception-bulk` (new) | POST | `products.manage` | Body: `{ items: [{ productId, quantity, unitCost?, updateCostPrice? }] }`. Iterates and creates one PURCHASE per item in a single `$transaction`. |

No new endpoint for margin display — computed client-side from `costPrice` and `salePrice`.

### UI

**`/pos/products` (existing page):**

Per-row "Réception" action → modal:

```
┌─────────────────────────────────────┐
│ Recevoir : Shampoing Schwarzkopf    │
├─────────────────────────────────────┤
│ Quantité reçue   [    6      ]      │
│ Prix d'achat HT  [  15.500   ] DT   │
│                  (actuel : 14.800)   │
│                                      │
│ ☑ Mettre à jour le prix d'achat     │
│   de référence                       │
│                                      │
│ Note (opt.)  [_______________]      │
│                                      │
│        [Annuler]   [Valider]         │
└─────────────────────────────────────┘
```

New "Réception multiple" button in the `/pos/products` toolbar → page `/pos/products/reception` with an editable table (scan-friendly: auto-focus on the barcode column; Tab advances to quantity + cost). Validation creates a multi-item PURCHASE.

**Product editor (`/pos/products/[id]/edit`, `/pos/products/new`):** add `costPrice` field (label "Prix d'achat HT").

**Margin display:**

- Product list: when `costPrice !== null`, right-aligned badge "Marge `<X>` DT (`<Y>`%)".
- Product detail: "Marge estimée" card under the price.
- `/pos/analytics`: new "Marge produits — estimation" card for the period. Calculation: `Σ over PRODUCT SaleItem of (priceSnapshot − product.costPrice) × quantity` when `costPrice !== null`. Items without cost are excluded with the note "X produits sans coût exclus du calcul".

**Wizard step 3 (Produits):** `costPrice` field added as optional.

### No FIFO

Margin analytics uses `Product.costPrice` (current value), not a historical weighted average. The label "**estimation**" on the analytics card is mandatory and explicit. CONTEXT.md will note: "FIFO/weighted-average costing is not implemented — margin analytics uses the current `costPrice` as a proxy, which over- or under-estimates depending on drift since purchase. `StockMovement.unitCost` is captured for a future FIFO implementation but currently unused."

### Acceptance

1. Create a product with no `costPrice` → no margin shown anywhere, no error.
2. Create one with `costPrice = 10`, `salePrice = 15` → margin "5.000 DT (33%)" on list + detail.
3. Receive 5 units at `unitCost = 11`, check "MAJ prix d'achat" → `Product.costPrice = 11`, `StockMovement` created with `unitCost = 11`.
4. Sell 3 units after the reception → `/pos/analytics` "Marge produits" shows `3 × (15 − 11) = 12` for that product.
5. Item in a sale where the product has been deleted (`SaleItem.productId === null` after `onDelete: SetNull`) → excluded from the calculation, "X produits sans coût exclus" shown.

---

## Section 5 — Thermal print readiness (80mm)

### Structure

```
src/components/pos/thermal/
├── thermal-layout.tsx       ← <ThermalLayout>, <ThermalHeader>, primitives
├── receipt-content.tsx      ← <ReceiptContent> (sale receipt)
├── test-ticket-content.tsx  ← <TestTicketContent> (wizard test ticket)
└── z-report-content.tsx     ← <ZReportContent> (drawer close Z report)
```

### `<ThermalLayout>`

Injects the print CSS **once** (replaces the per-doc `<style jsx global>` pattern). Renders children inside `<div className="thermal-doc">`. CSS:

```css
@page { size: 80mm auto; margin: 0; }
@media print {
  body > *:not(.thermal-print-root) { display: none !important; }
  .thermal-print-root { display: block !important; }
}
.thermal-doc {
  width: 80mm;
  padding: 5mm;
  font-family: ui-monospace, "Courier New", monospace;
  font-size: 11px;
  color: #000;
  background: #fff;
  line-height: 1.35;
}
```

### Primitives

```tsx
<ThermalHeader provider={...} title?="RAPPORT Z" />
<ThermalSeparator />          // dashed line
<ThermalRow label="Espèces" value="820.000" />
<ThermalTotal label="TOTAL" value="245.000" />  // bold, larger
<ThermalSection title="Paiements">{...}</ThermalSection>
<ThermalFooter text="Merci de votre visite !" />
```

### Receipt refactor

`src/components/pos/receipt.tsx` becomes:

```tsx
export function ReceiptPrintFrame({ data }: { data: ReceiptData }) {
  return (
    <ThermalLayout>
      <ReceiptContent data={data} />
    </ThermalLayout>
  );
}
```

All current presentation logic moves into `<ReceiptContent>` using the primitives. Behavior identical at every call site.

**Additions to receipt content (vs current):**

| Addition | Where |
|---|---|
| Address + matriculeFiscal if set | in `<ThermalHeader>` |
| Customer phone if attached | under "Client: …" |
| Change due for CASH | in payment block, `change = ΣcashPaid − total` if positive |
| For offline sales: ref `OFF-…` + "N° définitif attribué à la synchronisation" | conditional on `data.offlineId && !data.synced` |

### Test ticket

`<TestTicketContent>` renders a fictive sale (Brushing 25.000, Coupe homme 15.000, total 40.000, employee = current PIN holder). At the top: a bordered "**TICKET TEST — sans valeur**" banner (`border: 2px solid #000`, font-size 14px bold). No receipt number — placeholder "TEST". Footer: "Si vous voyez ce ticket, votre imprimante est prête."

The wizard's step 5 button mounts `<ThermalLayout><TestTicketContent .../></ThermalLayout>` on a transient route (`/pos/bienvenue/test-print`) and calls `window.print()`.

### Z report content

`<ZReportContent>` consumes pre-aggregated data from the server component `/pos/cash-drawer/[id]/rapport/page.tsx` (Section 3) and renders layout A.

### "Réimprimer" button

Added on `/pos/sales/[id]` and on the post-charge success screen. Mounts `<ReceiptPrintFrame data={...} />` client-side + `window.print()`. For already-synced offline sales, the `OFF-…` reference is still printed for traceability alongside the definitive receipt number.

### `docs/pos-printing.md`

One-pager committed in the branch:

**Setups supportés:**
- PC + USB thermal printer (Star, Epson, etc.) — works via the browser print dialog. Set paper to "80 × 297 mm" or custom.
- Android + Bluetooth printer — pair in OS settings, then use the browser's print sheet or a third-party plugin (KingPrinter, etc.).
- iPad — AirPrint to a compatible printer. Non-AirPrint thermal printers require a network dongle.

**Dépannage:**
- Blank page → confirm 80 mm paper size is selected in the print dialog.
- Right edge clipped → confirm margins = 0 in the browser print dialog.
- Font too small → adjust printer zoom at the OS level.

**Non supporté (futur):**
- Direct ESC/POS via Web Bluetooth.
- Auto cash-drawer kick.

### Acceptance

1. Print a sale receipt on a thermal 80 mm printer → complete ticket, no clipping, monospace, no color backgrounds.
2. Print the test ticket from the wizard → "TICKET TEST" banner visible, fictive lines present.
3. Print the Z report → totals right-aligned, dashed separators, expenses listed, layout A respected.
4. Preview the same receipt on A4 → degrades acceptably (the content stays in an 80 mm column on the A4 sheet).
5. Sale with `offlineId` set → "N° définitif attribué à la synchronisation" present.
6. "Réimprimer" on `/pos/sales/[id]` → re-mounts the frame, print dialog opens.

---

## Section 6 — Seed updates + global acceptance

### Seed (`prisma/seed.ts`)

Added on Provider 1:

**4 POS-only services** (`publishedToMarketplace: false`, `photos: []`, `originalPrice: null`):

- "Brushing express" — 25 DT — 30 min
- "Coupe homme" — 15 DT — 20 min
- "Massage du cuir chevelu" — 35 DT — 30 min
- "Démêlage long" — 18 DT — 20 min

Existing offers are backfilled with `publishedToMarketplace: true` by the migration, so no seed change for them.

**Products with `costPrice` + 1 costed PURCHASE:**

- "Shampoing Schwarzkopf 250ml" — salePrice 28 DT, costPrice 15.500 DT, initial stock 12.
- "Masque hydratant L'Oréal" — salePrice 22 DT, costPrice 11 DT, initial stock 8.
- 1 `StockMovement { reason: PURCHASE, unitCost: 15.500, delta: +6 }` on the shampoo, dated 7 days ago.

**Closed drawer session with expenses (exercises Z report):**

- `CashDrawerSession` opened yesterday 09:00, closed yesterday 19:45, `openingFloat: 100.000`, `employeeId = OWNER`, `closingCount: 245.000`.
- 4 fictive CASH sales in the window (≈200 DT total).
- 2 expenses:
  - `LIVRAISON` — 22.000 — "Schwarzkopf"
  - `ENTRETIEN` — 8.000 — "Café équipe"
- `expectedCash` and `variance` recomputed via `expectedCash()`.

After `npm run db:seed`, opening `/pos/cash-drawer` and printing the Z report yields a realistic ticket without any manual play-through.

### Documentation

| File | Addition |
|---|---|
| `CLAUDE.md` | Section "POS launch readiness additions": `Offer.publishedToMarketplace`, `Offer.originalPrice` nullable, `Product.costPrice`, `StockMovement.unitCost`, `CashDrawerExpense` model, `ProviderProfile.onboardingDismissedAt`, `/pos/services`, `/pos/bienvenue`, `/pos/cash-drawer/[id]/rapport`, `<ThermalLayout>` primitives. |
| `CONTEXT.md` | Same section, narrative + rationale for non-obvious choices (why `products.manage` for services, why `pos.refund` for DELETE expense, why `originalPrice` nullable). |
| `docs/pos-launch-audit.md` | Step 0 audit output — produced first, read by every implementer subagent. |
| `docs/pos-printing.md` | Thermal print one-pager (Section 5). |

### Global acceptance (post-merge)

The ultimate criterion to validate end-to-end:

> A provider created from scratch — the founder runs the wizard, configures everything in <30 min, prints a test ticket. The owner runs 3 sales (1 CASH, 1 CARD, 1 product), records 1 expense, closes the drawer, prints the Z report. None of their services appear on the public marketplace. On one service, they click "Publier en ligne", fill photos + category + originalPrice — the offer appears publicly. All DT values in millimes are exact.

---

## PR description template

Title: `POS launch readiness — catalogue split, onboarding, expenses + Z report, stock costs, thermal print`

Body sections:
- **Audit findings** (paste from `docs/pos-launch-audit.md`)
- **What** (per section, with deviation notes)
- **Migrations** (4 listed)
- **Verification** (screenshots: wizard each step, `/pos/services`, expense modal, Z report 80 mm preview, receipt preview, margin display; vitest output for `drawer-math.test.ts`)
