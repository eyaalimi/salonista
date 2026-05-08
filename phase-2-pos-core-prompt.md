# Salonista — Phase 2: POS Core + Tier B Offline

> **Prerequisites**: Phase 1 must be merged. Read `CONTEXT.md` and the Phase 1 additions section. Read `AGENTS.md` for Next.js 16 quirks. The codebase is **Next.js 16.2 + Turbopack + React 19 + Tailwind v4 + Prisma 7 + NextAuth v4 (JWT)** with **Serwist** PWA scaffolding already in place. The service worker exists at `src/app/sw.ts` with empty `runtimeCaching` — Phase 2 fills it.

## Mission

Build a working salon POS that lets an authorized employee:

1. Search/select a customer by phone (or proceed walk-in)
2. Build a cart of services + retail products
3. Apply line-level and sale-level discounts; assign each line to a stylist
4. Charge with split tender (cash + card + transfer), capture tips, allocate tips per employee
5. Print a thermal receipt and email a copy
6. Refund individual line items from any past sale
7. Operate **offline** for cash sales of cached services/products to cached customers, with sales auto-syncing when connectivity returns

POS reservation calendar, the analytics screen, and cash-drawer sessions are deferred to Phase 3. Rewards is Phase 4.

---

## Stack-specific patterns to honor

(Same as Phase 1, recap because they bite if forgotten.)

- Prisma client: `import { PrismaClient } from "@/generated/prisma/client"`; helper at `@/lib/prisma`. Money columns are `Decimal(10, 3)`.
- Multi-step writes inside `prisma.$transaction([...])`.
- Local `prisma generate` is broken — use `as never` casts when new fields aren't reflected.
- Pages with `useSearchParams()` need `<Suspense>`.
- Brand tokens: `brand-ink`, `brand-ink-soft`, `brand-cream`, `brand-sand`, `brand-gold`, `brand-gold-soft`, `brand-line`. Headings via `.luxury-heading` (Playfair). UI labels uppercase `tracking-[0.18em]`.
- All user-facing strings in **French**.
- Next.js 16 App Router: server components by default; mark client components with `"use client"`.
- Phase 1 helpers ready to use: `requireEmployee()`, `requirePermission()`, `requireModule("POS")`, `hasModule()`, `<ModuleGate>`, `normalizePhone()`, `tryNormalizePhone()`, `formatPhoneDisplay()`.

---

## 1. Prisma schema additions

### New enums

```prisma
enum SaleStatus {
  DRAFT          // cart in progress
  PENDING_SYNC   // created offline, awaiting server assignment
  PAID
  PARTIALLY_REFUNDED
  REFUNDED
  VOIDED
}

enum SaleItemKind {
  SERVICE
  PRODUCT
}

enum PaymentMethod {
  CASH
  CARD
  TRANSFER
  OTHER
  // LOYALTY_POINTS will be added in Phase 4
}

enum RefundReason {
  CUSTOMER_REQUEST
  SERVICE_ISSUE
  PRODUCT_DEFECT
  PRICING_ERROR
  OTHER
}

enum StockMovementReason {
  PURCHASE
  SALE
  ADJUSTMENT
  RETURN
  LOSS
  SYNC_NEGATIVE   // queued offline sale drove stock below zero on sync
}
```

### New models

