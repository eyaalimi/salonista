# Salonista — Phase 3: POS Reservations, Cash Drawer & Analytics

> **Prerequisites**: Phases 1 and 2 must be merged. Read `CONTEXT.md` (including Phase 1 and Phase 2 additions) and `AGENTS.md`. POS lives at `/pos` with full-screen layout, three-panel UI, offline-capable for cash sales. Schema includes `Sale`, `SaleItem`, `Payment`, `TipAllocation`, `Refund`, `Product`, `StockMovement`. The center panel currently shows only the cart — Phase 3 adds calendar mode.

## Mission

Make the POS a complete daily workhorse:

1. **Reservation calendar** in the POS center panel — toggle between Cart mode and Calendar mode
2. **Walk-in handling** — phantom `Booking` records keep the calendar and analytics honest
3. **Convert booking to sale** — customer arrives, cashier prefills the cart from the booking
4. **Manual booking management** from inside the POS (create / edit / move / cancel)
5. **Cash drawer sessions** — open with float, close with count, variance reporting
6. **Analytics screen** — KPIs, top services/products, employee revenue, hourly heatmap, low stock

What's still deferred: Rewards module (Phase 4), employee commission calculations, fiscal/tax exports, real PSP integration.

---

## Stack patterns to honor

(Recap from earlier phases.)

- Prisma client: `import { PrismaClient } from "@/generated/prisma/client"`; helper at `@/lib/prisma`. Money columns `Decimal(10, 3)`.
- Multi-step writes inside `prisma.$transaction([...])`.
- Local `prisma generate` is broken — use `as never` casts when fields aren't reflected.
- Pages with `useSearchParams()` need `<Suspense>`.
- Brand tokens: `brand-ink`, `brand-ink-soft`, `brand-cream`, `brand-sand`, `brand-gold`, `brand-gold-soft`, `brand-line`. Headings via `.luxury-heading`.
- All user-facing strings in **French**.
- Existing helpers ready: `requireEmployee()`, `requirePermission()`, `requireModule("POS")`, `hasModule()`, `<ModuleGate>`, `normalizePhone()`, `computeTotals()`, `nextReceiptNumber()`, `ttcToHt()`, `htToTtc()`, `formatDT()`, `pos-offline-db` IndexedDB layer.
- Existing booking infrastructure: `regenerateOfferSlots()`, `regenerateAllProviderSlots()`, `<MultiServiceCalendar>`. Atomic multi-slot booking precedent in `/api/bookings`.

---

## 1. Prisma schema additions

### New enum

```prisma
enum CashDrawerStatus {
  OPEN
  CLOSED
  RECONCILED
}
```

### New model

```prisma
model CashDrawerSession {
  id            String           @id @default(cuid())
  providerId    String
  employeeId    String
  status        CashDrawerStatus @default(OPEN)

  openedAt      DateTime         @default(now())
  closedAt      DateTime?
  reconciledAt  DateTime?

  // Money — all in DT, Decimal(10, 3)
  openingFloat  Decimal          @db.Decimal(10, 3)
  closingCount  Decimal?         @db.Decimal(10, 3)
  expectedCash  Decimal?         @db.Decimal(10, 3)   // computed at close: openingFloat + cash payments during session
  variance      Decimal?         @db.Decimal(10, 3)   // closingCount - expectedCash (negative = short, positive = over)

  openingNotes  String?
  closingNotes  String?

  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt

  provider  ProviderProfile @relation(fields: [providerId], references: [id], onDelete: Cascade)
  employee  SalonEmployee   @relation("CashDrawerEmployee", fields: [employeeId], references: [id])
  payments  Payment[]

  @@index([providerId, status])
  @@index([employeeId, status])
  @@index([openedAt])
}
```

### Modifications to existing models

- `Payment`: add `cashDrawerSessionId String?` and the relation `cashDrawerSession CashDrawerSession? @relation(fields: [cashDrawerSessionId], references: [id], onDelete: SetNull)`. Add index `@@index([cashDrawerSessionId])`.
- `SalonEmployee`: add back-relation `cashDrawerSessions CashDrawerSession[] @relation("CashDrawerEmployee")`.
- `ProviderProfile`: add back-relation `cashDrawerSessions CashDrawerSession[]`.

