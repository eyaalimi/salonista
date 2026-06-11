# Salonista — Hardening Pass: Design Spec

**Date**: 2026-05-06
**Scope**: 5 tasks. No new features. Security & reliability only.
**Prereqs**: `CONTEXT.md`, `AGENTS.md`.

---

## Decisions captured during brainstorming

| Topic | Choice | Rationale |
|---|---|---|
| T1 verify-route refactor shape | **C** — goal-driven, no file split; PR note documents the omission | Existing single-file handler is shape-correct (GET read-only, POST writes, owner check present). Splitting it would be refactor disguised as security work. |
| T2 offsite backup policy | **A** — S3 if configured, otherwise local + amber banner on `/admin` | Makes the gap unmissable without blocking ship. |
| T2 AWS runbook in `scripts/deploy/README.md` | **b** — include one-page provisioning runbook | Op-team hasn't set up S3 yet; without a runbook they'll do it wrong. |
| T3 IDB-wipe on salon-switch | **A1** — same rules as sign-out; owner-only force escape | Another salon literally cannot wipe a competitor's unsynced revenue on a shared tablet. |
| T3 "pending" definition | **B1** — sales only, not cart drafts | Drafts can be re-typed; sales have real money. |
| T3 idle-lock defer boundary | **A1** — modal open OR charge POST in flight | Cleanest "transaction in flight" rule; doesn't fire mid-toast. |
| T3 idle-lock backgrounded-tab policy | **B1** — backgrounded time counts as idle | Safe by default on shared device. |
| T4 receipt-number testing | **A** — pure format test + atomicity-audit code comment | Code is already atomic (verified by reading it); concurrency tests cost more than they earn. |
| T5 cart-clobber UX | **A** — 3-button confirm with "Conserver et fusionner" merge | Avoids silent loss of an in-progress walk-in cart without inventing a parked-sales feature. |

---

# Section 1 — QR Verification Hardening

## Goal
A QR scan from a customer's email cannot complete a booking without an authenticated salon person actively confirming arrival on the verification page.

## What is already correct
- `GET /api/payment/verify?code=…` is already read-only.
- `POST` already requires session and enforces salon ownership for `PROVIDER` role.

## What we change (Section 1)

### 1.1 Allow PIN-employee sessions to verify
Today `POST` rejects anyone whose `session.user.role !== "PROVIDER" | "ADMIN"`, so a cashier on the tablet (PIN-authed, `session.employee != null`) cannot mark arrival.

Accept three caller shapes:
1. **PIN-employee session** (`session.employee != null`) — require `bookings.edit` permission via `requirePermission()`. Ownership: `session.employee.providerId` vs. booking's offers' `providerId`.
2. **Owner User session** with `role === "PROVIDER"` — existing path.
3. **Admin** — existing path; bypasses ownership.

PIN-employee lacking `bookings.edit` → `403 { error: "Vous n'avez pas la permission de valider les arrivées" }`.

Extract a helper:
```ts
// src/lib/verify-authz.ts
type Verifier =
  | { kind: "employee"; employeeId: string; providerId: string }
  | { kind: "owner"; providerId: string }
  | { kind: "admin" }
  | { kind: "none" };

async function resolveVerifier(session: Session | null): Promise<Verifier>;
```
Pure-ish (touches Prisma to resolve `providerProfile` for owners), but the branching is testable.

### 1.2 Audit trail
New nullable column on `Booking`:
```
qrVerifiedByEmployeeId  String?  // FK → SalonEmployee.id, onDelete: SetNull
```
- Set only when verifier is `kind: "employee"`. `null` for owner-User / admin verifications.
- Migration: `prisma/migrations/20260506xxxxxx_qr_verified_by_employee/migration.sql`.
- `CONTEXT.md` updated under the booking model description.