```prisma
model Product {
  id                  String   @id @default(cuid())
  providerId          String
  name                String
  description         String?
  category            String?
  sku                 String
  barcode             String?
  purchasePrice       Decimal  @db.Decimal(10, 3)   // cost price (HT — tax-exclusive)
  salePrice           Decimal  @db.Decimal(10, 3)   // retail price TTC (tax-inclusive)
  taxRate             Decimal  @default(19.00) @db.Decimal(5, 2)
  stockQuantity       Int      @default(0)
  lowStockThreshold   Int      @default(5)
  photo               String?
  active              Boolean  @default(true)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  provider        ProviderProfile  @relation(fields: [providerId], references: [id], onDelete: Cascade)
  saleItems       SaleItem[]
  stockMovements  StockMovement[]
  refundItems     RefundItem[]

  @@unique([providerId, sku])
  @@unique([providerId, barcode])
  @@index([providerId, active])
  @@index([barcode])
}

model StockMovement {
  id                  String                @id @default(cuid())
  productId           String
  delta               Int                   // positive = stock in, negative = stock out
  reason              StockMovementReason
  saleId              String?
  refundId            String?
  employeeId          String?
  note                String?
  requiresReview      Boolean               @default(false)
  createdAt           DateTime              @default(now())

  product   Product         @relation(fields: [productId], references: [id], onDelete: Cascade)
  sale      Sale?           @relation(fields: [saleId], references: [id], onDelete: SetNull)
  refund    Refund?         @relation(fields: [refundId], references: [id], onDelete: SetNull)
  employee  SalonEmployee?  @relation(fields: [employeeId], references: [id], onDelete: SetNull)

  @@index([productId, createdAt])
  @@index([requiresReview])
}

model Sale {
  id                  String      @id @default(cuid())
  providerId          String
  customerId          String?     // walk-ins without phone allowed
  employeeId          String      // who rang it up
  bookingId           String?     // set if sale corresponds to a reservation (Phase 3)
  receiptNumber       String      // "S-20260514-0042" — assigned on PAID, "OFF-<uuid>" while offline
  status              SaleStatus  @default(DRAFT)

  // Money — all stored as TTC (tax-inclusive) values; HT/TVA derived for receipt
  subtotal            Decimal     @db.Decimal(10, 3)   // sum of line totals before sale-level discount
  discountAmount      Decimal     @default(0) @db.Decimal(10, 3)  // sale-level discount (already applied)
  discountIsPercent   Boolean     @default(false)
  discountValue       Decimal?    @db.Decimal(10, 3)   // raw input ("10" for 10% or 5.000 for 5 DT)
  taxTotal            Decimal     @db.Decimal(10, 3)   // sum of TVA across all lines (computed)
  tipTotal            Decimal     @default(0) @db.Decimal(10, 3)
  total               Decimal     @db.Decimal(10, 3)   // what the customer paid
  refundedTotal       Decimal     @default(0) @db.Decimal(10, 3)

  notes               String?

  // Offline tracking
  offlineId           String?     @unique  // client-generated UUID for offline sales
  syncedAt            DateTime?
  syncConflicts       Json?       // { stockNegative: [...], priceDrift: [...] }

  createdAt           DateTime    @default(now())
  closedAt            DateTime?   // when status moved to PAID
  updatedAt           DateTime    @updatedAt

  provider        ProviderProfile  @relation(fields: [providerId], references: [id], onDelete: Cascade)
  customer        Customer?        @relation(fields: [customerId], references: [id], onDelete: SetNull)
  employee        SalonEmployee    @relation(fields: [employeeId], references: [id])
  booking         Booking?         @relation(fields: [bookingId], references: [id], onDelete: SetNull)

  items           SaleItem[]
  payments        Payment[]
  tipAllocations  TipAllocation[]
  refunds         Refund[]
  stockMovements  StockMovement[]

  @@unique([providerId, receiptNumber])
  @@index([providerId, status, createdAt])
  @@index([customerId])
  @@index([employeeId])
}

model SaleItem {
  id                  String         @id @default(cuid())
  saleId              String
  kind                SaleItemKind
  offerId             String?
  productId           String?
  assignedEmployeeId  String?

  // Snapshots — line is stable even if catalog changes later
  nameSnapshot        String
  priceSnapshot       Decimal        @db.Decimal(10, 3)   // unit TTC price at time of sale
  taxRateSnapshot     Decimal        @db.Decimal(5, 2)
  quantity            Int            @default(1)

  // Per-line discount
  discountAmount      Decimal        @default(0) @db.Decimal(10, 3)   // applied amount
  discountIsPercent   Boolean        @default(false)
  discountValue       Decimal?       @db.Decimal(10, 3)

  // Computed
  lineSubtotal        Decimal        @db.Decimal(10, 3)   // (priceSnapshot * quantity) - discountAmount
  lineTaxAmount       Decimal        @db.Decimal(10, 3)   // TVA portion of lineSubtotal (since TTC)
  lineTotal           Decimal        @db.Decimal(10, 3)   // = lineSubtotal (TTC; here for clarity)

  refundedQuantity    Int            @default(0)

  createdAt           DateTime       @default(now())

  sale              Sale            @relation(fields: [saleId], references: [id], onDelete: Cascade)
  offer             Offer?          @relation(fields: [offerId], references: [id], onDelete: SetNull)
  product           Product?        @relation(fields: [productId], references: [id], onDelete: SetNull)
  assignedEmployee  SalonEmployee?  @relation("SaleItemAssignedEmployee", fields: [assignedEmployeeId], references: [id], onDelete: SetNull)
  refundItems       RefundItem[]

  @@index([saleId])
}

model Payment {
  id          String         @id @default(cuid())
  saleId      String
  method      PaymentMethod
  amount      Decimal        @db.Decimal(10, 3)
  reference   String?        // card auth code, transfer reference, etc.
  createdAt   DateTime       @default(now())

  sale  Sale  @relation(fields: [saleId], references: [id], onDelete: Cascade)

  @@index([saleId])
}

model TipAllocation {
  id          String          @id @default(cuid())
  saleId      String
  employeeId  String
  amount      Decimal         @db.Decimal(10, 3)
  createdAt   DateTime        @default(now())

  sale      Sale           @relation(fields: [saleId], references: [id], onDelete: Cascade)
  employee  SalonEmployee  @relation("TipAllocationEmployee", fields: [employeeId], references: [id])

  @@index([saleId])
  @@index([employeeId])
}

model Refund {
  id              String         @id @default(cuid())
  saleId          String
  employeeId      String
  reason          RefundReason
  notes           String?
  totalAmount     Decimal        @db.Decimal(10, 3)
  refundMethod    PaymentMethod
  reference       String?
  createdAt       DateTime       @default(now())

  sale            Sale            @relation(fields: [saleId], references: [id], onDelete: Cascade)
  employee        SalonEmployee   @relation("RefundEmployee", fields: [employeeId], references: [id])
  items           RefundItem[]
  stockMovements  StockMovement[]

  @@index([saleId])
}

model RefundItem {
  id              String     @id @default(cuid())
  refundId        String
  saleItemId      String
  productId       String?    // copied for stock movement convenience
  quantity        Int
  amountRefunded  Decimal    @db.Decimal(10, 3)
  restock         Boolean    @default(true)
  createdAt       DateTime   @default(now())

  refund    Refund    @relation(fields: [refundId], references: [id], onDelete: Cascade)
  saleItem  SaleItem  @relation(fields: [saleItemId], references: [id])
  product   Product?  @relation(fields: [productId], references: [id], onDelete: SetNull)

  @@index([refundId])
  @@index([saleItemId])
}

model SaleSequence {
  // Daily counter for receipt numbers, scoped per salon
  providerId  String
  date        DateTime     // truncated to date
  counter     Int          @default(0)

  @@id([providerId, date])
}
```

### Modifications to existing models