### Migration

```bash
npx prisma migrate dev --name phase3_pos_reservations_drawer_analytics
```

No backfill required — existing payments stay with `cashDrawerSessionId: null` (treated as "unsessioned" by reports).

---

## 2. POS calendar — center panel mode toggle

### Mode toggle

The center panel of `/pos` now has two modes, switchable via a segmented control at the top:

```
┌────────────────────────────┐
│ [ Panier ] [ Calendrier ]  │
└────────────────────────────┘
```

- **Panier** (Cart) — existing UI from Phase 2, default
- **Calendrier** (Calendar) — the new view

State is per-tab session (not persisted across reloads). Switching modes does **not** clear an in-progress cart — the cart panel stays loaded and the user can flip back without losing work.

### Component decision

Look at `src/components/multi-service-calendar.tsx` first. Decide:
- If it can be extended with a `mode: "client-booking" | "pos"` prop without bloating the public booking flow → extend it.
- Otherwise (more likely given the divergent requirements) → build a new dedicated `src/components/pos/pos-calendar.tsx`.

Document the decision in a top-of-file comment.

### POS calendar requirements

- **Views**: Day (default) and Week. Toggle in the top-right of the panel.
- **Day view**: vertical timeline 8:00–22:00 (configurable from `ProviderProfile.openingHours`), 30-minute rows, columns per assigned employee (default to a single column if no per-employee assignment is in use).
- **Week view**: 7 columns Mon–Sun, simpler density, single column per day.
- **Bookings displayed** as colored blocks:
  - Confirmed online booking (paid) → solid `brand-gold` block
  - POS-created booking → solid `brand-ink-soft` block
  - Walk-in (phantom booking) → dashed `brand-gold-soft` border, no fill
  - Cancelled → muted gray with strikethrough
  - Block content: customer name (or "Sans client"), service name, time range
- **Empty slot click** (drag-select a range, or single click for default-duration) → opens "Nouvelle réservation" drawer
- **Booking click** → opens "Détails réservation" drawer with actions: Modifier, Déplacer, Annuler, Encaisser (gated by `pos.sell`)
- **Today indicator**: a thin gold line across the current time
- **Refresh**: auto-refresh every 60 seconds when the panel is in calendar mode and the tab is visible (use `IntersectionObserver` + `document.visibilityState`)
- **Keyboard navigation**: arrow keys move between days (day view) or weeks (week view); `T` jumps to today

### "Nouvelle réservation" drawer

Slides in from the right of the calendar panel.

Fields:
- **Date + heure** (prefilled from clicked slot)
- **Client** — search by phone (autocomplete from cached own-scope customers); options "Sans client" (walk-in), "Nouveau client" (opens customer create modal)
- **Services** — multi-select from offers, computes total duration. Shows running duration ("1h 15min").
- **Employé assigné** — optional dropdown of active SalonEmployees; defaults to current employee if creating a same-day booking. Per-service assignment hidden for v1; one employee per booking.
- **Notes** — free text

Validation:
- Time slot + duration must fit within `openingHours` for that day
- No conflicting bookings for the assigned employee in the same window (warning, not hard block, since salons sometimes double-book intentionally — show "Cet employé a déjà 2 RDV à cette heure. Continuer ?")

On submit:
- POST `/api/pos/bookings` (new endpoint, see §4)
- `Booking.createdViaPos: true`
- `Booking.walkIn: false` for scheduled, `true` if user explicitly checks "Walk-in" toggle
- Calendar refreshes
- Drawer closes

### "Détails réservation" drawer

Shows the booking with all metadata.

Actions:
- **Modifier** — opens an edit form (same fields as create, plus ability to change services, time, employee). Validates the same way.
- **Déplacer** — quick action: pick new datetime, keep everything else.
- **Annuler** — confirm dialog → POST `/api/pos/bookings/[id]/cancel`. Booking status → `CANCELLED`. Slot becomes free again.
- **Encaisser** — see "Convert booking to sale" below.