### 1.3 Verification page becomes a real action
`src/app/verification/page.tsx` reworked:
- On mount: `GET` only → show booking details + current state (no auto-confirm).
- If `verified === true` → show timestamp + verifier `displayName` (if available from GET response) + discreet "Déjà vérifié" badge. No button.
- If `verified === false`:
  - **No salon session detected**: button → `/salon-pin?next=/verification?code=<code>`.
  - **PIN session or owner session present**: primary button **"Confirmer l'arrivée"**. Click fires `POST { code }`. On success the page swaps into the "déjà vérifié" state with the just-recorded employee name. Errors render inline in French.
- Wordmark fix: replace hardcoded `Beauté.tn` with `<Logo>` component.

### 1.4 Response contract (extension, not break)
GET and POST both grow:
```ts
verifiedBy?: { displayName: string }   // present when employee verified
```
No removed/renamed fields. Existing callers unaffected.

### 1.5 What we deliberately do NOT do
PR description includes:
> The brief asked to split `/api/payment/verify` into separate GET/POST files. Inspection showed the existing handler is already shape-correct (GET read-only, POST is the only writer, ownership check is in place). We added the missing pieces (employee verifier + audit + page action) without restructuring the file. Splitting would have been refactor disguised as a security fix.

## Test surface
- `lib/verify-authz.test.ts` — `resolveVerifier` branching.
- Integration: out of scope (no harness). Manual verification documented in PR template.

---

# Section 2 — Backups (DB + uploads)

## Goal
A complete restore of yesterday's `salonista_prod` + `public/uploads/` is possible from a different machine within 30 minutes, with documented S3 offsite when configured.

## 2.1 `scripts/deploy/backup.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail
# Loaded from /home/ubuntu/salonista/.env.
# Exits non-zero only on actual backup failure; missing S3 config = warn + continue.
```

Layout:
```
/home/ubuntu/backups/
  db/      salonista_YYYY-MM-DD_HHMM.dump        # pg_dump -Fc
  uploads/ uploads_YYYY-MM-DD_HHMM.tar.gz
  backup.log                                     # tee'd
  .last-backup                                   # touchfile read by /admin banner
  .last-s3-error                                 # touchfile if S3 sync failed
```

Phases (each `set -e` stops on error, logs via `tee -a`):
1. **Parse** `DATABASE_URL` from `.env` → `PG*` env exports.
2. **`pg_dump -Fc`** → `db/salonista_YYYY-MM-DD_HHMM.dump`. Verify with `pg_restore --list`; if listing fails, delete partial dump and exit non-zero.
3. **`tar czf`** of `public/uploads/` → `uploads/uploads_YYYY-MM-DD_HHMM.tar.gz`.
4. **Retention prune**: 14 daily + 8 Sunday weekly, applied to both directories. Pure bash, `find -mtime` + Sunday allow-list. Idempotent.
5. **Optional S3 sync** if `BACKUP_S3_BUCKET` set:
   - Missing `aws` CLI → log warning, skip, exit 0.
   - `aws s3 sync /home/ubuntu/backups/ s3://$BACKUP_S3_BUCKET/$(hostname)/ --delete --exclude "*.log"`.
   - Sync failure → log warning, `touch .last-s3-error`, exit 0. A failed offsite must not kill a successful local backup.
6. **`touch .last-backup`** with the latest dump path inside.

## 2.2 `scripts/deploy/restore.sh`

```
Usage: restore.sh <dump-path>
WARNING: This DROPS and recreates salonista_prod. Confirm by typing 'restore' when prompted.
```
Header docblock + interactive confirm. Body: `pg_restore --clean --if-exists --no-owner -d salonista_prod <dump-path>`. Does NOT restore uploads (operator runs `tar xzf` manually after spot-check).

## 2.3 Cron via `setup-server.sh`

