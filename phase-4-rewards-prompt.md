# Salonista — Phase 4: Reward Points Module

> **Prerequisites**: Phases 1, 2, and 3 must be merged. Read `CONTEXT.md` (including all phase additions) and `AGENTS.md`. Phase 1 already provides `SalonSubscription` (gates the REWARDS module), `<ModuleGate>`, and the `rewards.settings` / `rewards.adjust` permissions. Phase 2 provides the POS, charge modal, and `Sale`/`Payment` models. Phase 2's `PaymentMethod` enum has CASH, CARD, TRANSFER, OTHER — Phase 4 adds LOYALTY_POINTS.

## Mission

Ship the Reward Points module — a per-salon loyalty program that:

1. Owner configures (cashback rate, eligibility, redemption rules, bonuses, expiration)
2. Customers accumulate points per visited salon (one independent wallet per salon)
3. POS charge modal lets cashiers redeem points as a payment method
4. Sales automatically earn points; refunds proportionally claw earnings back
5. Customers see all their wallets across salons in `/cliente/fidelite`
6. Owner manages wallets, makes adjustments, sees liability stats

What this phase does **not** ship: real Stripe billing for the REWARDS subscription (still admin-manual per Phase 1), tier systems (STANDARD/SILVER/GOLD), per-transaction FIFO expiration, point-expiry email/SMS notifications.

---

## Stack patterns to honor

(Recap.)

- Prisma client: `import { PrismaClient } from "@/generated/prisma/client"`. Helper at `@/lib/prisma`. Money columns `Decimal(10, 3)`. Points are `Int`.
- Multi-step writes inside `prisma.$transaction([...])`. Reward transactions are particularly important — earning + wallet update + sale write must be atomic.
- Local `prisma generate` is broken — use `as never` casts when fields aren't reflected.
- Brand tokens: `brand-ink`, `brand-ink-soft`, `brand-cream`, `brand-sand`, `brand-gold`, `brand-gold-soft`, `brand-line`. Headings via `.luxury-heading`.
- All user-facing strings in **French**.
- Existing helpers ready: `requireEmployee()`, `requirePermission()`, `requireModule("REWARDS")`, `hasModule()`, `<ModuleGate>`, `formatDT()`, `computeTotals()`.

---

## 1. Prisma schema additions

### New enums

```prisma
enum RewardEligibility {
  SERVICES_ONLY
  PRODUCTS_ONLY
  BOTH
}

enum RewardTransactionReason {
  EARN_PURCHASE
  REDEEM_PURCHASE
  WELCOME_BONUS
  BIRTHDAY_BONUS
  MANUAL_ADJUSTMENT
  EXPIRATION
  REFUND_REVERSAL
}
```

### Update existing `PaymentMethod` enum

Add `LOYALTY_POINTS`. Migration must use `ALTER TYPE ... ADD VALUE` (PostgreSQL). Document in the migration that this value is only created server-side (cashiers select "Use points" in the UI, never a free-form method picker).

### New models

```prisma
model RewardProgram {
  id                       String              @id @default(cuid())
  providerId               String              @unique

  // Earn rates (see §2 for the cashback-% UX)
  pointsPerDinar           Decimal             @default(1.000) @db.Decimal(10, 3)
  dinarPerPoint            Decimal             @default(0.010) @db.Decimal(10, 3)

  // Redemption rules
  minPointsToRedeem        Int                 @default(100)
  maxRedemptionPctPerSale  Int                 @default(50)   // 0–100, server-clamped

  // Eligibility
  eligibleOn               RewardEligibility   @default(BOTH)

  // Expiration (activity-based — see §5)
  inactivityExpireMonths   Int?                // null = never expire

  // Bonuses
  welcomeBonusPoints       Int                 @default(0)
  birthdayBonusPoints      Int                 @default(0)

  active                   Boolean             @default(true)
  createdAt                DateTime            @default(now())
  updatedAt                DateTime            @updatedAt

  provider  ProviderProfile  @relation(fields: [providerId], references: [id], onDelete: Cascade)
  wallets   RewardWallet[]

  @@index([active])
}

model RewardWallet {
  id                      String     @id @default(cuid())
  programId               String
  providerId              String     // denormalized for query speed (uniqueness + filters)
  customerId              String

  balance                 Int        @default(0)   // CAN go negative (refund clawback edge cases)
  lifetimeEarned          Int        @default(0)
  lifetimeRedeemed        Int        @default(0)

  welcomeBonusApplied     Boolean    @default(false)
  lastBirthdayBonusYear   Int?       // YYYY of the year the bonus was last applied
  lastActivityAt          DateTime   @default(now())

  createdAt               DateTime   @default(now())
  updatedAt               DateTime   @updatedAt

  program       RewardProgram        @relation(fields: [programId], references: [id], onDelete: Cascade)
  customer      Customer             @relation(fields: [customerId], references: [id], onDelete: Cascade)
  transactions  RewardTransaction[]

  @@unique([providerId, customerId])
  @@index([providerId, lastActivityAt])
  @@index([customerId])
}

model RewardTransaction {
  id                    String                    @id @default(cuid())
  walletId              String
  delta                 Int                       // positive = earn/credit, negative = redeem/expire/clawback
  balanceAfter          Int                       // snapshot for audit; balance + delta of all prior tx
  reason                RewardTransactionReason

  // Optional source links
  saleId                String?
  refundId              String?
  adjustedByEmployeeId  String?

  // Mandatory for MANUAL_ADJUSTMENT, free-form otherwise
  note                  String?

  createdAt             DateTime  @default(now())

  wallet      RewardWallet    @relation(fields: [walletId], references: [id], onDelete: Cascade)
  sale        Sale?           @relation(fields: [saleId], references: [id], onDelete: SetNull)
  refund      Refund?         @relation(fields: [refundId], references: [id], onDelete: SetNull)
  adjustedBy  SalonEmployee?  @relation("RewardTransactionEmployee", fields: [adjustedByEmployeeId], references: [id], onDelete: SetNull)

  @@index([walletId, createdAt])
  @@index([saleId])
  @@index([refundId])
  @@index([reason])
}
```