Footer shows: "Créée par [name] le [date]", "Statut: Confirmée / Encaissée / Annulée", and if there's an associated `Sale`, link to `/pos/sales/[saleId]`.

### Convert booking to sale

When the cashier taps "Encaisser":

1. Switch the center panel to Cart mode
2. Prefill the cart with the booking's services (snapshot prices from offer at time of booking, with line `assignedEmployeeId` from the booking)
3. Set the customer panel to the booking's customer (or "Sans client" if walk-in)
4. Show a small banner above the cart: "Encaissement de la réservation #BK-XYZ — [customer] — [time]"
5. The cashier can add products, apply discounts, etc., then proceeds normally to charge
6. On charge success:
   - `Sale.bookingId` set to the booking ID (already in Phase 2 schema)
   - `Booking.status` → `COMPLETED` (or whatever the existing booking-completion enum value is)
   - Calendar block visually updates to "encaissée" state on next refresh

If the cashier abandons the conversion (clicks back, switches customer, etc.), revert to the original cart state — don't strand the booking in a half-converted state.

### Walk-in flow

Two paths into a walk-in:

**Path A — Direct sale (existing Phase 2 flow):**
The cashier rings up a sale without a booking. Phase 3 change: when the sale is created via `POST /api/pos/sales`, if there's no `bookingId`, the server **automatically creates a phantom `Booking`** with:
- `walkIn: true`
- `createdViaPos: true`
- `customerId` from the sale
- `assignedEmployeeId` from the sale's most-common line assignment (or null)
- `status: COMPLETED`
- `startTime: sale.createdAt`, `endTime: sale.createdAt + sumOfServiceDurations` (or 30 min default if no services)
- `totalPrice: sale.total`
- No `BookingItem`/`TimeSlot` rows — phantom bookings don't reserve slots
- New field: `Booking.phantom: Boolean @default(false)` — set to `true` for these auto-created records (add to schema in this phase)

The phantom booking's `Sale.bookingId` is set to it, completing the loop.

**Path B — Calendar walk-in:**
From the calendar's "Nouvelle réservation" drawer, a "Walk-in" toggle creates a `Booking` with `walkIn: true, phantom: false`. This is for cases where the cashier wants to register a client physically present *before* charging (e.g., "fits between two bookings, log it now, charge later").

### Schema delta from this section

Add to `Booking`:
```prisma
phantom Boolean @default(false)
```

Add a separate small migration if you prefer atomicity (recommended): `phase3a_phantom_bookings` first, then `phase3b_cash_drawer`. Or combine into one — your call. Document the choice.

---

## 3. Cash drawer sessions

### Open drawer

Top-right of the POS top bar: a small drawer icon. States:
- No open session for current employee → icon shows a red dot with "Ouvrir caisse"
- Open session → icon shows a green dot with running expected cash
- Click → opens a drawer panel

**Open modal** asks:
- Starting float (DT), default 0
- Notes (optional, e.g., "Fond de caisse fourni par Nour")

POST `/api/pos/cash-drawer/open` creates the session, sets `status: OPEN`, returns the session ID.

The session ID is held in the session/JWT payload **or** retrievable via a quick query each time a Payment is created. Simpler: query at payment time. Store nothing in the JWT.

Once open, every cash `Payment` created by this employee gets `cashDrawerSessionId` set automatically (server logic in `POST /api/pos/sales`).

### During shift

The drawer panel shows live:
- Opened at: HH:MM
- Opening float: X DT
- Cash sales so far: count + sum
- Cash refunds: count + sum (refunds with method CASH)
- Expected in drawer: float + cash sales − cash refunds
- "Fermer caisse" button at the bottom

This data is fetched on demand from `GET /api/pos/cash-drawer/[id]/summary`. Refresh every 60 seconds while the drawer panel is open.

### Close drawer

**Close modal** asks:
- Counted cash (DT)
- Notes (optional, mandatory if variance ≥ 5 DT in absolute value)