Adds to `/etc/cron.d/salonista-backup`:
```
30 3 * * * ubuntu cd /home/ubuntu/salonista && bash scripts/deploy/backup.sh >> /home/ubuntu/backups/backup.log 2>&1
```
- Cron file written via `cat > …` every setup run — idempotent.
- Creates `/home/ubuntu/backups/{db,uploads}` with `ubuntu:ubuntu`.

## 2.4 `/admin` banner

`src/lib/backup-status.ts` (new) exposes:
```ts
readBackupStatus(): { lastBackupAt: Date | null; s3Configured: boolean; lastS3Error: Date | null }
```
Reads `/home/ubuntu/backups/.last-backup` and `.last-s3-error` mtimes; checks `process.env.BACKUP_S3_BUCKET`.

Banner rendered in `src/app/(dashboard)/admin/layout.tsx` above `<main>`:
- No `.last-backup` ever, or mtime older than 36h → **red**: "Sauvegardes manquantes ou anciennes — vérifier `backup.sh`".
- `s3Configured === false` → **amber**: "Sauvegardes locales uniquement — pas d'offsite configuré. Voir `scripts/deploy/README.md`."
- `lastS3Error` newer than `lastBackupAt` → **amber**: "Dernière synchro S3 en échec — voir `backup.log`."
- All green → no banner.

## 2.5 AWS provisioning runbook

New section in `scripts/deploy/README.md`:
1. Create private bucket `salonista-backups-<account>` in `eu-west-1`.
2. Lifecycle policy: `GLACIER_IR` at 30 days, `Expiration` at 365 days, `NoncurrentVersionExpiration` at 7 days.
3. IAM user `salonista-backup-writer`, programmatic only.
4. Inline policy (least privilege):
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Action": ["s3:PutObject", "s3:ListBucket", "s3:GetObject", "s3:DeleteObject"],
       "Resource": [
         "arn:aws:s3:::salonista-backups-<account>",
         "arn:aws:s3:::salonista-backups-<account>/*"
       ]
     }]
   }
   ```
5. Env vars appended to `/home/ubuntu/salonista/.env`:
   ```
   BACKUP_S3_BUCKET=salonista-backups-<account>
   AWS_ACCESS_KEY_ID=…
   AWS_SECRET_ACCESS_KEY=…
   AWS_REGION=eu-west-1
   ```
6. Smoke test: `aws s3 ls`, then `bash scripts/deploy/backup.sh`, then verify the file lands in S3.

## 2.6 Out of scope
- Encrypting backups at rest beyond default S3 SSE-S3.
- Backing up Nginx config / Let's Encrypt certs (reproducible from deploy scripts).
- Restore-to-staging job.

---

# Section 3 — PIN brute-force + POS idle lock + IndexedDB wipe

## 3.1 DB-persisted PIN lockout

Migration `20260506xxxxxx_pin_lockout_rate_limit`:

**`SalonEmployee`** — additive:
```prisma
pinFailedAttempts  Int       @default(0)
pinLockedUntil     DateTime?
```

**New `RateLimitEntry`** — generic, also used by 3.2:
```prisma
model RateLimitEntry {
  key         String   @id            // "resolve:ip:1.2.3.4"
  count       Int      @default(0)
  windowStart DateTime
  updatedAt   DateTime @updatedAt
  @@index([updatedAt])
}
```

Lockout state machine inside `auth.ts` salon-pin `authorize`:
1. Load employee. Missing / inactive / no pinHash → `"PIN incorrect"`.
2. `pinLockedUntil > now()` → `"Compte verrouillé — réessayez dans quelques minutes"`. **Never compare PIN when locked** (timing leak).
3. Compare PIN.
   - Match: update `{ pinFailedAttempts: 0, pinLockedUntil: null, lastLoginAt: now() }`. Return session.
   - Mismatch:
     - `newCount = pinFailedAttempts + 1`
     - if `newCount >= 5`: update `{ pinFailedAttempts: 0, pinLockedUntil: now() + 5min }` — counter intentionally reset so that the next post-lockout window starts fresh
     - else: update `{ pinFailedAttempts: newCount }`
     - throw `"PIN incorrect"`

Distinct error strings only appear **after** the 5th failure — attacker cannot tell from messages how close they are to lockout. Lockout message is intentionally vague on remaining time.

Same lockout fields apply to the relock-verify endpoint (3.3) — single counter shared.

## 3.2 `/api/salon-pin/resolve` rate limit (DB-backed)

Replace in-memory `ipHits` Map with `src/lib/rate-limit.ts`:
```ts
async function checkRateLimit(key: string, max: number, windowMs: number):
  Promise<{ ok: boolean; resetIn: number }>
