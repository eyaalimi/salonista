# Employee Commissions — Design Spec

**Date:** 2026-08-10
**Status:** Approved for implementation
**Owner:** eya alimi

## Goal

Enable salon owners to track and pay commissions to service providers (stylists, estheticians) directly from the POS. Each service sold, when attributed to an employee with a commission rate, generates a commission line that the owner can review by period and mark as paid.

## Non-goals

- Automatic salary/wage tracking (this is commission on top of, or in place of, wages — Salonista does not manage payroll)
- Bank transfer integration (payment is marked manually; cash payments can optionally create a `CashDrawerExpense`)
- Product commissions (excluded by design — services only)
- Per-service overrides of the employee rate (a single rate per employee)
- Retroactive commissions on past sales when a rate is added later (only new sales generate commissions)

## User story

> "As a salon owner, at the end of every month I want to know exactly how much I owe each of my stylists. I want to see the detail of the services they performed, confirm the total, mark it as paid, and optionally record it as a cash drawer expense — all without leaving the POS."

## Data model

### Change 1 — Add rate to `SalonEmployee`

```prisma
model SalonEmployee {
  // ... existing fields
  commissionRate  Decimal? @db.Decimal(5, 2)  // e.g. 30.00 = 30%
}
```

- `null` = no commissions generated for this employee (default for existing rows)
- Non-null > 0 = generates a commission per assigned service
- Editable from `/pos/employees` and in wizard Step 5

### Change 2 — New model `EmployeeCommission`

```prisma
model EmployeeCommission {
  id                String   @id @default(cuid())
  saleItemId        String   @unique
  employeeId        String
  providerId        String

  rateSnapshot      Decimal  @db.Decimal(5, 2)   // frozen at sale time
  baseAmountHT      Decimal  @db.Decimal(10, 3)  // HT after line discount
  commissionAmount  Decimal  @db.Decimal(10, 3)  // rateSnapshot × baseAmountHT / 100

  status            CommissionStatus @default(PENDING)
  paidAt            DateTime?
  paidBatchId       String?  // groups commissions paid in the same batch

  createdAt         DateTime @default(now())

  saleItem   SaleItem        @relation(fields: [saleItemId], references: [id], onDelete: Cascade)
  employee   SalonEmployee   @relation(fields: [employeeId], references: [id])
  provider   ProviderProfile @relation(fields: [providerId], references: [id], onDelete: Cascade)

  @@index([providerId, employeeId, status])
  @@index([providerId, status, createdAt])
  @@index([paidBatchId])
}
```

Notes:
- The existing enum `CommissionStatus` (currently `PENDING | PAID`) is reused. Add a `CANCELLED` value in the same migration to handle refunds.
- `rateSnapshot` freezes the rate at sale time so future rate changes never rewrite history.
- `paidBatchId` (nullable) is set when the owner marks a batch as paid, groups all commissions marked together.

## Generation logic

**Location:** `src/lib/pos-sale-create.ts`, inside the existing Prisma transaction that creates the sale, right after `SaleItem` rows are inserted.

**Pseudocode:**

```typescript
for (const item of createdSaleItems) {
  if (item.kind !== "SERVICE") continue;
  if (!item.assignedEmployeeId) continue;

  const employee = employeesById.get(item.assignedEmployeeId);
  if (!employee?.commissionRate) continue;
  if (Number(employee.commissionRate) <= 0) continue;

  const lineNetTTC = Decimal(item.lineSubtotal).minus(item.lineDiscount ?? 0);
  const taxRate = Decimal(item.taxRateSnapshot);
  const lineNetHT = lineNetTTC.div(Decimal(1).plus(taxRate.div(100)));
  const commissionAmount = lineNetHT
    .mul(employee.commissionRate)
    .div(100)
    .toDecimalPlaces(3);

  await tx.employeeCommission.create({
    data: {
      saleItemId: item.id,
      employeeId: employee.id,
      providerId,
      rateSnapshot: employee.commissionRate,
      baseAmountHT: lineNetHT.toDecimalPlaces(3),
      commissionAmount,
      status: "PENDING",
    },
  });
}
```

**Edge cases:**
- No employee assigned → skipped silently (not an error)
- Employee has `commissionRate = null` or `0` → skipped
- Product line → skipped (kind !== SERVICE guard)
- Line discount > line subtotal → base clamped to 0 (defensive)