POST `/api/pos/cash-drawer/[id]/close`:
- Compute `expectedCash` from session + payments
- Compute `variance = closingCount - expectedCash`
- Set `status: CLOSED`, `closedAt: now()`, `closingCount`, `expectedCash`, `variance`
- Return summary for confirmation screen

Confirmation screen shows:
- Expected: X DT
- Counted: Y DT
- Variance: ±Z DT (color-coded: green if 0, amber if |variance| < 5, red if larger)
- "Imprimer le rapport" — print the close report (similar styling to a sale receipt)

### History

`/pos/cash-drawer` page (gated by `pos.cash_drawer`):

- Table of past sessions: date, employee, opening float, closing count, variance, status
- Filter by date range and employee
- Click a row → detail page `/pos/cash-drawer/[id]`:
  - Full breakdown
  - All linked payments with timestamps
  - "Marquer comme rapprochée" button (gated by OWNER/MANAGER) → sets `status: RECONCILED`. This is bookkeeping bookkeeping ("yes, I checked this against my bank deposit"), not data correction.

### Offline behavior

- **Open drawer** offline → blocked. Show toast "Connexion requise pour ouvrir la caisse."
- **Close drawer** offline → blocked. Same reason.
- Cash payments from offline sales: when synced, server looks up the cashier's open session at the sale's `createdAt`. If found → link. If no session was open at that time → leave `cashDrawerSessionId: null` and surface in `/pos/sync-issues` as a "Paiement sans session" line.

### Schema validation

Enforce in API:
- An employee can have at most **one** OPEN session at a time per provider. POST /open returns 409 if one exists.
- A session can only be closed by the employee who opened it (OWNER/MANAGER override allowed).

---

## 4. API routes (additions)

All under `/api/pos/*`, all require `requireEmployee()` + `requireModule("POS")`.

### Bookings (POS-specific)

```
GET    /api/pos/bookings?from=ISO&to=ISO[&employeeId=]    → list bookings in range, scoped to provider
POST   /api/pos/bookings                                   → create (POS path: createdViaPos: true)
GET    /api/pos/bookings/[id]                              → detail
PUT    /api/pos/bookings/[id]                              → update services/time/employee/notes
POST   /api/pos/bookings/[id]/cancel                       → cancel
POST   /api/pos/bookings/[id]/move                         → quick reschedule { newStartTime: ISO }
```

Why a separate namespace from the existing `/api/bookings`?
- POS bookings bypass payment requirements
- POS bookings can be walk-ins (no slot reservation)
- POS bookings need permissions checks via `bookings.create` / `bookings.edit` / `bookings.cancel`
- Existing endpoint serves the public booking flow with different validation rules

Reuse internal helpers (`regenerateOfferSlots`, slot allocation) — don't duplicate the slot logic.

### Phase 2 sales endpoint update

Update `POST /api/pos/sales` (Phase 2):

1. After successful sale creation, if `bookingId` is null, create the phantom `Booking` as described in §2 ("Walk-in flow Path A").
2. Compute the booking's `endTime` from sum of service durations (default 30 min if no services).
3. Set `Sale.bookingId` to the phantom booking's id.

If the sale already has a `bookingId` (booking-to-sale conversion path), update that booking's status to COMPLETED instead.

### Cash drawer

```
GET    /api/pos/cash-drawer/current             → current employee's open session, or null
POST   /api/pos/cash-drawer/open                 → { openingFloat, openingNotes }
GET    /api/pos/cash-drawer/[id]                 → detail
GET    /api/pos/cash-drawer/[id]/summary         → live computed expected cash + payment count
POST   /api/pos/cash-drawer/[id]/close           → { closingCount, closingNotes }
POST   /api/pos/cash-drawer/[id]/reconcile       → mark RECONCILED (OWNER/MANAGER only)
GET    /api/pos/cash-drawer                      → list, filterable by date range + employee
```

### Analytics