```
- Upsert on `RateLimitEntry`.
- If `windowStart + windowMs < now()` → reset to 1, roll window.
- Else increment; `count > max` → `{ ok: false, resetIn }`.
- Opportunistic prune every ~50th call: `deleteMany where updatedAt < now() - 24h`.

Resolve route: `checkRateLimit("resolve:ip:" + ip, 10, 10 * 60 * 1000)`. 429 with French message on rejection.

Survives `pm2 reload` — the brief's primary complaint.

## 3.3 POS idle lock

### Constants
`src/lib/pos-constants.ts` (new):
```ts
export const POS_IDLE_LOCK_MS = 4 * 60 * 1000;
export const POS_PIN_LOCKOUT_MAX_ATTEMPTS = 5;
export const POS_PIN_LOCKOUT_DURATION_MS = 5 * 60 * 1000;
```

### Shared numpad
`src/components/pos/numpad.tsx` (new) — extracted from `/salon-pin`. Used in:
- `/salon-pin` (refactor to use the shared component)
- The new idle-lock overlay

### `src/components/pos/idle-lock.tsx` (new)
Mounted in the `(pos)` layout. Client component. Subscribes:
- `pointerdown` / `keydown` / `touchstart` on `window` → `lastActivityAt = Date.now()`.
- `visibilitychange` on `document` → on `visible`, if `Date.now() - lastActivityAt > POS_IDLE_LOCK_MS` then lock immediately (B1).
- `setInterval(check, 30_000)` while visible.

When threshold crossed:
- **Defer (A1)**: if `usePosStore.charge.modalOpen === true` OR `usePosStore.charge.postingChargeId != null`, do nothing. **Do not reset `lastActivityAt`** — once the modal closes, lock fires immediately.
- Else mount full-screen overlay (`data-pos-theme`, `z-[100]` — above charge modal).

### Overlay UX
- Greys POS behind; no opt-out.
- Header: employee `displayName` + avatar tile color.
- `<Numpad>` requesting 4-digit PIN.
- Submit → `POST /api/salon-pin/relock-verify { pin }`:
  - Server uses `requireEmployee()` to identify caller from JWT.
  - Same lockout rules (shared helper extracted: `verifyEmployeePin(employee, pin)`).
  - Success: 200, overlay dismisses, `lastActivityAt = Date.now()`.
  - Failure: 401 French message; lockout: 423 French message.
- Footer link **"Changer d'employé"** → `signOut({ callbackUrl: "/salon-pin" })` — runs through the sign-out path which **also** triggers the pending-sales check from 3.4.

### Edge cases
| Case | Behavior |
|---|---|
| Charge POST in flight at idle timeout | Defer until response received and modal closed |
| Tab backgrounded 10 min, returns | Lock fires within 200ms of `visible` |
| Lock open, charge modal open beneath | The defer rule should make this race impossible. If it happens anyway (e.g. modal opens during the lock-fire callback), the overlay's higher z-index wins and the charge modal remains in DOM, resuming on unlock. |
| PIN locked during idle re-PIN | Overlay stays mounted with lockout error; no auto-retry, no auto-signout |
| Multiple POS tabs open | Each tab tracks its own idle timer (rare; not synced) |
| `useSession()` returns no employee at mount | Overlay does not mount (the `(pos)` layout already gates) |

## 3.4 IndexedDB wipe on sign-out / salon switch (A1 + B1)

### `src/lib/pos-offline-db.ts` new exports
```ts
export async function getPendingSalesCount(): Promise<number>
export async function wipeOfflineDb(): Promise<void>
```
- `getPendingSalesCount` counts the outbox store (B1: sales only, not cart drafts).
- `wipeOfflineDb` calls `indexedDB.deleteDatabase("salonista-pos")`; returns on `onsuccess`.

### `src/lib/pos-signout.ts` (new)
```ts
async function signOutPOS(options: { force?: boolean }):
  Promise<{ blocked?: true; pendingCount?: number }>