- `ProviderProfile`:
  - add `matriculeFiscal String?`  (Tunisian tax ID for fiscal receipts; nullable so existing salons aren't broken)
  - add `receiptFooter String?`    (free-text footer printed on receipts: thank-you note, return policy, etc.)
  - add back-relations: `products Product[]`, `sales Sale[]`
- `Booking`: add `sale Sale?` back-relation (one-to-one optional)
- `SalonEmployee`: add back-relations
  - `salesRung Sale[]`
  - `saleItemsAssigned SaleItem[] @relation("SaleItemAssignedEmployee")`
  - `tipAllocations TipAllocation[] @relation("TipAllocationEmployee")`
  - `refundsIssued Refund[] @relation("RefundEmployee")`
  - `stockMovements StockMovement[]`
- `Customer`: add `sales Sale[]` back-relation
- `Offer`: add `saleItems SaleItem[]` back-relation

### Migration

```bash
npx prisma migrate dev --name phase2_pos_core
```

---

## 2. Helpers

### `src/lib/money.ts`

```ts
import { Decimal } from "@/generated/prisma/runtime/library";

/** TTC price → HT (tax-exclusive) given a tax rate percentage. */
export function ttcToHt(ttc: Decimal, taxRatePct: Decimal): Decimal;
//   ht = ttc / (1 + taxRatePct/100)
//   round to 3 decimals (millimes)

/** HT price + tax rate → TTC. */
export function htToTtc(ht: Decimal, taxRatePct: Decimal): Decimal;

/** Compute TVA portion of a TTC price. */
export function taxFromTtc(ttc: Decimal, taxRatePct: Decimal): Decimal;
//   tax = ttc - ttcToHt(ttc, rate)

/** Apply a discount (percent or fixed) to a base amount. Always non-negative result. */
export function applyDiscount(
  base: Decimal,
  value: Decimal,
  isPercent: boolean,
): { discounted: Decimal; appliedAmount: Decimal };

/** Tunisian Dinar formatting: "12,500 DT" (3 decimals, comma separator, " DT" suffix). */
export function formatDT(amount: Decimal | number | string): string;

/** Round to nearest millime (3 decimals). */
export function roundMillime(d: Decimal): Decimal;
```

Add `src/lib/money.test.ts` with cases for each function. Tax math is the spec's most error-prone area — exercise edge cases (0% tax, 100% discount, very small amounts).

### `src/lib/receipt-number.ts`

```ts
/**
 * Generates the next receipt number for a salon and date inside an
 * existing transaction. Atomic via SaleSequence row-level upsert.
 *
 * Format: "S-YYYYMMDD-NNNN"
 */
export async function nextReceiptNumber(
  tx: PrismaTransactionClient,
  providerId: string,
  date: Date,
): Promise<string>;
```

### `src/lib/sale-totals.ts`

Pure functions that compute sale totals from a draft cart structure. The same logic must run client-side (for live UI) and server-side (for validation on POST). Export both for reuse.

```ts
export type CartLineInput = {
  kind: "SERVICE" | "PRODUCT";
  offerId?: string;
  productId?: string;
  nameSnapshot: string;
  priceSnapshot: string;       // Decimal as string for transport
  taxRateSnapshot: string;
  quantity: number;
  discount?: { value: string; isPercent: boolean };
  assignedEmployeeId?: string;
};

export type CartInput = {
  lines: CartLineInput[];
  saleDiscount?: { value: string; isPercent: boolean };
  tipTotal?: string;
};

export type ComputedTotals = {
  lines: Array<{
    lineSubtotal: string;
    lineTaxAmount: string;
    lineTotal: string;
    discountAmount: string;
  }>;
  subtotal: string;
  saleDiscountAmount: string;
  taxTotal: string;
  tipTotal: string;
  total: string;
  taxBreakdown: Array<{ rate: string; base: string; tax: string }>;
};

export function computeTotals(cart: CartInput): ComputedTotals;
```

Tests in `sale-totals.test.ts`. Server `POST /api/pos/sales` recomputes totals from line snapshots and rejects if client-sent totals diverge by more than 0.001 DT.

---

## 3. Routing & layout

POS becomes a **separate top-level route** at `/pos` with its own full-screen layout — no dashboard sidebar.

### File moves

- Delete `src/app/(dashboard)/prestataire/pos/page.tsx` (the Phase 1 placeholder)
- Update Phase 1 PIN flow to redirect to `/pos` instead of `/prestataire/pos` (in `src/app/salon-pin/...`)
- Update the conditional "Caisse" sidebar item under `/prestataire/*` to be a link to `/pos` (opens in same tab)

### New route group `(pos)`

```
src/app/(pos)/
├── layout.tsx           # Full-screen layout: top bar (logo, salon, employee avatar, online/offline indicator, sync queue badge), main content area
├── pos/
│   ├── page.tsx         # The cashier UI
│   ├── sales/
│   │   ├── page.tsx     # Past sales list
│   │   └── [id]/
│   │       └── page.tsx # Sale detail (for refunds, reprint)
│   └── products/
│       ├── page.tsx     # Product catalog management
│       ├── new/page.tsx
│       └── [id]/edit/page.tsx
```

The `(pos)` layout:

- Uses the Tailwind class `min-h-dvh bg-brand-cream` and avoids overflow on the body
- Top bar: 56px tall, charcoal `bg-brand-ink` with `text-brand-cream`, contains:
  - Left: `<Logo tone="light" />` + salon name in small caps
  - Center: current employee name + role badge
  - Right: online/offline pill (green dot "En ligne" / amber dot "Hors ligne — N en attente"), settings cog
- Auth gate: `requirePermission("pos.sell")` and `requireModule("POS")` at the layout level. Redirect to `/salon-pin` if unauthenticated.

---

## 4. POS main screen — `/pos`

The three-panel layout. Designed for tablets in landscape (1024×768 minimum) but responsive down to ~900px. Below that, fall back to a stacked layout for emergency phone use.

### Layout grid

```
┌─────────────────────────────────────────────────────────────┐
│  Top bar (from layout)                                       │
├──────────────┬─────────────────────────┬────────────────────┤
│              │                          │                    │
│  Customer    │   Cart (or Calendar in  │  Catalog            │
│  panel       │    Phase 3)             │  - Services tab     │
│  ~280px      │                          │  - Products tab     │
│              │                          │  - Search / Scanner │
│              │                          │   ~360px            │
│              │                          │                    │
├──────────────┴─────────────────────────┴────────────────────┤
│  Bottom action bar — totals + Charge button (sticky)         │
└─────────────────────────────────────────────────────────────┘
```

### Customer panel (left)

- Phone search input with autocomplete from cached own-scope customers (debounced, 200ms)
- "Ajouter un client" button → modal to create new customer
- "Vente sans client" pill → walk-in mode (no customer attached)
- Selected customer card: name, formatted phone, "client depuis [date]", number of past visits at this salon, lifetime spend
- "Voir l'historique" link → opens a drawer with this customer's past sales at this salon
- If `scope: external` (customer registered at another salon): show only name + phone with a small "Premier passage chez vous" badge; offer "Compléter le profil" (edits firstName/lastName only)

### Cart panel (center)

- Empty state: "Panier vide. Sélectionnez un service ou un produit dans le catalogue à droite, ou scannez un code-barres."
- Each line shows:
  - Name + small "(Service)" or "(Produit)" tag
  - Stylist assignment dropdown (defaults to current employee for services; blank for products)
  - Quantity stepper (products only; services fixed at 1)
  - Unit price (TTC)
  - Per-line discount button — opens inline editor for percent/fixed amount, gated by `pos.discount`
  - Line total (TTC, with tiny tax annotation)
  - Trash icon to remove
- Sale-level discount control above the bottom bar (gated by `pos.discount`)
- Tip input above the bottom bar
- Notes textarea (collapsible "Ajouter une note")

### Catalog panel (right)

Tabs: **Services** | **Produits**

**Services tab:**
- Vertical scrollable list of `Offer` rows for this provider
- Each row: photo thumbnail, name, duration, price TTC, tax rate small print
- Search input filters by name
- Tap to add to cart (qty 1)
- Inline cue: "Glisser pour assigner un coiffeur" (mobile-friendly)

**Produits tab:**
- Same layout, with products from the salon's catalog
- **Barcode input field at the top of the panel — always focused when this tab is active**, captures keyboard input from USB scanners (which send digits + Enter). On Enter:
  - Lookup product by barcode
  - If found, add to cart
  - If not found, briefly flash the input red with "Code-barres inconnu"
  - Audio cue (short beep) on success/failure (optional, configurable later)
- Stock badge: green "En stock" / amber "Stock faible" / red "Rupture" (allow adding to cart anyway, with a confirm dialog)
- "Nouveau produit" button at the top of the panel → opens product create modal (gated by `products.manage`)

### Bottom action bar (sticky)

```
[Sous-total: 75,000 DT]  [Remise: -5,000 DT]  [Pourboire: 10,000 DT]  [TVA: 11,860 DT]    Total: 80,000 DT    [ Encaisser ]
```

- Subtotal, sale-level discount, tip, tax (read-only label), total
- "Encaisser" button → opens charge modal (disabled if cart empty)
- "Annuler" small link → confirm dialog → clear cart

### Charge modal

Multi-step modal:

**Step 1 — Payment.** Input area shows total due in large type. Below, tappable method tiles: ESPÈCES, CARTE, VIREMENT, AUTRE. Selecting a tile reveals an amount input prefilled with the remaining due. Multiple tiles can be tapped in sequence (split tender). A running list of payments with per-line remove buttons shows above the tiles. Continue button is enabled when sum of payments ≥ total. Change due is shown in green when sum > total (cash overpayment).

**Step 2 — Tip allocation** (only if `tipTotal > 0`). Default split: divide tip equally among employees who have lines on the sale. Manual override: drag/input per employee. Validation: sum must equal tipTotal.

**Step 3 — Receipt.** Two checkboxes:
- "Imprimer le reçu" (default ON if `window.print` available)
- "Envoyer par email" (default OFF unless customer email exists, then ON)

If "email" checked but no email on file, show inline input.

**Step 4 — Confirm.** Server POST to `/api/pos/sales`. On success:
- Local IndexedDB cache updated
- Receipt rendered in print-friendly view (auto-`window.print()` if checkbox was set)
- Email queued
- Cart cleared
- Customer panel resets

### Past sales screen — `/pos/sales`

- Date range picker (default: today)
- Search by receipt number, customer name, or amount
- Table of sales with: receipt number, time, customer, employee, total, status pill, refunded amount
- Tap row → `/pos/sales/[id]`

### Sale detail screen — `/pos/sales/[id]`

- Read-only display of the sale (lines, payments, tips, totals, receipt)
- "Réimprimer" button → re-render receipt + print
- "Renvoyer par email" button
- "Rembourser" button (gated by `pos.refund`) → opens refund flow
- If `status === REFUNDED` or `PARTIALLY_REFUNDED`, show refunds list with reason and date

### Refund flow

Modal opened from sale detail:

1. **Select items.** Each line has a quantity stepper (max = `quantity - refundedQuantity`). For products, a "Remettre en stock" toggle (default ON).
2. **Reason** dropdown + optional notes.
3. **Refund method.** Default = original payment method if single-method sale; otherwise prompt to choose. Cashier can override to cash.
4. **Confirm.** Server POST to `/api/pos/sales/[id]/refunds`. On success:
   - Sale `status` updates (`REFUNDED` if all items, else `PARTIALLY_REFUNDED`)
   - `refundedTotal` increments
   - Stock restored if "Remettre en stock" was on
   - Refund receipt rendered (separate document, references original receipt number)

---

## 5. Receipt rendering

### Print receipt

Component `src/components/pos/receipt.tsx`. Renders to a hidden `<div>` styled for thermal printers (80mm width, monospace).

Layout:

```
        Salonista (logo)
     [Salon Name in caps]
[Address line]
[City, Postal]
Tél: [phone]
Matricule fiscal: [matriculeFiscal] (if set)
─────────────────────────────────
Reçu N° S-20260514-0042
Le 14/05/2026 à 14:32
Caissière: Sarra
Client: Amira Ben Salah (+216 22 345 678)
─────────────────────────────────
1× Coupe femme               45,000
   par Yasmine
1× Shampoing Kérastase 250ml 30,000
─────────────────────────────────
Sous-total            HT       63,025
TVA 19% sur 45 DT              7,185
TVA 19% sur 30 DT              4,790
                  Total TTC   75,000
Remise                        -5,000
Pourboire                     10,000
                       TOTAL  80,000
─────────────────────────────────
Espèces                       80,000
─────────────────────────────────
[receiptFooter from provider, if set]
[Thank-you in French]
```

Printing: window.print() with a print-only stylesheet. CSS `@page { size: 80mm auto; margin: 0; }` and `@media print { body > *:not(.receipt-print) { display: none; } }`.

### Email receipt

`src/lib/mail.ts` already has the transport. Add `sendReceiptEmail(saleId)`:

- Subject: `Votre reçu Salonista — [Salon Name]`
- HTML body styled like the print receipt but with brand colors and the `<Logo>` SVG
- PDF attachment: optional in v1; if added, use `puppeteer-core` is overkill — instead generate a simple PDF via `pdfkit` with the same content. **Skip PDF for v1; HTML email only.**

---

## 6. API routes

All POS routes go under `/api/pos/*`. All require `requireEmployee()` and `requireModule("POS")`.

### `POST /api/pos/sales`

Create a sale (online path).

Body:
```json
{
  "offlineId": "<uuid>",          // optional; if present, idempotency key
  "customerId": "<id>" | null,
  "lines": [
    { "kind": "SERVICE", "offerId": "...", "quantity": 1, "discount": null, "assignedEmployeeId": "..." },
    { "kind": "PRODUCT", "productId": "...", "quantity": 2, "discount": { "value": "10", "isPercent": true } }
  ],
  "saleDiscount": null | { "value": "5.000", "isPercent": false },
  "payments": [
    { "method": "CASH", "amount": "50.000" },
    { "method": "CARD", "amount": "30.000", "reference": "AUTH123" }
  ],
  "tipTotal": "10.000",
  "tipAllocations": [
    { "employeeId": "...", "amount": "10.000" }
  ],
  "notes": "..."
}
```

Server logic (inside `prisma.$transaction`):

1. Permission: `pos.sell`. If sale has `discount` or item has `discount`: also `pos.discount`.
2. Validate customer (if provided) exists and belongs to scope.
3. Load each offer/product, build `priceSnapshot`/`taxRateSnapshot`/`nameSnapshot` from server data.
4. Deduct stock for product lines (`stockQuantity -= quantity`); if it goes negative, allow but flag the eventual `StockMovement` with `requiresReview: true`.
5. Recompute totals via `computeTotals()` server-side. Reject with 422 if client total diverges by more than 0.001 DT.
6. Validate sum of payments equals `total`. Validate tip allocations sum equals `tipTotal`.
7. Generate receipt number via `nextReceiptNumber(tx, providerId, today)`.
8. Create `Sale`, `SaleItem[]`, `Payment[]`, `TipAllocation[]`, `StockMovement[]` rows.
9. If `offlineId` provided and a sale already exists with that offlineId → return that sale (idempotency).
10. Set `status: PAID`, `closedAt: now()`.
11. Queue receipt email if requested.

Returns `201` with the full sale + computed totals + receipt number.

### `POST /api/pos/sales/sync` — bulk offline sync endpoint

Body:
```json
{ "sales": [ <one or more sale payloads as above, each with offlineId> ] }
```

Processes each sale transactionally (one transaction per sale, not per batch — partial failures should not roll back successful syncs). Returns:

```json
{
  "results": [
    { "offlineId": "...", "status": "ok", "saleId": "...", "receiptNumber": "..." },
    { "offlineId": "...", "status": "duplicate", "saleId": "..." },
    { "offlineId": "...", "status": "conflict", "errors": [...] }
  ]
}
```

Conflict types reported:
- `customer_deleted` → sale completed as walk-in, customerId nulled, note added
- `product_deleted` → line uses snapshot, marks line note "produit retiré du catalogue"
- `offer_deleted` → same
- `price_drift` → sale completed at offline price; flagged for review if delta > 10%
- `stock_negative` → sale completed; StockMovement flagged `requiresReview`

### Other routes

```
GET    /api/pos/sales                         → list (filterable by date range, customer, employee, status)
GET    /api/pos/sales/[id]                    → detail with lines, payments, tips, refunds
POST   /api/pos/sales/[id]/refunds            → create refund (per-line)
POST   /api/pos/sales/[id]/email              → re-send receipt email

GET    /api/pos/products                      → list (provider-scoped, includes inactive if ?all=1)
POST   /api/pos/products                      → create
GET    /api/pos/products/[id]
PUT    /api/pos/products/[id]
DELETE /api/pos/products/[id]                 → soft delete (active=false)
POST   /api/pos/products/[id]/stock           → manual adjustment { delta, reason, note }
GET    /api/pos/products/lookup?barcode=XXX   → exact barcode match (used by scanner)

GET    /api/pos/catalog                       → combined offers + products + customers ("own scope" only) — single payload optimized for offline cache prime
```

The `/api/pos/catalog` endpoint is the offline cache primer — Phase 2's offline shell calls it on POS load to populate IndexedDB.

---

## 7. Tier B offline mode

The PWA must continue functioning during connectivity outages for the **safe operations** defined in the design discussion.

### Capability matrix (enforce in UI + service worker)

| Operation | Online | Offline |
|---|:-:|:-:|
| Look up cached customer by phone | ✓ | ✓ |
| Create new customer | ✓ |  ❌ blocked, message: "Création de client indisponible hors ligne" |
| Edit customer (own scope) | ✓ | ✓ (queued) |
| Add cached service to cart | ✓ | ✓ |
| Add cached product to cart (incl. barcode) | ✓ | ✓ |
| Apply discounts | ✓ | ✓ |
| Cash payment | ✓ | ✓ |
| Card payment | ✓ | ❌ (terminal needs internet) |
| Transfer payment | ✓ | ✓ (just records reference) |
| Print thermal receipt | ✓ | ✓ |
| Email receipt | ✓ | queued — sent on sync |
| Reservations / calendar (Phase 3) | ✓ | ❌ |
| Refunds | ✓ | ❌ (need server-confirmed sale state) |
| Reward redemption (Phase 4) | ✓ | ❌ |

Display the offline indicator in the top bar with the queued sale count: **"Hors ligne — 3 ventes en attente"**.

### Service worker — runtime caching

Update `src/app/sw.ts` (Phase 1 left it empty):

```ts
import { Serwist } from "serwist";
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from "serwist";
import { ExpirationPlugin } from "serwist";

declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: (string | { url: string; revision: string | null })[];
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // POS HTML shell
      matcher: ({ url }) => url.pathname.startsWith("/pos") || url.pathname === "/salon-pin",
      handler: new NetworkFirst({
        cacheName: "pos-shell",
        networkTimeoutSeconds: 3,
      }),
    },
    {
      // Catalog refresh (services + products + own-scope customers)
      matcher: ({ url }) => url.pathname === "/api/pos/catalog",
      handler: new StaleWhileRevalidate({ cacheName: "pos-catalog" }),
    },
    {
      // Customer lookup
      matcher: ({ url }) => url.pathname.startsWith("/api/customers/lookup"),
      handler: new StaleWhileRevalidate({ cacheName: "customer-lookup" }),
    },
    {
      // Product images
      matcher: ({ request }) => request.destination === "image" && request.url.includes("/uploads/"),
      handler: new CacheFirst({
        cacheName: "uploads",
        plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 })],
      }),
    },
  ],
});

serwist.addEventListeners();
```

POSTs to `/api/pos/sales` and `/api/pos/sales/sync` are NOT cached — they're handled by the IndexedDB sync queue described below.

### IndexedDB layer

Create `src/lib/pos-offline-db.ts` using `idb` (small wrapper over IndexedDB):

```bash
npm install idb
```

Schema:

- **Database**: `salonista-pos`, version 1
- **Stores**:
  - `catalog` — single key entries: `{ key: "offers" | "products" | "customers", value: <array>, refreshedAt: ISO }`
  - `pending_sales` — keyed by `offlineId`, stores full sale payload + status (`pending`, `syncing`, `failed`)
  - `sync_log` — append-only log of sync attempts and outcomes (capped to 200 entries)
  - `cart_draft` — per-employee draft cart, key = employeeId

API:

```ts
export async function refreshCatalog(): Promise<void>;            // GET /api/pos/catalog → store
export async function findCachedOffers(): Promise<Offer[]>;
export async function findCachedProducts(): Promise<Product[]>;
export async function findCachedProductByBarcode(barcode: string): Promise<Product | null>;
export async function findCachedCustomerByPhone(phone: string): Promise<Customer | null>;
export async function searchCachedCustomers(prefix: string): Promise<Customer[]>;

export async function queueSale(payload: OfflineSalePayload): Promise<void>;
export async function listPendingSales(): Promise<OfflineSalePayload[]>;
export async function attemptSync(): Promise<SyncResult[]>;
//   Reads pending_sales, POSTs to /api/pos/sales/sync, updates statuses
export async function clearSyncedSale(offlineId: string): Promise<void>;

export async function saveCartDraft(employeeId: string, cart: CartInput): Promise<void>;
export async function loadCartDraft(employeeId: string): Promise<CartInput | null>;
```

### Online/offline detection

`src/components/pos/online-status.tsx`:

- Tracks `navigator.onLine`
- Listens to `online` / `offline` window events
- Periodically attempts a HEAD request to `/api/health` (small, cheap) — `navigator.onLine` lies in some cases
- Exposes a React context `useOnlineStatus(): { online: boolean; pendingCount: number; lastSyncAt: Date | null }`

When transitioning offline → online, calls `attemptSync()` automatically. Show a toast: "Reconnecté — synchronisation de N ventes…" and "Synchronisation terminée" or "Synchronisation : 2 réussies, 1 erreur — voir les détails."

### Health endpoint

`GET /api/health` — returns `{ ok: true, time: ISO }`. Public, no auth, no DB query (just a static response). Used by the connectivity probe.

### Sync conflict UI

When `attemptSync()` returns conflicts, an admin panel at `/pos/sync-issues` (gated by `pos.refund`) lists them with:

- Original offline sale (receipt rendered from snapshot)
- Conflict type and explanation
- Action button (acknowledge / re-process / cancel sale)

For Phase 2: show the list and let owner acknowledge. Re-process logic can be Phase 3.

### Background Sync (best-effort)

If the browser supports `SyncManager`, register a sync tag `pos-sale-sync` after queuing a sale. The service worker handler calls `attemptSync()` when the OS triggers it. Fall back to in-app polling (every 30s while POS tab is open) when Background Sync is unavailable (Safari).

---

## 8. Product CRUD UI

`src/app/(pos)/pos/products/page.tsx`:

- Table of products with photo, name, SKU, barcode, sale price, stock badge
- Search by name/SKU/barcode
- "Nouveau produit" → `/pos/products/new`
- Per-row "Modifier" / "Désactiver"
- Permission gate: `products.manage` to create/edit; `inventory.view` to view list

Product form (new + edit):

- Name, description, category (free text with autocomplete from existing categories)
- SKU (auto-generate suggested if blank: salon prefix + sequential)
- Barcode (input + "Scanner" button using BarcodeDetector API where available; fallback to manual entry)
- Purchase price (HT — internal cost)
- Sale price (TTC)
- Tax rate select: same options as Offer (0/7/13/19/custom)
- Initial stock quantity (only on create)
- Low-stock threshold
- Photo upload via existing `<ImageUpload>` component
- Active toggle

Server-side validations: SKU unique per provider, barcode unique per provider when provided, prices ≥ 0, taxRate 0–100.

---

## 9. Provider settings — fiscal info

Add to the existing provider profile edit page (`src/app/(dashboard)/prestataire/profil/...`):

- New section "Informations fiscales"
- Field: "Matricule fiscal" (string, optional, free format — Tunisia varies)
- Field: "Pied de reçu" (textarea, optional, max 200 chars, French only): "Note imprimée en bas du reçu (politique de retour, remerciement, etc.)"

When the POS opens and `matriculeFiscal` is empty, show a yellow banner at the top of `/pos`: "Renseignez votre matricule fiscal dans les paramètres pour le faire apparaître sur les reçus." Dismissible; reappears every 7 days.

---

## 10. Seed updates

Extend `prisma/seed.ts` (preserve existing seeds):

- Add `matriculeFiscal: "1234567/A/M/000"` to provider1, leave provider2 empty (to test the banner)
- Add `receiptFooter: "Merci pour votre visite — à bientôt chez Salon Nour"` to provider1
- Create 6 products for provider1 across 2 categories (HAIRCARE, SKINCARE) with realistic SKUs/barcodes
- Create 3 products for provider2
- Create 2 sample completed sales for provider1, each with mixed services + products, paid by cash, with realistic timestamps in the past 7 days. One should have a tip; one should have a partial refund applied.
- Add 1 `StockMovement` rows referencing the seeded sales (PURCHASE for initial stock, SALE for the seeded sales)

---

## 11. CONTEXT.md update

Append a new section to `CONTEXT.md` (and update the "Routes overview" section to mention `/pos`):

````md
## Phase 2 additions (POS Core + offline)

- POS lives at `/pos` (separate top-level route, not under `/prestataire`). Full-screen layout.
- New models: `Product`, `StockMovement`, `Sale`, `SaleItem`, `Payment`, `TipAllocation`, `Refund`, `RefundItem`, `SaleSequence`.
- Receipt numbers `S-YYYYMMDD-NNNN` (daily counter per salon). Offline sales temp ID `OFF-<uuid>` swapped on sync.
- Prices stored TTC (Tunisian convention). HT/TVA derived for receipts.
- Per-line + sale-level discounts (percent or fixed). Per-line refunds. Split tender. Tips with per-employee allocation.
- Tier B PWA offline: cached catalog (offers + products + own-scope customers), IndexedDB sync queue for pending sales, Background Sync API where available, in-app polling fallback. Cash sales work offline; card and reservation creation are blocked offline.
- Offline indicator + sync queue badge in the POS top bar.
- Conflicts (deleted entities, price drift, stock negative) flagged on `Sale.syncConflicts` and surfaced at `/pos/sync-issues`.
- Provider profile gained `matriculeFiscal` and `receiptFooter` fields.

Helpers: `computeTotals()`, `nextReceiptNumber()`, `ttcToHt()`, `htToTtc()`, `taxFromTtc()`, `formatDT()`, `pos-offline-db` IndexedDB layer.
````

Also add to "Recurring gotchas":

- **Service worker caches POS shell aggressively**. After deploying changes to `/pos`, users may see stale UI for one session. The `skipWaiting/clientsClaim` config takes effect on next page load. For urgent fixes, bump a version constant in `sw.ts` to force cache invalidation.
- **Stock can go negative** when offline sales sync. This is intentional (Tier B graceful degradation). Resulting `StockMovement.requiresReview = true` — surface in admin tools when needed.

---

## What NOT to do

- ❌ Reservation/calendar mode in the POS center panel — Phase 3
- ❌ Analytics screen (revenue charts, employee leaderboards, hourly heatmap) — Phase 3
- ❌ Cash drawer sessions — Phase 3
- ❌ "Convert booking to sale" workflow — Phase 3 (the booking ↔ sale link is in the schema but the UI lands then)
- ❌ Reward program, wallets, transactions — Phase 4
- ❌ Loyalty payment method on `Payment.method` enum — Phase 4
- ❌ PDF receipt attachments — out of scope (HTML email only for v1)
- ❌ Real card-terminal integration — `CARD` is just a recorded method with optional reference; no PSP integration
- ❌ Any change to public-facing pages (homepage, salon listing, offer detail, booking flow)
- ❌ Any change to the influencer collaboration system or commissions
- ❌ Refactor of existing booking/offer/slot logic — only additive `Booking.sale` back-relation

If you find yourself touching anything in this list, stop and confirm.

---

## Verification checklist

1. `npx prisma migrate status` — clean
2. `npm run build` — succeeds (production build is required to test PWA — see point 7)
3. `npm run lint` — passes
4. `npx tsx prisma/seed.ts` — succeeds, including the seeded sales
5. Tests pass: `npx vitest run` (phone, money, sale-totals)
6. **Online happy path**:
   - Log in via PIN as Sarra → land on `/pos`
   - Search customer by phone → existing seeded customer appears with stats
   - Add 1 service + 2 products via barcode scanner (paste a barcode + Enter into the focused input simulates a scanner)
   - Apply 10% sale-level discount, add 5 DT tip
   - Encaisser → split tender 50 cash + 30 card → continue → tip auto-allocated to assigned stylists → receipt prints in browser preview
   - Sale appears in `/pos/sales` with correct totals; receipt number is `S-YYYYMMDD-0001` (or next in sequence)
7. **Offline happy path**:
   - In Chrome DevTools → Network → "Offline"
   - Top bar flips to amber "Hors ligne"
   - Search a previously-cached customer by phone → still works
   - Add cached product via barcode → still works
   - Card payment tile is disabled with hover hint
   - Cash payment → Encaisser → success → receipt prints, sale shows as queued in indicator ("Hors ligne — 1 vente en attente")
   - Toggle network back online → automatic sync toast → receipt number is replaced with the real one in the sales list
8. **Conflict path**:
   - Manually delete a product in DB while offline; sell that product offline (using cached snapshot); reconnect; sync
   - Sale completes; `/pos/sync-issues` shows the conflict
9. **Refund path**:
   - Open a past sale → Rembourser → select 1 of 2 lines → reason "Customer request" → cash refund → confirm
   - Original sale status flips to `PARTIALLY_REFUNDED`, refundedTotal updates, stock restored on the product line
10. **Permissions**:
    - Log out, log in as Mounir (CASHIER, no `pos.discount`) → discount inputs disabled with permission tooltip
    - Try POSTing a sale with discount via curl → 403
11. **Lighthouse PWA audit** still passes (no regressions from Phase 1)
12. **CONTEXT.md updated**

---

## Deliverables summary

**New files**

```
prisma/migrations/<timestamp>_phase2_pos_core/migration.sql

src/lib/money.ts                              + .test.ts
src/lib/sale-totals.ts                        + .test.ts
src/lib/receipt-number.ts
src/lib/pos-offline-db.ts

src/components/pos/online-status.tsx
src/components/pos/customer-panel.tsx
src/components/pos/cart-panel.tsx
src/components/pos/catalog-panel.tsx
src/components/pos/charge-modal.tsx
src/components/pos/receipt.tsx
src/components/pos/refund-modal.tsx
src/components/pos/barcode-input.tsx

src/app/(pos)/layout.tsx
src/app/(pos)/pos/page.tsx
src/app/(pos)/pos/sales/page.tsx
src/app/(pos)/pos/sales/[id]/page.tsx
src/app/(pos)/pos/sync-issues/page.tsx
src/app/(pos)/pos/products/page.tsx
src/app/(pos)/pos/products/new/page.tsx
src/app/(pos)/pos/products/[id]/edit/page.tsx

src/app/api/pos/sales/route.ts
src/app/api/pos/sales/[id]/route.ts
src/app/api/pos/sales/[id]/refunds/route.ts
src/app/api/pos/sales/[id]/email/route.ts
src/app/api/pos/sales/sync/route.ts
src/app/api/pos/products/route.ts
src/app/api/pos/products/[id]/route.ts
src/app/api/pos/products/[id]/stock/route.ts
src/app/api/pos/products/lookup/route.ts
src/app/api/pos/catalog/route.ts
src/app/api/health/route.ts
```

**Updated files**

```
prisma/schema.prisma         (new models + ProviderProfile fiscal fields)
prisma/seed.ts               (products, sales, fiscal info)
src/app/sw.ts                (runtime caching strategies)
src/app/(dashboard)/layout.tsx                      (Caisse link → /pos)
src/app/salon-pin/page.tsx + supporting client      (redirect → /pos)
src/app/(dashboard)/prestataire/profil/...          (matricule fiscal + footer)
src/lib/mail.ts              (sendReceiptEmail)
CONTEXT.md
package.json                 (idb dep)
scripts/deploy/README.md     (PWA cache busting note)
```

**Removed files**

```
src/app/(dashboard)/prestataire/pos/page.tsx   (Phase 1 placeholder, now at /pos)
```

---

## PR description template

Title: **Phase 2 — POS Core + Tier B Offline**

Body:
```
## What
- New POS at /pos with full-screen layout (no dashboard sidebar)
- Sale, SaleItem, Payment, TipAllocation, Refund, RefundItem, Product, StockMovement, SaleSequence models
- Three-panel UI: Customer | Cart | Catalog (services + products + barcode scanner)
- Charge modal: split tender, tips with per-employee allocation
- Per-line refunds with optional restock
- Receipt: thermal print + email
- Tier B offline: catalog cache, IndexedDB pending-sales queue, Background Sync, conflict resolution
- Provider profile gains matricule fiscal + receipt footer

## Migration
1. `prisma migrate deploy` (auto via deploy.sh)
2. No additional one-time scripts required

## Verification
[paste screenshots: POS three-panel, charge modal, offline indicator, receipt preview, /pos/sales, refund flow, /pos/sync-issues, Lighthouse PWA score]

## Out of scope (next phases)
- Phase 3: POS reservation calendar, analytics, cash drawer
- Phase 4: Rewards module, loyalty redemption at POS
```