```
GET    /api/pos/analytics/summary?from=&to=     → KPI tiles
GET    /api/pos/analytics/revenue?from=&to=&granularity=day|hour
GET    /api/pos/analytics/top-services?from=&to=&limit=10
GET    /api/pos/analytics/top-products?from=&to=&limit=10
GET    /api/pos/analytics/by-employee?from=&to=
GET    /api/pos/analytics/heatmap?from=&to=     → 7×24 grid of transaction counts
GET    /api/pos/analytics/low-stock              → products at or below threshold
GET    /api/pos/analytics/export.csv?from=&to=&type=sales|refunds|drawer  → CSV download
```

All analytics endpoints require `analytics.view` permission. Date ranges default to "today" if missing.

---

## 5. Analytics screen — `/pos/analytics`

### Layout

Single page, gated by `requirePermission("analytics.view")`. Top bar reuses the POS layout (employee + offline indicator). Main content:

```
┌──────────────────────────────────────────────────────────┐
│  Date range picker     [Aujourd'hui ▾]   [Exporter CSV]  │
├──────────────────────────────────────────────────────────┤
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐         │
│  │ Revenu │  │ Ventes │  │ Ticket │  │ Nouveaux│         │
│  │  net   │  │ payées │  │ moyen  │  │ clients │         │
│  │ 4.250  │  │   38   │  │ 111,8  │  │   5    │         │
│  │   DT   │  │        │  │   DT   │  │        │         │
│  └────────┘  └────────┘  └────────┘  └────────┘         │
├──────────────────────────────────────────────────────────┤
│  Revenu par jour (line chart)                            │
├──────────────────────────────────────────────────────────┤
│  Top services        │  Top produits                     │
│  (horizontal bars)   │  (horizontal bars)                │
├──────────────────────┴──────────────────────────────────┤
│  Heures d'affluence (heatmap 7 days × 24 hours)          │
├──────────────────────────────────────────────────────────┤
│  Revenu par employé  │  Stock faible                     │
│  (table)             │  (table with restock CTA)         │
└──────────────────────────────────────────────────────────┘
```

### Date range picker

Presets: "Aujourd'hui", "Hier", "7 derniers jours", "30 derniers jours", "Ce mois", "Mois dernier", "Personnalisé".

Custom uses two date inputs side by side. URL state is reflected in `?from=&to=` so the view is shareable/bookmarkable.

### KPI tile definitions (lock these)

- **Revenu net** = sum of `Sale.total` for sales with `status IN (PAID, PARTIALLY_REFUNDED, REFUNDED)` in date range, **minus** sum of `Refund.totalAmount` in same range. (Net cash actually retained.)
- **Ventes payées** = count of `Sale` records with `status IN (PAID, PARTIALLY_REFUNDED, REFUNDED)` and `closedAt` in range.
- **Ticket moyen** = revenu net ÷ ventes payées (handle divide-by-zero → display "—").
- **Nouveaux clients** = count of distinct `Customer` rows with `firstSalonId === providerId` AND `createdAt` in range.

Each tile shows the value, the previous-period comparison ("+12% vs période précédente"), and a tiny trend sparkline.

Previous period = same length, immediately before. E.g., if range is "Last 7 days", previous = the 7 days before that.

### Charts

Use **Recharts** (already common in React; install if not present):

```bash
npm install recharts
```

- **Revenue line chart**: x = day (or hour if range is "today"), y = net revenue. Dual y-axis with transactions count as a faint secondary line.
- **Top services / Top products**: horizontal bar chart, top 10. Bar value = revenue (gross). Tooltip shows quantity + avg price.
- **Heatmap**: 7×24 grid (rows = day of week, columns = hour). Cell color intensity reflects transaction count. Tooltip on hover shows exact count + revenue.
- **By employee**: simple table. Columns: Employé, Ventes, Revenu, Pourboires reçus, Articles vendus.

Empty states: "Aucune donnée pour cette période. Sélectionnez une plage différente."

### Low stock list

Table of products where `stockQuantity <= lowStockThreshold` AND `active = true`:
- Photo, name, SKU, current stock, threshold, last sold date
- Per-row "Réapprovisionner" CTA → opens stock-adjustment modal (existing from Phase 2)

### CSV export