```
Sequence:
1. `count = await getPendingSalesCount()`.
2. If `count > 0` AND `!options.force` → `{ blocked: true, pendingCount: count }`. UI modal:
   - Title: **"Synchronisez les ventes en attente avant de vous déconnecter"**
   - Body: `{count} vente(s) non synchronisée(s). Reconnectez-vous au réseau et patientez.`
   - Primary: "Voir les ventes en attente" → `/pos/sync-issues`.
   - Secondary: "Annuler".
   - Owner-only escape hatch (visible iff `session.employee.role === "OWNER"`): text link "Forcer la déconnexion (perte des ventes)" → confirm dialog requiring user to type `EFFACER`. On confirm, recurse with `force: true`.
3. Allowed path: `await wipeOfflineDb()` → `signOut({ callbackUrl: "/salon-pin" })`.

### Salon switch (A1)
Track `currentProviderId` in a small `meta` store inside `pos-offline-db.ts`. On successful `salon-pin` resolve:
- `cached.providerId === resolved.providerId` → no-op, normal sign-in.
- Different → run **same** `signOutPOS()` flow. If blocked: blocking screen for the new operator with the same modal — owner-only escape hatch; otherwise link to `/admin/sync-issues` for the **previous** owner to resolve. PIN sign-in aborted until cleared.

Effect: another salon cannot wipe a competitor's unsynced revenue from the same tablet.

## 3.5 `CONTEXT.md` additions
A "Hardening pass — Section 3" block documenting:
- New schema fields and lockout state machine
- Idle-lock + relock-verify endpoint
- Pending-sales sign-out rule and owner-only force escape hatch
- Salon-switch-blocks-on-pending-sales rule

## 3.6 Test surface
- `lib/rate-limit.test.ts` — pure unit on window math (clock-injected). In-memory upsert mock for behavior.
- `lib/verify-employee-pin.test.ts` — lockout state machine (clock + employee state injected; no DB).
- Manual verification of overlay + sign-out flows documented in PR template.

---

# Section 4 — Vitest coverage for money paths

## 4.1 `src/lib/sale-totals.test.ts`

File already exists. Audit, then add only what's missing. Required cases:

| Case | Why |
|---|---|
| Single line, default 19% TVA — TTC ↔ HT ↔ tax round-trips exact to 3 decimals | Base contract |
| Each TVA rate in use (0 / 7 / 13 / 19) | Tunisia's rates |
| Per-line discount: percent and fixed (DT) | Two paths, both real |
| Fixed line discount > line subtotal → clamps to 0, never negative | Foot-gun |
| Sale-level discount on top of line discounts | Document actual stacking order in source comment block + snapshot-style test |
| Multi-quantity lines — rounding on line total, not per-unit × qty drift | Classic POS bug |
| Tip excluded from taxable base | Compliance |
| Decimal handling — inputs as strings/Decimal, never float; regression `19.999`, `0.1 + 0.2`-analog in millimes | Phase 2 millimes-as-integers contract |

If any added test fails on the current code: failing test commits first, fix commit on top (TDD-style discipline).

## 4.2 Refund logic — extract pure helper

Pull pure parts from `/api/pos/sales/[id]/refunds/route.ts` into `src/lib/refund.ts`:
```ts
export type RefundLine = { lineId: string; quantity: number };
export type RefundComputation = {
  lines: Array<{ lineId: string; quantity: number; refundedHt: bigint; refundedTax: bigint; refundedTtc: bigint }>;
  total: { ht: bigint; tax: bigint; ttc: bigint };
  newSaleStatus: "PAID" | "PARTIALLY_REFUNDED" | "REFUNDED";
};
export function computeRefund(sale: SaleSnapshot, requested: RefundLine[]): RefundComputation;
```

Route handler becomes:
1. Load sale (items + prior refunded amounts).
2. `result = computeRefund(sale, requestedLines)`.
3. Persist inside `$transaction([...])`.

Tests in `src/lib/refund.test.ts`:
- Refunding more than `quantity - refundedQuantity` on a line → throws `RefundError("OVER_REFUND")`; route handler maps to HTTP 400.
- Refund totals recompute tax **proportionally** to the refunded portion (not as a percent of the sale's tax).
- Status transitions: `PAID → PARTIALLY_REFUNDED` at first partial; `→ REFUNDED` when refunded TTC equals original TTC (1-millime tolerance).
- Full refund of every line in one shot: `PAID → REFUNDED` directly (skip `PARTIALLY_REFUNDED`).
- Tip is not refundable line-by-line (separate field).

## 4.3 `src/lib/permissions.test.ts`

- Role defaults — snapshot test against the documented matrix. `defaultPermissionsFor("OWNER")`, `("CASHIER")`, etc. produce exactly the expected set.
- `mergePermissions(role, override)`:
  - `{ grant: ["sales.refund"] }` adds the key.
  - `{ revoke: ["customers.delete"] }` removes the key.
  - Unknown keys in `grant`/`revoke` silently ignored.
  - Empty override → role defaults verbatim.
  - Both grant and revoke containing same key → revoke wins; document in source.

## 4.4 Receipt number — per Question 5

Already atomic (verified by reading source). Per Question 5/A:
- Extract `formatReceiptNumber(date: Date, counter: number): string` — pure.
- Add `/** ATOMICITY AUDIT */` comment block in `receipt-number.ts` pointing at the `upsert` + `increment` lines and stating the row-lock guarantee.

`src/lib/receipt-number.test.ts` (new):
- Format: zero-pad to 4 digits.
- High counter formatting: `S-YYYYMMDD-9999`. Rollover to day N+1 is NOT tested (DB-driven, out of scope per Question 5).
- UTC date math: a date at `23:30 Africa/Tunis` (UTC+1) lands in the correct UTC day component of the string.

## 4.5 CI gate
- Add `"test": "vitest run"` to `package.json` if missing.
- Do NOT add `npm test` to `scripts/deploy/deploy.sh` (1GB box, OOM risk).
- PR template under "Verification": "`npm test` was run locally and is green — paste summary."
- GitHub Actions test job: out of scope for this PR.

## 4.6 Out of scope
- Integration tests against real Postgres.
- E2E POS UI tests.
- Property-based testing.

---

# Section 5 — Convert booking → sale, one-click

## 5.1 Replace the hard reload
Today `calendar-client.tsx:50` does `window.location.href = "/pos"`. Drops Zustand store. After this section, **no** `window.location.href` left in the calendar code path.

New store action:
```ts
prefillFromBooking(booking: BookingForPrefill):
  "applied" | "blocked-by-cart" | "blocked-by-paid-sale"