**Refund handling:** in `src/app/api/pos/refunds/route.ts` (or equivalent), when a refund fully cancels a `SaleItem`, update the linked `EmployeeCommission` (found via `saleItemId`) to `status = CANCELLED`. Partial refunds do not adjust the commission for launch (v2 concern).

## API surface

Three new endpoints, all under `/api/pos/commissions/`.

### `GET /api/pos/commissions?from=&to=&status=&employeeId=`

Returns aggregated data for the report page.

**Query params:**
- `from`, `to` (ISO date, defaults: last month full range)
- `status`: `PENDING` | `PAID` | `ALL` (default `PENDING`)
- `employeeId` (optional filter)

**Response:**
```json
{
  "period": { "from": "2026-07-01T00:00:00Z", "to": "2026-07-31T23:59:59Z" },
  "totals": { "count": 20, "baseHT": "1470.000", "commission": "410.000" },
  "byEmployee": [
    {
      "employeeId": "cl…",
      "displayName": "Yasmine",
      "role": "STYLIST",
      "commissionRate": "30.00",
      "servicesCount": 12,
      "baseHT": "850.000",
      "commission": "255.000"
    },
    { "employeeId": "cl…", "displayName": "Fadwa", …}
  ]
}
```

### `GET /api/pos/commissions/[employeeId]?from=&to=&status=`

Returns line-by-line detail for the modal.

**Response:**
```json
{
  "employee": { "id": "cl…", "displayName": "Yasmine", "commissionRate": "30.00" },
  "period": { … },
  "lines": [
    {
      "id": "cl…",
      "saleClosedAt": "2026-07-25T10:30:00Z",
      "receiptNumber": "S-20260725-0012",
      "serviceName": "Coupe femme",
      "baseHT": "29.412",
      "rateSnapshot": "30.00",
      "commissionAmount": "8.824",
      "status": "PENDING"
    },
    …
  ],
  "totals": { "count": 12, "baseHT": "850.000", "commission": "255.000" }
}
```

### `POST /api/pos/commissions/pay`

Marks a set of commissions as paid.

**Body:**
```json
{
  "employeeId": "cl…",
  "from": "2026-07-01T00:00:00Z",
  "to": "2026-07-31T23:59:59Z",
  "createCashExpense": true   // optional
}
```

**Server-side transaction:**
1. Find all `EmployeeCommission` rows matching `providerId + employeeId + status=PENDING + createdAt in [from, to]`
2. Generate a `paidBatchId` (cuid)
3. Update all matched rows: `status = PAID`, `paidAt = now()`, `paidBatchId = <id>`
4. If `createCashExpense === true` AND an OPEN cash drawer session exists for the provider:
   - Create a `CashDrawerExpense` with `category = AVANCE_SALAIRE`, `amount = sum`, `reason = "Commission [Employee name] — [period]"`
5. Return `{ paidBatchId, count, total }`

**Permission:** requires `commissions.pay`.

## Permissions

Two new entries in `src/lib/permissions.ts`:

```typescript
"commissions.view",  // access the /pos/commissions page and read APIs
"commissions.pay",   // mark commissions as paid
```

**Role defaults:**
- `OWNER`: both true
- `MANAGER`: `commissions.view` true, `commissions.pay` false
- `CASHIER`, `STYLIST`: both false

## UI

### 1. Rail entry

Add "Commissions" between "Fidélité" and "Équipe" in the rail (`src/components/pos/rail.tsx`). Icon: `Coins` or `Wallet` from lucide. Only visible if `permissions["commissions.view"]`.

### 2. Page `/pos/commissions`

Server component + client component split (same pattern as other POS pages).

**Layout:**
- Header: title "Commissions" + subtitle "Rémunération de l'équipe"
- Filter bar: period selector (Mois dernier default, Ce mois, 30 jours, Personnalisé) + status pills (À payer / Payées / Toutes)
- Grid of employee cards (see design section 3 mockup above)
- Global footer: total to pay + big button "Marquer tout comme payé"
- Top-right button "Exporter PDF" → opens `/pos/commissions/pdf?from=&to=&status=` (same pattern as cash-drawer rapport-pdf, with sticky toolbar)

**Empty state** (no commissions in period): centered card with `Coins` icon + text "Aucune commission sur cette période."