Three exportable types: `sales` (one row per sale + flattened key fields), `refunds`, `drawer` (sessions + variance). UTF-8, comma-separated, French headers, `,` decimal separator (not `.`) to match Tunisian Excel defaults.

Filename: `salonista-{type}-{from}_{to}.csv`.

### Performance considerations

For the date ranges most owners will use (a day, a week, a month), a single salon's volume is small — no need for aggregation tables yet. Keep it as live aggregate queries against `Sale` / `SaleItem` / `Payment`. Add these indexes if not already present:

```prisma
// On Sale
@@index([providerId, status, closedAt])

// On SaleItem
@@index([saleId, kind])

// On Payment
@@index([cashDrawerSessionId])  // already added in §1
```

Document a TODO at the top of each analytics route handler: "If query latency >500ms in production, materialize a daily aggregates table."

---

## 6. Sidebar navigation updates

Update the POS layout's nav (`src/app/(pos)/layout.tsx`):

The POS top bar should expose, from a hamburger menu (or persistent left rail on wide screens):

- **Caisse** — `/pos` (the main POS screen)
- **Ventes** — `/pos/sales` (Phase 2)
- **Produits** — `/pos/products` (Phase 2, gated by `inventory.view`)
- **Caisse (rapports)** — `/pos/cash-drawer` (gated by `pos.cash_drawer`)
- **Analytique** — `/pos/analytics` (gated by `analytics.view`)
- **Conflits de sync** — `/pos/sync-issues` (gated by `pos.refund`)

Each nav item is a small card with an icon. Hidden if the employee lacks the gating permission.

---

## 7. Walk-in fix-up backfill (one-shot)

To make analytics retroactive, run a one-time backfill that creates phantom bookings for any Phase 2 `Sale` rows that don't already have a `bookingId`.

`prisma/backfill-phase3.ts`:

- For each `Sale` where `bookingId IS NULL` and `status IN (PAID, PARTIALLY_REFUNDED, REFUNDED)`:
  - Create a `Booking` with `phantom: true, walkIn: true, createdViaPos: true, status: COMPLETED, startTime: sale.createdAt`, etc.
  - Update `sale.bookingId` to point to it
- Idempotent (re-runs are no-ops)
- Document in `scripts/deploy/README.md`

---

## 8. Seed updates

Extend `prisma/seed.ts`:

- For provider1, seed:
  - 8 future `Booking` rows (mix of online + POS-created) spread across the next 7 days
  - 3 walk-in `Booking` rows from yesterday (with corresponding completed sales)
  - 1 closed `CashDrawerSession` from yesterday with realistic variance (e.g., -2.500 DT short)
  - 1 currently-open `CashDrawerSession` for Sarra (cashier)
- For provider2, seed:
  - 4 future bookings
  - 1 closed session with zero variance

Update the seed credentials block at the top of `seed.ts` to include cashier session info.

---

## 9. CONTEXT.md update

Append:

````md
## Phase 3 additions (POS reservations, cash drawer, analytics)

- POS calendar: center panel toggles between Cart and Calendrier modes. Dedicated `<PosCalendar>` component (or extension of `<MultiServiceCalendar>` if practical).
- Walk-ins create phantom `Booking` rows (`Booking.phantom: true`) automatically on any sale without a bookingId. Keeps calendar + analytics consistent.
- Booking ↔ Sale link is now bidirectional and used by the "Encaisser" workflow.
- POS-specific booking endpoints under `/api/pos/bookings/*` to bypass payment-flow requirements of the public `/api/bookings`.
- New model: `CashDrawerSession`. Payments link via `Payment.cashDrawerSessionId`. Sessions are informational; an open session per employee at a time. Variance = counted − expected.
- Analytics page `/pos/analytics` with KPIs, revenue chart, top services/products, hourly heatmap, low-stock list, CSV export. Recharts is the charting library.
- Backfill `prisma/backfill-phase3.ts` creates phantom bookings for Phase 2 sales that pre-date this phase.