### Modifications to existing models

- `Customer`: add back-relation `rewardWallets RewardWallet[]`
- `ProviderProfile`: add back-relations `rewardProgram RewardProgram?`, `rewardWallets RewardWallet[]`
- `Sale`: add back-relation `rewardTransactions RewardTransaction[]`
- `Refund`: add back-relation `rewardTransactions RewardTransaction[]`
- `SalonEmployee`: add back-relation `rewardAdjustments RewardTransaction[] @relation("RewardTransactionEmployee")`

### Migration

```bash
npx prisma migrate dev --name phase4_rewards
```

The PostgreSQL `ALTER TYPE PaymentMethod ADD VALUE 'LOYALTY_POINTS'` must run in its own statement before any seed/code uses it (Postgres doesn't allow adding enum values inside the same transaction that uses them). Prisma's migration generator handles this correctly — verify the output has the ALTER statement separate from the rest.

No backfill required. Programs and wallets are created lazily.

---

## 2. The "cashback %" UX (lock the math here)

Owners think in percentages: "I give 3% back". The internal model is two numbers: `pointsPerDinar` and `dinarPerPoint`. We bridge with a fixed default that maps cleanly:

- Default `dinarPerPoint = 0.010` (i.e. 1 point = 0.01 DT, or 100 points = 1 DT)
- `pointsPerDinar = cashbackPct` (e.g. 3% → 3 points per DT spent)

This makes the math intuitive everywhere:
- Spend 100 DT at 3% → earn 100 × 3 = 300 points
- 300 points × 0.010 = 3.000 DT cashback value
- Effective rate = 3% ✓

**Settings UI exposes only the cashback %.** Behind an "Avancé" toggle, the owner can edit the two ratios directly (for unusual structures like "1 point per 10 DT" loyalty stamps). When the toggle is open, hide the cashback % input — the two are mutually exclusive views of the same data.

Show a live preview below the input: **"Pour un achat de 100 DT, le client gagne 300 points (≈ 3,000 DT)"**.

---

## 3. Helper library — `src/lib/rewards/`

Split into focused modules. All functions return `Decimal` for money and `number` for points (integers).

### `src/lib/rewards/program.ts`

```ts
/**
 * Get the program for a salon, lazily creating it with defaults
 * the first time the owner accesses settings or the first time
 * a sale earns at this salon.
 *
 * Throws if the REWARDS module isn't active for this salon.
 */
export async function getOrCreateProgram(
  providerId: string
): Promise<RewardProgram>;

/** Update settings. Validates ranges (cashback 0–100, max redemption pct 0–100, etc). */
export async function updateProgram(
  programId: string,
  updates: Partial<RewardProgramInput>
): Promise<RewardProgram>;

/** Helper for the cashback-% UX. */
export function programToCashbackPct(p: RewardProgram): Decimal;
//   = pointsPerDinar × dinarPerPoint × 100

export function cashbackPctToProgram(pct: number): {
  pointsPerDinar: Decimal;
  dinarPerPoint: Decimal;
};
//   Always returns dinarPerPoint = 0.010, pointsPerDinar = pct
```

### `src/lib/rewards/wallet.ts`

```ts
/**
 * Get or create a wallet. Lazily creates on first access.
 * Idempotent — concurrent calls collapse to a single wallet via the unique constraint.
 */
export async function getOrCreateWallet(
  tx: PrismaTransactionClient | PrismaClient,
  programId: string,
  customerId: string
): Promise<RewardWallet>;

/** Live balance — just reads RewardWallet.balance, which is the source of truth. */
export async function getWalletBalance(walletId: string): Promise<number>;

/**
 * Bundle for the POS charge modal: balance, redemption rules, recent transactions.
 * Returns null if the salon doesn't have REWARDS active or no wallet exists yet.
 */
export async function getWalletForPos(
  providerId: string,
  customerId: string
): Promise<{
  walletId: string;
  balance: number;
  cashbackPct: string;
  minPointsToRedeem: number;
  maxRedemptionPctPerSale: number;
  dinarPerPoint: string;
  recentTransactions: RewardTransaction[];
} | null>;
```

### `src/lib/rewards/earn.ts`

The earning formula is the spec's most error-prone area. Lock the test cases.

```ts
/**
 * Compute points earned on a sale.
 *
 * Inputs:
 *   - sale (with items + payments loaded)
 *   - program
 *
 * Logic:
 *   1. eligibleSubtotal = sum of SaleItem.lineTotal where line.kind matches program.eligibleOn
 *   2. Apply sale-level discount proportionally:
 *        eligibleAfterDiscount = eligibleSubtotal × (sale.subtotal - sale.discountAmount) / sale.subtotal
 *   3. Subtract the loyalty payment portion (no infinite earn loop):
 *        loyaltyPaid = sum of payments where method = LOYALTY_POINTS
 *        eligibleBase = eligibleAfterDiscount - loyaltyPaid (but proportionally — see tests)
 *   4. points = floor(eligibleBase × pointsPerDinar)
 *   5. Tips never earn points (tipTotal excluded from base by construction).
 *
 * Returns 0 if program is inactive, eligibleBase ≤ 0, or sale total is 0.
 */
export function computeEarnedPoints(
  sale: SaleWithItemsAndPayments,
  program: RewardProgram
): number;

/**
 * Apply earnings + bonuses for a freshly-paid sale. Inside a transaction.
 * Creates RewardTransaction rows for:
 *   - EARN_PURCHASE (always, if points > 0)
 *   - WELCOME_BONUS (if first sale at this salon AND welcomeBonusPoints > 0)
 *   - BIRTHDAY_BONUS (if customer.birthday's month = today's month
 *                     AND wallet.lastBirthdayBonusYear !== thisYear
 *                     AND birthdayBonusPoints > 0)
 *
 * Updates wallet.balance, wallet.lifetimeEarned, wallet.lastActivityAt.
 * Updates wallet.welcomeBonusApplied, wallet.lastBirthdayBonusYear as appropriate.
 *
 * Idempotent on saleId — re-running for the same sale is a no-op.
 */
export async function applySaleEarnings(
  tx: PrismaTransactionClient,
  saleId: string
): Promise<{
  earned: number;
  welcomeBonus: number;
  birthdayBonus: number;
}>;
```

### `src/lib/rewards/redeem.ts`

```ts
/**
 * Validate a redemption request before applying it.
 * Throws RedemptionError with French message if invalid.
 */
export function validateRedemption(args: {
  walletBalance: number;
  pointsToRedeem: number;
  saleTotal: Decimal;
  program: RewardProgram;
}): {
  redemptionValue: Decimal;   // in DT
};

export class RedemptionError extends Error {
  code: "BELOW_MIN" | "INSUFFICIENT_BALANCE" | "EXCEEDS_MAX_PCT" | "PROGRAM_INACTIVE";
}

/**
 * Apply a redemption inside a sale-creation transaction.
 * Called from POST /api/pos/sales when payments include a LOYALTY_POINTS payment.
 *
 * Creates RewardTransaction with reason=REDEEM_PURCHASE, delta=-pointsToRedeem.
 * Updates wallet.balance, wallet.lifetimeRedeemed, wallet.lastActivityAt.
 *
 * The Payment row itself is created by the sale handler — this function only
 * touches the reward ledger.
 */
export async function applySaleRedemption(
  tx: PrismaTransactionClient,
  saleId: string,
  walletId: string,
  pointsToRedeem: number
): Promise<{ redemptionValue: Decimal }>;
```

### `src/lib/rewards/refund.ts`

```ts
/**
 * Claw back earnings on a refund.
 *
 * Logic:
 *   - Find the original sale's EARN_PURCHASE transaction.
 *   - Compute clawback ratio = refund.totalAmount / sale.total
 *   - Clawback = floor(originalEarned × ratio)
 *   - Create RewardTransaction with reason=REFUND_REVERSAL, delta=-clawback
 *   - Wallet balance can go negative — that's OK and intentional.
 *
 * Note: Redeemed points are NOT restored on refund. The customer received
 * cash equivalent to the points already; restoring them would double-credit.
 *
 * Idempotent on refundId.
 */
export async function clawbackOnRefund(
  tx: PrismaTransactionClient,
  refundId: string
): Promise<{ clawedBack: number }>;
```

### `src/lib/rewards/adjust.ts`

```ts
/**
 * Owner-driven manual adjustment. Used by the wallets management page.
 * Requires `rewards.adjust` permission (caller's responsibility).
 *
 * `delta` can be negative. `note` is required.
 * Creates RewardTransaction with reason=MANUAL_ADJUSTMENT.
 */
export async function adjustWallet(
  walletId: string,
  delta: number,
  employeeId: string,
  note: string
): Promise<RewardTransaction>;
```

### `src/lib/rewards/expiration.ts`

```ts
/**
 * Activity-based expiration. Run nightly via cron (out of scope for this
 * phase — for now, expose a function and a triggerable admin endpoint).
 *
 * For each wallet where:
 *   - balance > 0
 *   - program.inactivityExpireMonths is not null
 *   - now - wallet.lastActivityAt > inactivityExpireMonths
 * → create EXPIRATION transaction zeroing the balance.
 */
export async function expireInactiveWallets(
  providerId?: string  // omit to run for all salons
): Promise<{ expired: number; pointsZeroed: number }>;
```

### Tests

`src/lib/rewards/*.test.ts` — exhaustive cases:
- Earn with each `eligibleOn` value
- Earn with sale-level discount
- Earn when partially paid by loyalty (no infinite loop)
- Refund clawback proportional, partial vs full
- Refund clawback driving balance negative
- Bonuses: welcome on first sale only, birthday once per year
- Redemption validation: below min, exceeds balance, exceeds max %, program inactive
- Expiration: respects inactivity threshold, doesn't expire active wallets

The tests are critical — this is the area where bugs become customer-trust disasters.

---

## 4. POS integration

### Phase 2 charge modal extension

In `src/components/pos/charge-modal.tsx`, add the loyalty payment path.

**Before showing Step 1 (Payment),** if the customer is identified AND the salon has REWARDS active, fetch wallet info via `GET /api/pos/customer/[customerId]/wallet`. Cache for the modal session.

**Step 1 — Payment** changes:
- If wallet exists with `balance >= minPointsToRedeem`, add a new tile alongside ESPÈCES / CARTE / VIREMENT / AUTRE: a gold-bordered tile with the gift-box icon, label **"Points fidélité"**, subtitle **"Solde: {balance} pts (≈ {value} DT)"**.
- Tapping the tile opens an inline expansion (not a separate modal — disrupts the flow):

```
┌─────────────────────────────────────────────┐
│  Utiliser des points                         │
│  Solde disponible: 540 pts (≈ 5,400 DT)     │
│                                              │
│  [—]  [ 200 ] points  [+]                    │
│                                              │
│  Valeur: 2,000 DT                            │
│  Maximum sur cette vente: 250 pts (50%)      │
│                                              │
│  [Annuler]                  [Appliquer]      │
└─────────────────────────────────────────────┘
```

- Clamp input: min = `minPointsToRedeem`, max = `min(balance, floor(saleTotal × maxRedemptionPctPerSale / 100 / dinarPerPoint))`.
- "Appliquer" adds a payment row to the list with `method: "LOYALTY_POINTS"`, `amount: redemptionValue`, and a `pointsRedeemed: number` field carried in the modal state (sent in the API call).

**Step 4 — Confirm** payload: include `pointsRedeemed` for the loyalty payment.

**Receipt display** (Phase 2's `<Receipt>` component):
- If sale had loyalty redemption: line "Points utilisés: 200 (2,000 DT)" in the payments section
- After the totals: "Points gagnés sur cet achat: 78 pts" (only if program active and earnings > 0)
- Bonus lines appear if bonuses were applied: "Bonus de bienvenue: 100 pts", "Bonus anniversaire: 50 pts"
- Email receipt mirrors these

### `POST /api/pos/sales` extension

In the existing handler:

1. **Before** computing earnings or applying any reward write, validate any LOYALTY_POINTS payment:
   - Customer must be set (no walk-in loyalty)
   - Customer must have a wallet
   - Use `validateRedemption()`; throw 422 with French error if invalid
2. **Inside the transaction**, after the sale is created:
   - For each LOYALTY_POINTS payment, call `applySaleRedemption(tx, sale.id, wallet.id, points)`
   - After all redemptions: compute earned points via `computeEarnedPoints()`, then `applySaleEarnings(tx, sale.id)` which handles the EARN_PURCHASE plus any welcome/birthday bonuses
3. Return earned/redeemed/bonus counts in the response so the receipt can display them.

### `POST /api/pos/sales/[id]/refunds` extension (Phase 2)

After creating the refund inside the transaction, call `clawbackOnRefund(tx, refund.id)`. Surface the clawback amount in the response so the refund receipt can show it: "Points retirés (remboursement): -150 pts".

### Offline behavior

Per Phase 2's Tier B capability matrix, **redemption stays blocked offline**. Update `src/components/pos/charge-modal.tsx`:
- The "Points fidélité" tile is rendered but disabled offline, with hover/long-press tooltip: **"Indisponible hors ligne — utilisez les points lors de la prochaine connexion"**.
- The cached wallet balance can still be displayed (informational), but the redeem action is grayed out.

**Earning happens at sync time** — no client-side prediction needed. When a queued offline sale syncs, the server runs `applySaleEarnings()` as part of the normal sale-creation path. The customer sees their points after the sync completes.

### Phase 2 catalog endpoint extension

`GET /api/pos/catalog` (Phase 2) — extend the customer payload to include wallet summary for own-scope customers:

```jsonc
{
  "id": "cust_xxx",
  "phone": "+216...",
  "firstName": "Amira",
  "lastName": "Ben Salah",
  "scope": "own",
  // ... existing fields
  "wallet": {
    "walletId": "wal_yyy",
    "balance": 540,
    "minPointsToRedeem": 100,
    "maxRedemptionPctPerSale": 50,
    "dinarPerPoint": "0.010"
  }
}
```

Update `src/lib/pos-offline-db.ts` so `findCachedCustomerByPhone()` returns the wallet info, and the customer panel in `/pos` displays it (offline read-only).

---

## 5. Owner UI — `/prestataire/fidelite`

### Routing & gate

`src/app/(dashboard)/prestataire/fidelite/page.tsx`. Sidebar item "Fidélité" appears in the PROVIDER nav **only if** the salon has REWARDS active (use `hasModule()` server-side, like Phase 2 did for "Caisse").

The page is wrapped in `<ModuleGate module="REWARDS">`. Inside, three tabs: **Paramètres** | **Cartes clients** | **Statistiques**.

### Activation banner (dashboard)

When REWARDS is freshly activated and the program hasn't been configured yet (no `RewardProgram` row), show a dismissible banner on `/prestataire` (the main dashboard):

> ★ Le module Fidélité est activé. Configurez votre programme pour commencer à récompenser vos clients. → Configurer

Dismissal stored in localStorage, reappears every 7 days while unconfigured.

### Tab 1: Paramètres

Form fields (left column) with a live preview card (right column).

Fields:
- **Nom du programme** — display name shown to clients (default: salon name + " Fidélité")
- **Programme actif** — toggle (defaults on)
- **Taux de cashback (%)** — primary input (0–20, step 0.5)
- **[Avancé]** collapsible — pointsPerDinar / dinarPerPoint manual edit (hidden by default)
- **Éligibilité des points** — radio: Services uniquement / Produits uniquement / Les deux (default Both)
- **Minimum de points pour échanger** — number, default 100
- **Pourcentage maximum payable en points** — slider 10–100% in 10% steps, default 50%
- **Bonus de bienvenue (points)** — default 0
- **Bonus anniversaire (points)** — default 0
- **Inactivité avant expiration** — select: 6, 12, 18, 24 mois, ou Jamais (default Jamais)

Live preview card:
> Pour un achat de **100 DT**, votre client gagnera environ **300 points** (≈ 3,000 DT).
> Pour échanger, il devra avoir au moins **100 points** (≈ 1,000 DT).
> Sur une vente, il pourra payer au maximum **50%** avec ses points.

Permission: `rewards.settings` (OWNER only per the matrix).

API: `GET /api/rewards/program` (auto-creates on first read), `PUT /api/rewards/program`.

### Tab 2: Cartes clients

- Search bar: phone or name
- Sort: by balance (default desc), by lifetime earned, by last activity
- Table columns: Client (name + phone), Solde, Total gagné, Total échangé, Dernière activité, Actions
- Per-row "Voir" → opens a side drawer:
  - Customer profile snapshot
  - Big balance card: "540 points (≈ 5,400 DT)"
  - Lifetime stats: earned / redeemed / refund clawbacks
  - Last activity date
  - **Ajuster le solde** button (gated by `rewards.adjust`):
    - Modal: delta input (positive or negative; can be a "+50" or "-100"), reason dropdown (Erreur de calcul / Geste commercial / Correction technique / Autre), free-text note (mandatory)
    - Submit creates RewardTransaction with reason=MANUAL_ADJUSTMENT
  - Transaction history table: date, type (icon + label), delta, balance after, source link (sale receipt number, refund, or adjustment author)

API:
```
GET    /api/rewards/wallets                                → paginated list (page, pageSize, search, sort)
GET    /api/rewards/wallets/[id]                           → detail with paginated transactions
POST   /api/rewards/wallets/[id]/adjust                    → manual adjustment
```

### Tab 3: Statistiques

Three tile rows + one table.

**Top row — Liability:**
- **Points en circulation**: sum of `RewardWallet.balance` for active wallets
- **Valeur en DT**: × dinarPerPoint
- **Cartes actives**: count of wallets with balance > 0

**Middle row — Engagement (last 30 days):**
- **Points gagnés**: sum of EARN_PURCHASE deltas
- **Points échangés**: abs(sum of REDEEM_PURCHASE deltas)
- **Taux de rachat**: redeemed / earned × 100 (handle div-by-zero)

**Bottom row — Bonuses (lifetime):**
- **Bonus de bienvenue distribués**: count + sum
- **Bonus anniversaire distribués**: count + sum

**Top earners table (top 10):**
- Customer | Lifetime earned | Lifetime redeemed | Current balance | Last activity

API: `GET /api/rewards/stats?from=&to=`. Default range "last 30 days".

---

## 6. Customer UI — `/cliente/fidelite`

### Sidebar nav

Add **Fidélité** to the CLIENT dashboard sidebar (in `src/app/(dashboard)/layout.tsx`). Always visible — wallets exist independent of which salons have the module active *now*.

### List page — `/cliente/fidelite`

Empty state when no wallets:
> Vous n'avez encore aucune carte de fidélité.
> Visitez un salon partenaire pour commencer à gagner des points.

Otherwise, a grid of cards. Each card:

```
┌─────────────────────────────────┐
│  [Salon photo / initial]         │
│                                  │
│  Salon Nour                      │
│  Sousse                          │
│  ────────────                    │
│  540 pts                         │
│  ≈ 5,400 DT                      │
│                                  │
│  Dernière activité: 12 mai 2026 │
│  → Voir l'historique             │
└─────────────────────────────────┘
```

Click → `/cliente/fidelite/[walletId]`.

### Detail page — `/cliente/fidelite/[walletId]`

- Salon header (photo + name + city)
- Big balance card with current points + DT equivalent
- Program rules summary: "1 DT dépensé = 3 pts • 100 pts = 1 DT • Min échange: 100 pts • Max 50% par achat"
- If `inactivityExpireMonths` set: small notice "Vos points expirent après 12 mois d'inactivité"
- Transaction history: paginated list (20 per page, infinite scroll)
  - Each row: date, type label + icon (gain green, échange amber, expiration gray, ajustement neutral), delta, source ("Achat #S-20260512-0042" / "Bonus de bienvenue" / etc.)

API:
```
GET  /api/cliente/fidelite               → list of all wallets for current user (joined via Customer.userId)
GET  /api/cliente/fidelite/[walletId]    → detail (must verify wallet's customer.userId === session.user.id)
```

### Booking flow informational hint (existing pages)

In the existing customer booking flow for a salon, if that salon has REWARDS active and the customer has a wallet, show a small badge below the offer:

> ★ Vous avez **540 pts** chez ce salon (≈ 5,400 DT)

Purely informational. Redemption only happens at the till during checkout. This keeps online-booking semantics simple — no point math at booking time, just at sale time.

---

## 7. Receipt updates

Update Phase 2's `src/components/pos/receipt.tsx`:

After the totals block, if the sale earned or redeemed points, add a "Fidélité" section:

```
─────────────────────────────────
Fidélité
Points utilisés:        -200 pts (-2,000 DT)
Points gagnés:           +78 pts
Bonus anniversaire:      +50 pts
                       ──────────
Nouveau solde:          540 pts
─────────────────────────────────
```

Email receipt mirrors this section. PDF version (deferred from Phase 2) still out of scope.

The "Nouveau solde" comes from a server-side query at receipt generation time (`wallet.balance` after all transactions for this sale are applied).

---

## 8. Subscription billing notes

The REWARDS module is paid; activation remains admin-manual via Phase 1's `/admin/subscriptions` page. For Phase 4:

- When admin activates REWARDS, ensure the `pricingSnapshot` JSON is captured. Recommended default schema: `{ "monthlyPriceDT": 30, "billingCycle": "monthly", "freeTrialDays": 30 }` — these are placeholders for future Stripe integration; no enforcement now.
- When the subscription `status` flips to `EXPIRED` or `SUSPENDED`:
  - The `<ModuleGate>` automatically blocks access to `/prestataire/fidelite` and the loyalty tile in the POS charge modal
  - Existing wallets and transactions are **preserved** (data is the customer's; we don't delete it on subscription lapse)
  - Customers can still view their wallet at `/cliente/fidelite/[walletId]` (read-only — earning and redemption are paused)
  - When the subscription is reactivated, the program resumes from where it left off

Add a banner on `/prestataire/fidelite` if `status` is `SUSPENDED`/`EXPIRED`:
> ⚠ Votre abonnement Fidélité est suspendu. Les clients ne peuvent plus gagner ni échanger de points jusqu'à réactivation. Contactez l'administration.

This phase does **not** implement Stripe webhooks, billing notifications, or payment collection.

---

## 9. Seed updates

Extend `prisma/seed.ts`:

- Provider1 (REWARDS active in Phase 1 seed): create a `RewardProgram` with cashback 3%, welcome 100 pts, birthday 50 pts, inactivity 12 months, eligibility BOTH
- Create wallets for 3 of the seeded customers at provider1, with realistic transaction histories (mix of earnings, one redemption, one welcome bonus)
- One wallet should have a refund clawback in its history (so the customer dashboard shows a REFUND_REVERSAL row)
- Provider2: REWARDS not active (per Phase 1 seed) — confirm the customer dashboard shows wallets only for provider1

Update the seed credentials block:
```
// Phase 4 reward credentials:
//   Provider 1 cashback rate: 3% (1 DT spent = 3 points; 100 points = 1 DT)
//   Provider 1 has wallets seeded for 3 customers with mixed transaction histories
//   Provider 2 does NOT have REWARDS active
```

---

## 10. CONTEXT.md update

Append:

````md
## Phase 4 additions (Reward Points module)

- `RewardProgram` (one per salon, lazy-created), `RewardWallet` (one per customer per salon, lazy-created), `RewardTransaction` (immutable ledger with `balanceAfter` snapshot for audit).
- Cashback math: owner sets a single percentage; internally stored as `pointsPerDinar` (= cashback %) and `dinarPerPoint` (fixed 0.010). 100 points = 1 DT redemption value. "Avancé" UI toggle exposes the two ratios for unusual programs.
- Earning: applied server-side after sale creation, on the eligible portion (filtered by `eligibleOn`), with proportional discount applied, minus loyalty payment portion (no infinite earn loop). Tips never earn.
- Bonuses: WELCOME on first earning sale; BIRTHDAY once per year, applied during the customer's birthday month at sale time.
- Redemption: in the POS charge modal as a payment method (`PaymentMethod.LOYALTY_POINTS`). Validated against minPointsToRedeem, balance, and maxRedemptionPctPerSale.
- Refund clawback: proportional REFUND_REVERSAL on EARN_PURCHASE; redeemed points NOT restored. Wallet balance can go negative.
- Expiration: activity-based (`inactivityExpireMonths` since `lastActivityAt`), nightly job exposed via helper. Cron not scheduled in this phase — expose `expireInactiveWallets()` and a triggerable admin endpoint for now.
- POS offline: redemption blocked, earning happens at sync time on server. Phase 2's catalog cache extended to include wallet summary for own-scope customers.
- Subscription expiry: existing wallets preserved, earning/redeeming paused, reactivation resumes seamlessly.

Routes added:
- `/prestataire/fidelite` — owner program settings, wallets, stats (gated by REWARDS module + `rewards.settings`/`rewards.adjust`)
- `/cliente/fidelite`, `/cliente/fidelite/[walletId]` — customer view across all their wallets
- `/api/rewards/program` (GET, PUT)
- `/api/rewards/wallets` (GET), `/api/rewards/wallets/[id]` (GET), `/api/rewards/wallets/[id]/adjust` (POST)
- `/api/rewards/stats` (GET)
- `/api/pos/customer/[customerId]/wallet` (GET)
- `/api/cliente/fidelite`, `/api/cliente/fidelite/[walletId]`

Helpers: `getOrCreateProgram`, `getOrCreateWallet`, `getWalletForPos`, `computeEarnedPoints`, `applySaleEarnings`, `validateRedemption`, `applySaleRedemption`, `clawbackOnRefund`, `adjustWallet`, `expireInactiveWallets`.
````

Also add to "Recurring gotchas":

- **Negative wallet balances are intentional** when refund clawbacks exceed remaining balance. Don't add a `balance >= 0` check anywhere — it's a feature, not a bug.
- **`PaymentMethod.LOYALTY_POINTS` is server-only.** The cashier never picks it from a free-form list; it's always introduced via the redemption flow in the charge modal. Don't expose it in admin payment-method dropdowns.
- **Adding enum values to Postgres** requires the ALTER TYPE statement in its own transaction. Prisma handles this — but if you ever add another payment method, verify the migration splits correctly.

---

## What NOT to do

- ❌ Tier system (STANDARD/SILVER/GOLD) — post-MVP
- ❌ Per-transaction FIFO point expiration — Phase 4 uses inactivity-based expiration
- ❌ Cron scheduling for `expireInactiveWallets` — expose the function, schedule later
- ❌ Email/SMS notifications for points earned, expiring, or birthday bonus — out of scope
- ❌ Cross-salon point transfer or aggregation — explicitly per-salon per the spec
- ❌ Stripe / real subscription billing — admin-manual remains the activation flow
- ❌ Restoring redeemed points on refund — they stay spent; the cash refund is the customer's compensation
- ❌ Earning points on tips — excluded from base by construction
- ❌ Earning points on the loyalty-paid portion of the sale — excluded to prevent infinite earn
- ❌ Public-facing changes to the homepage, salon listing, or marketing pages
- ❌ Any change to the influencer system

If you find yourself touching any of the above, stop and confirm.

---

## Verification checklist

1. `npx prisma migrate status` — clean
2. `npm run build` — succeeds
3. `npm run lint` — passes
4. Tests pass: `npx vitest run src/lib/rewards`
5. `npx tsx prisma/seed.ts` — succeeds, including reward seed data

**Owner flow:**
6. Login as Nour (provider1, REWARDS active) → sidebar shows "Fidélité"
7. Visit `/prestataire/fidelite` first time → program auto-created → settings tab loads with defaults
8. Change cashback to 5% → save → preview updates correctly
9. Switch to "Cartes clients" tab → 3 seeded wallets visible → click one → drawer shows transaction history
10. Click "Ajuster le solde" → as Nour (OWNER, has `rewards.adjust`), modal opens; submit +20 with note "Test" → wallet balance increases by 20, MANUAL_ADJUSTMENT row appears in history
11. Login as Sarra (CASHIER, no `rewards.adjust`, no `rewards.settings`) → sidebar still shows "Fidélité" if she navigates manually but settings tab returns 403; "Ajuster" button is hidden in wallet drawer
12. Login as Yasmine (provider2, REWARDS NOT active) → no "Fidélité" sidebar item; direct navigation to `/prestataire/fidelite` shows ModuleGate fallback

**POS flow:**
13. As Sarra at provider1, identify a customer with wallet (seeded, balance 540 pts)
14. Add 1 service (60 DT) to cart → Encaisser → "Points fidélité" tile visible alongside Espèces/Carte
15. Tap loyalty tile → expansion shows balance 540 pts, max 30 pts (50% × 60 DT × 100 pts/DT = 3000... wait — recompute: maxRedemptionDT = 60 × 50% = 30 DT; max points = 30 / 0.010 = 3000 pts; clamped by balance to 540) → input 200 → applies as 2,000 DT off
16. Add Espèces 58 DT → confirm → sale completes; receipt shows "Points utilisés: -200 (2,000 DT)" and "Points gagnés: +178 pts" (60 DT − 2 DT loyalty paid = 58 DT eligible × 3 pts/DT)
17. Customer dashboard now shows balance = 540 − 200 + 178 = 518 pts
18. Verify the EARN_PURCHASE transaction excludes the 2 DT loyalty portion (no infinite-loop bug)

**Refund flow:**
19. Refund the sale fully → REFUND_REVERSAL transaction created → 178 pts clawed back → wallet returns to 340 pts (540 − 200, no restore of redeemed)
20. Refund a partial line (e.g., refund 30 DT of a 60 DT sale that earned 178 pts) → clawback ≈ 89 pts proportionally

**Bonus flow:**
21. Set a customer's birthday to current month → ring up a sale → BIRTHDAY_BONUS appears on receipt and in wallet history; `lastBirthdayBonusYear` set to current year
22. Ring up another sale that month → no second birthday bonus (idempotent)
23. New customer's first sale at provider1 → WELCOME_BONUS applied → `welcomeBonusApplied: true`; second sale → no second welcome bonus

**Customer flow:**
24. Login as a CLIENT linked to a Customer with wallets at provider1 → sidebar shows "Fidélité" → page lists wallets only at salons where the customer has activity
25. Click a wallet → detail page shows balance, program rules, transaction history
26. Login as a CLIENT with no wallets → empty state shown

**Offline flow:**
27. POS offline, identify a cached customer → wallet balance shown (cached) → loyalty tile disabled with hover hint
28. Cash sale offline → queues → reconnect → sale syncs → earnings applied server-side → customer dashboard refreshed shows new transaction
29. Provider2 (REWARDS not active) POS → no loyalty tile shown for any customer

**Edge cases:**
30. Try to redeem 99 pts when min is 100 → 422 with French error
31. Try to redeem 250 pts on a 60 DT sale (max would be 3000 pts but exceeds 50% rule → max 3000 in this case actually OK, so test a smaller sale: redeem 600 pts on a 10 DT sale where max is 5 DT = 500 pts) → 422
32. Subscription expires mid-day → POS loyalty tile disappears on next page load; existing wallet data still accessible to customers; new sales don't earn

33. **CONTEXT.md updated**

---

## Deliverables summary

**New files**

```
prisma/migrations/<timestamp>_phase4_rewards/migration.sql

src/lib/rewards/program.ts                + .test.ts
src/lib/rewards/wallet.ts                 + .test.ts
src/lib/rewards/earn.ts                   + .test.ts
src/lib/rewards/redeem.ts                 + .test.ts
src/lib/rewards/refund.ts                 + .test.ts
src/lib/rewards/adjust.ts                 + .test.ts
src/lib/rewards/expiration.ts             + .test.ts
src/lib/rewards/index.ts                  (barrel export)

src/app/(dashboard)/prestataire/fidelite/page.tsx
src/app/(dashboard)/prestataire/fidelite/_components/settings-tab.tsx
src/app/(dashboard)/prestataire/fidelite/_components/wallets-tab.tsx
src/app/(dashboard)/prestataire/fidelite/_components/wallet-drawer.tsx
src/app/(dashboard)/prestataire/fidelite/_components/adjust-modal.tsx
src/app/(dashboard)/prestataire/fidelite/_components/stats-tab.tsx
src/app/(dashboard)/prestataire/fidelite/_components/cashback-preview.tsx

src/app/(dashboard)/cliente/fidelite/page.tsx
src/app/(dashboard)/cliente/fidelite/[walletId]/page.tsx
src/app/(dashboard)/cliente/fidelite/_components/wallet-card.tsx

src/components/pos/loyalty-payment-tile.tsx        (extracted from charge-modal)
src/components/pos/loyalty-balance-card.tsx        (in customer-panel)

src/app/api/rewards/program/route.ts
src/app/api/rewards/wallets/route.ts
src/app/api/rewards/wallets/[id]/route.ts
src/app/api/rewards/wallets/[id]/adjust/route.ts
src/app/api/rewards/stats/route.ts
src/app/api/pos/customer/[customerId]/wallet/route.ts
src/app/api/cliente/fidelite/route.ts
src/app/api/cliente/fidelite/[walletId]/route.ts
src/app/api/admin/rewards/expire-inactive/route.ts  (manual trigger; admin-only)
```

**Updated files**

```
prisma/schema.prisma                            (RewardProgram, RewardWallet, RewardTransaction; LOYALTY_POINTS enum value)
prisma/seed.ts                                   (program for provider1, 3 wallets with histories)
src/components/pos/charge-modal.tsx              (loyalty payment path)
src/components/pos/customer-panel.tsx            (balance card when wallet exists)
src/components/pos/receipt.tsx                   (Fidélité section)
src/app/api/pos/sales/route.ts                   (validate redemption + apply earnings/redemption inside transaction)
src/app/api/pos/sales/[id]/refunds/route.ts      (clawback inside transaction)
src/app/api/pos/catalog/route.ts                 (include wallet summary for own-scope customers)
src/lib/pos-offline-db.ts                        (cache wallet info, expose to UI)
src/app/(dashboard)/layout.tsx                   (Fidélité nav for PROVIDER conditional, CLIENT always)
src/app/(dashboard)/prestataire/page.tsx         (activation banner when REWARDS just-activated and unconfigured)
src/lib/mail.ts                                  (email receipt template includes Fidélité section)
CONTEXT.md
```

---

## PR description template

Title: **Phase 4 — Reward Points module**

Body:
```
## What
- New models: RewardProgram (one per salon, lazy), RewardWallet (one per customer per salon, lazy), RewardTransaction (ledger)
- PaymentMethod.LOYALTY_POINTS added
- Owner UI at /prestataire/fidelite: settings (cashback %, eligibility, redemption rules, bonuses, inactivity expiration), wallets list with manual adjustments, stats
- Customer UI at /cliente/fidelite: list of wallets across salons + per-wallet detail with transaction history
- POS integration: loyalty payment tile in charge modal, balance card in customer panel, receipt updates
- Earning + bonuses (welcome, birthday) applied server-side at sale time; refund clawback proportional
- Phase 2 catalog cache extended with wallet summary for own-scope customers; redemption blocked offline (per Phase 2 capability matrix)
- Activity-based expiration via `expireInactiveWallets()` helper (cron scheduling deferred)

## Migration
1. `prisma migrate deploy` (auto via deploy.sh) — note the ALTER TYPE PaymentMethod statement
2. No backfill required — programs and wallets are created lazily

## Verification
[paste screenshots: settings page with cashback preview, wallets table, wallet drawer with transaction history, POS charge modal with loyalty tile + redemption expansion, receipt with Fidélité section, customer dashboard wallet list]

## Out of scope
- Tier systems (STANDARD/SILVER/GOLD)
- Per-transaction FIFO point expiration
- Stripe / real subscription billing
- Email/SMS notifications for points
- Cron scheduling for inactivity expiration (function exists, scheduling separate)
```