```
Where:
```ts
type BookingForPrefill = {
  bookingId: string;
  customer: { id: string | null; phone: string | null; displayName: string };
  lines: Array<{
    offerId: string;
    nameSnapshot: string;        // exact name to show
    unitPriceTtc: bigint;        // millimes
    taxRate: number;             // e.g. 0.19
    assignedEmployeeId: string | null;
    quantity: 1;                 // always 1 for booking lines
  }>;
  alreadyPaidSaleId: string | null;
};
```

Status return (not throw) so caller maps to:
- `"applied"` → `router.push("/pos")`.
- `"blocked-by-cart"` → show 3-button confirm (5.2).
- `"blocked-by-paid-sale"` → toast "Déjà encaissée", no navigation.

## 5.2 3-button merge confirm (per Question 6 / A)

When `prefillFromBooking` would clobber an existing cart, `booking-detail-drawer.tsx` shows:

```
Le panier contient déjà des articles

• 2 articles en cours pour [client name]
• Booking à encaisser : [service title]

[ Remplacer ] [ Conserver et fusionner ] [ Annuler ]
```

"Conserver et fusionner" rules:
- Cart lines **not** linked to a booking → kept.
- Cart lines linked to a **different** booking → silently dropped + toast: "L'ancien rendez-vous a été remplacé". Two bookings cannot share a cart.
- Customer:
  - Current cart has no customer → use booking's customer.
  - Current cart has a customer different from booking's customer → keep cart's customer + toast: "Le panier garde son client. Le rendez-vous est joint sans changer de fiche." This is by design — silently overwriting the cashier's chosen fiche is worse than the rare case where a booking is encaissée under a different fiche, and the toast makes the situation surface-able. The cashier can change the fiche manually if needed.
- After merge: `attachedBookingId = booking.bookingId`. Result is indistinguishable from the side-panel "RDV aujourd'hui" path.

Pure helper:
```ts
mergeBookingIntoCart(current: CartState, booking: BookingForPrefill): CartState
```
Unit-tested under `pos-store.test.ts` (new file).

## 5.3 One code path for "attach booking to sale"
Audit: grep for writers of `Sale.bookingId`. After refactor, all writers go through `attachBookingToSale(saleDraft, bookingId)` in `pos-sale-create.ts`. Store's `prefillFromBooking` stages it; `attachBookingToSale` (called inside `createSale`) commits it. No conditional "if from calendar then …".

## 5.4 Edge cases

| Case | Behavior |
|---|---|
| Booking already linked to paid sale | "Encaisser" disabled with tooltip "Déjà encaissée". No navigation. |
| Booking linked to refunded sale | "Encaisser" enabled — customer paying again for re-do. Fresh prefill. |
| Booking lines reference deleted offer | Use snapshot fields (`nameSnapshot`, `unitPriceTtc`). No crash. |
| Offline, booking in cache | Prefill works normally. |
| Offline, booking NOT in cache | Existing offline-blocked message. No regression. |
| Cart has parked state from different employee | Out of scope (no parked-sales feature). Cart draft already per-employee. |

## 5.5 Persisting cart draft across navigation
- `prefillFromBooking` mutates Zustand store.
- Zustand's existing IDB persistence (Phase 2) writes to `cart_draft` keyed by `employeeId` on every change.
- After `router.push("/pos")`, F5 → `(pos)` layout bootstrap rehydrates from `cart_draft`.
- No new persistence code. Verify the existing `cart_draft` schema includes `attachedBookingId`. If not, one-line schema addition.

## 5.6 Test surface
- `pos-store.test.ts` (new) — `mergeBookingIntoCart` pure helper + three return statuses from `prefillFromBooking`.
- Existing `pos-sale-create` test (if present) gains a case asserting `Sale.bookingId` is set after the prefill path.

## 5.7 Out of scope
- Parked-sales feature.
- Letting calendar drawer charge directly (skips cashier review).
- Multi-booking carts.

---

# Acceptance — global

All five tasks must individually pass acceptance as described in their sections. Plus, for the whole PR:
- `npm run lint` clean.
- `npm test` (vitest) green; new tests cover the surface listed in each section.
- `npx tsc --noEmit` clean.
- Manual verification matrix in the PR description filled with screenshots / curl outputs for the items below.

## Manual verification matrix
- [ ] `curl GET /api/payment/verify?code=…` does not change `qrVerified` in DB (verify before/after with psql).
- [ ] `POST /api/payment/verify` without session → 401. With wrong salon's owner → 403. With correct owner → completes. With PIN employee lacking `bookings.edit` → 403. With PIN employee having permission → completes, `qrVerifiedByEmployeeId` recorded.
- [ ] Verification page: scanning a QR shows details without auto-confirm; clicking "Confirmer l'arrivée" with valid session marks verified.
- [ ] `backup.sh` runs manually, produces a `pg_restore --list`-valid dump.
- [ ] Re-running `backup.sh` same day doesn't error.
- [ ] Retention prune verified by `touch -d "20 days ago"` on a fake dump and confirming it's removed.
- [ ] `/admin` banner: red when `.last-backup` missing/old, amber when no S3 configured, amber when `.last-s3-error` newer than backup.
- [ ] 5 wrong PINs locks employee for 5 min; survives `pm2 reload`.
- [ ] `/api/salon-pin/resolve` returns 429 after 10 calls within 10 min from same IP.
- [ ] Idle lock overlay appears after 4 min idle; deferred while charge modal open; backgrounded-then-resumed tab locks immediately.
- [ ] Sign-out with empty queue wipes IndexedDB; sign-out with pending sales blocked.
- [ ] Different-salon PIN resolve on shared tablet with pending sales → blocked screen, owner-only escape hatch.
- [ ] Calendar → booking → "Encaisser" pre-fills cart in one click, no full reload; merge confirm appears when cart has items.
- [ ] Completed sale via prefill path has `Sale.bookingId` set.
- [ ] `npm test` green — paste summary.

---

# Migrations summary

One migration directory, three changes (single commit):
- `Booking.qrVerifiedByEmployeeId` (Section 1)
- `SalonEmployee.pinFailedAttempts` + `SalonEmployee.pinLockedUntil` (Section 3)
- `RateLimitEntry` table (Section 3)

Path: `prisma/migrations/20260506xxxxxx_hardening_pass/migration.sql`.

# Doc updates summary

- `CONTEXT.md` — append "Hardening pass additions" block: T1 new field + employee verifier rule; T2 backup scheme; T3 lockout, idle-lock, IDB-wipe rule, salon-switch rule; T4 tests location; T5 single attach path.
- `scripts/deploy/README.md` — AWS S3 provisioning runbook.

# PR description template

Title: **Hardening pass — QR verify auth, backups, PIN lockout + idle lock, money-path tests, convert-to-sale UX**

```
## What
- /api/payment/verify accepts PIN-employee sessions (with bookings.edit); audit field added; verification page now requires an explicit "Confirmer l'arrivée" click
- Nightly pg_dump + uploads backup (cron 03:30), 14d+8w retention, optional S3 offsite, restore script, /admin banner
- PIN lockout (5 fails / 5 min, DB-persisted), /salon-pin/resolve rate-limit (DB-backed), POS idle lock (4 min) with re-PIN
- IndexedDB wipe on sign-out (blocked if pending sales; owner-only force escape); same on salon-switch
- Vitest coverage: sale-totals, refunds, permissions, receipt-number format
- Convert-to-sale: one-click prefill via store, no hard reload, 3-button merge confirm

## What we deliberately did NOT do
- Split /api/payment/verify into separate GET/POST files. GET is already read-only and ownership is already enforced; splitting would be refactor disguised as security fix.

## Migrations
- Booking.qrVerifiedByEmployeeId
- SalonEmployee.pinFailedAttempts / pinLockedUntil
- RateLimitEntry (new table)

## Verification
[screenshots: verification page before/after confirm, lock overlay, prefilled cart from calendar]
[paste vitest output]
[paste backup.sh log + pg_restore --list output]
```