KPI definitions (locked):
- Revenu net = sum(Sale.total of paid sales) − sum(Refund.totalAmount) in range
- Ventes payées = count of sales with status PAID/PARTIALLY_REFUNDED/REFUNDED, closedAt in range
- Ticket moyen = revenu net / ventes payées
- Nouveaux clients = count of customers with firstSalonId = providerId AND createdAt in range
````

Add to "Recurring gotchas":
- **Phantom bookings**: every paid POS sale auto-creates a `Booking` if none exists. Filter `Booking.phantom = false` when displaying public-facing booking lists; include phantoms in analytics and the POS calendar.

---

## What NOT to do

- ❌ Reward program, wallets, redemption — Phase 4
- ❌ Per-service employee assignment within a single booking (one-employee-per-booking is fine for v1)
- ❌ Drag-to-reschedule on the calendar (use the "Déplacer" button instead) — could be a Phase 4 polish
- ❌ Profit margin / cost analysis on analytics screen (we'd need richer cost tracking)
- ❌ Employee commission calculations (post-MVP, possibly Phase 5+)
- ❌ Real-time analytics (polling every 60s on the dashboard is fine; no WebSockets)
- ❌ Materialized aggregate tables for analytics (only if production latency demands it)
- ❌ Tax / fiscal exports beyond the basic CSVs (separate phase if needed)
- ❌ Any change to public-facing booking flow, offer pages, or homepage
- ❌ Any change to influencer / commission / tracking systems

If you find yourself touching anything in this list, stop and confirm.

---

## Verification checklist

1. `npx prisma migrate status` — clean
2. `npm run build` — succeeds
3. `npm run lint` — passes
4. `npx tsx prisma/seed.ts` then `npx tsx prisma/backfill-phase3.ts` — both succeed; backfill idempotent
5. Tests still passing (`npx vitest run`)
6. **Calendar smoke test**:
   - Open `/pos`, switch center panel to Calendrier
   - Day view shows seeded bookings with correct colors (gold for online, ink for POS, dashed for walk-ins)
   - Week view renders, today indicator visible
   - Click empty 14:00 slot → drawer opens prefilled at 14:00 → fill in customer + service → save → calendar refreshes with the new block
   - Click the new block → drawer shows actions
7. **Convert booking to sale**:
   - Click a future booking → "Encaisser"
   - Cart prefills with the booking's services and customer
   - Banner shows the booking reference
   - Add a product, charge cash → sale completes with `bookingId` set, booking status → COMPLETED
8. **Walk-in phantom**:
   - Ring up a sale without selecting/creating a booking → sale completes
   - Open Calendrier → the time slot shows the phantom booking with dashed style
   - Database check: `SELECT phantom, walkIn FROM "Booking" WHERE id = ...` returns `true, true`
9. **Cash drawer**:
   - Top bar shows "Ouvrir caisse" → click → opening modal → enter 50 DT float → session created
   - Top bar updates with green dot + running expected cash
   - Make a 30 DT cash sale → expected cash updates to 80 DT
   - Click drawer icon → "Fermer caisse" → enter 78 DT counted → variance −2 DT shown in amber → notes required (since |2| < 5 actually no — make threshold strict `>= 5`; here notes optional) → confirm
   - Session shows up in `/pos/cash-drawer` history
10. **Analytics**:
    - Visit `/pos/analytics` as Sarra (CASHIER, no `analytics.view`) → 403 redirect with French message
    - Login as Nour (OWNER) → page renders with all four KPI tiles, charts populated from seed data
    - Change range to "30 derniers jours" → numbers update
    - "Exporter CSV" → file downloads, opens cleanly in Excel with Tunisian comma decimal
11. **Permissions**:
    - Log in as Mounir (CASHIER) → can sell + open/close his own drawer + view sales but NOT analytics, NOT product editing, NOT anyone else's drawer history
    - Owner can reconcile a closed session → flips to RECONCILED
12. **Offline**:
    - Take POS offline → calendar shows last-cached state (or empty if not previously cached)
    - "Nouvelle réservation" button is disabled with hover hint "Indisponible hors ligne"
    - "Ouvrir caisse" disabled offline
    - Cash sales still go through, queued
13. **CONTEXT.md updated**

---

## Deliverables summary

**New files**

```
prisma/migrations/<timestamp>_phase3_pos_reservations_drawer_analytics/migration.sql
prisma/backfill-phase3.ts

src/components/pos/pos-calendar.tsx        (or extension of multi-service-calendar)
src/components/pos/booking-create-drawer.tsx
src/components/pos/booking-detail-drawer.tsx
src/components/pos/cash-drawer-panel.tsx
src/components/pos/cash-drawer-open-modal.tsx
src/components/pos/cash-drawer-close-modal.tsx
src/components/pos/analytics/kpi-tiles.tsx
src/components/pos/analytics/revenue-chart.tsx
src/components/pos/analytics/top-list.tsx
src/components/pos/analytics/heatmap.tsx
src/components/pos/analytics/by-employee-table.tsx
src/components/pos/analytics/low-stock-table.tsx
src/components/pos/analytics/date-range-picker.tsx

src/app/(pos)/pos/cash-drawer/page.tsx
src/app/(pos)/pos/cash-drawer/[id]/page.tsx
src/app/(pos)/pos/analytics/page.tsx

src/app/api/pos/bookings/route.ts
src/app/api/pos/bookings/[id]/route.ts
src/app/api/pos/bookings/[id]/cancel/route.ts
src/app/api/pos/bookings/[id]/move/route.ts
src/app/api/pos/cash-drawer/current/route.ts
src/app/api/pos/cash-drawer/open/route.ts
src/app/api/pos/cash-drawer/route.ts
src/app/api/pos/cash-drawer/[id]/route.ts
src/app/api/pos/cash-drawer/[id]/summary/route.ts
src/app/api/pos/cash-drawer/[id]/close/route.ts
src/app/api/pos/cash-drawer/[id]/reconcile/route.ts
src/app/api/pos/analytics/summary/route.ts
src/app/api/pos/analytics/revenue/route.ts
src/app/api/pos/analytics/top-services/route.ts
src/app/api/pos/analytics/top-products/route.ts
src/app/api/pos/analytics/by-employee/route.ts
src/app/api/pos/analytics/heatmap/route.ts
src/app/api/pos/analytics/low-stock/route.ts
src/app/api/pos/analytics/export.csv/route.ts
```

**Updated files**

```
prisma/schema.prisma               (CashDrawerSession, Booking.phantom, Payment.cashDrawerSessionId)
prisma/seed.ts                     (future bookings, walk-ins, drawer sessions)
src/app/(pos)/layout.tsx           (nav menu with new sections, drawer indicator in top bar)
src/app/(pos)/pos/page.tsx         (mode toggle in center panel, calendar integration)
src/app/api/pos/sales/route.ts     (auto-create phantom booking on sale-without-booking)
CONTEXT.md
package.json                       (recharts dep)
scripts/deploy/README.md           (backfill instructions)
```

---

## PR description template

Title: **Phase 3 — POS reservations, cash drawer, analytics**

Body:
```
## What
- POS center panel: Cart ↔ Calendar mode toggle
- Reservations from POS: create, edit, move, cancel, encaisser
- Walk-ins auto-create phantom Booking rows (Booking.phantom = true) for analytics consistency
- Cash drawer sessions: open with float → cash payments accumulate via Payment.cashDrawerSessionId → close with count → variance reporting
- Analytics page: 4 KPI tiles, revenue chart, top services/products, hourly heatmap, by-employee, low-stock, CSV export
- All POS-specific booking endpoints under /api/pos/bookings/*
- Backfill creates phantom bookings for Phase 2 sales

## Migration
1. `prisma migrate deploy` (auto via deploy.sh)
2. `npx tsx prisma/backfill-phase3.ts` (manual, one-time, idempotent)

## Verification
[paste screenshots: calendar day view, calendar week view, booking detail drawer, encaisser flow, cash drawer open/close, analytics dashboard]

## Out of scope (next phase)
- Phase 4: Reward Points module (programs, wallets, redemption at POS)
```