### 3. Modal "Voir détail"

Slide-in drawer (right side, 480px wide, same pattern as customer-detail-drawer):
- Header: employee avatar + name + rate
- Period summary
- Table of lines (Date/Heure, Reçu, Service, HT, Taux, Commission)
- Footer with totals
- Button "Marquer payé" if `status=PENDING`

### 4. "Mark as paid" modal

Simple centered modal:
- Recap: "Payer **255,000 DT** à **Yasmine** pour **12 services** ?"
- Checkbox: "Enregistrer comme dépense caisse (AVANCE_SALAIRE)" — auto-checked if a drawer session is open
- Buttons: Annuler / Confirmer
- On success: green toast "Commission marquée comme payée", refetch data

### 5. Wizard onboarding — Step 5

Extend `src/components/pos/onboarding/step5-team.tsx`:
- Add commission input only when role is `STYLIST`
- Style: compact inline field "💰 Commission [30] %" with helper text
- Payload includes `commissionRate` sent to `/api/pos/onboarding` `step5.employees[].commissionRate`
- API route `src/app/api/pos/onboarding/route.ts` writes to `SalonEmployee.commissionRate`

### 6. Employees list `/pos/employees`

- New table column "Commission" (right-aligned, `pos-mono`) — shows `30%` or `—`
- Edit modal: add commission field (visible for all non-OWNER roles, hidden for OWNER)

## PDF export

`/pos/commissions/pdf?from=&to=&status=` renders an A4 HTML page identical in style to `cash-drawer-detail-report.ts`:
- Salon header with logo + name
- Period + total
- Per-employee section: rate + count + total + line table
- Sticky toolbar with "Fermer" and "Imprimer" buttons (screen only)

## Error handling

| Scenario | Behavior |
|---|---|
| Concurrent "mark as paid" clicks | DB constraint on `paidBatchId` + optimistic status check `WHERE status=PENDING` |
| Rate deleted between sale and payment | Uses `rateSnapshot`, no re-compute |
| Employee deleted | The `SalonEmployee → EmployeeCommission` relation uses `onDelete: Restrict` (Prisma default). An employee with any commission history cannot be hard-deleted; the UI already offers a soft-delete via `active = false`, which is the intended path. |
| Refund of a partially-paid batch | Not supported in v1 — refund of a paid commission is a manual accounting event (owner deducts from next batch) |

## Migration

New Prisma migration adds:
1. `SalonEmployee.commissionRate Decimal? @db.Decimal(5, 2)`
2. `EmployeeCommission` table
3. `CommissionStatus` enum value `CANCELLED`

Backfill: **none**. All existing employees stay at `commissionRate = NULL`. Past sales are not retroactively commissioned. The owner must add rates on employees they want commissioned; new sales from that point forward will generate commissions.

## Testing plan

Manual QA scenarios:
1. **Basic flow**: OWNER sets Yasmine's rate to 30%, sells a Coupe (100 DT TTC, 19% TVA) assigned to Yasmine → check `EmployeeCommission` row created with correct amount (`100 / 1.19 × 30% = 25.210 DT`)
2. **No employee assigned** → no commission created
3. **Product line with employee** → no commission created
4. **Rate change** after sale → old commission keeps old rate
5. **Full refund** → commission status = CANCELLED
6. **Mark as paid** with cash drawer open + checkbox on → `CashDrawerExpense` created with correct amount and category
7. **Report period filter**: create sales in two different months, filter to "Mois dernier" → only that month's commissions appear
8. **Permission**: STYLIST or CASHIER tries to open `/pos/commissions` → redirected to `/pos`
9. **PDF export**: opens A4, prints correctly, "Fermer" works
10. **Zero rate** (0.00) → treated as no commission (skipped)

## Rollout

Since no existing data is affected (backfill is a no-op), this can be deployed to prod in a single push. Owners will discover the feature when they see the new "Commissions" entry in the rail; they need to explicitly set rates on employees for anything to happen — no surprises.

## Open questions (deferred to v2)

- Partial refund commission adjustment
- Historical rate changes with retroactive re-computation
- Team-level commission (splits between 2 employees on the same service)
- Automatic monthly PDF email to the owner
- Employee-side view (each employee sees their own commissions on their profile — requires auth expansion)
