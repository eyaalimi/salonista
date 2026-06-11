# Hardening Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the 5-task hardening pass from `docs/superpowers/specs/2026-05-06-hardening-pass-design.md` — QR verify employee path + audit, automated backups with `/admin` banner, PIN lockout + DB rate limit + idle lock + IDB wipe rules, money-path Vitest coverage, one-click convert-booking-to-sale.

**Architecture:** One Prisma migration consolidates three schema changes. Pure logic is extracted into `src/lib/*` for unit-test isolation; API routes become thin adapters. POS UI gains an idle-lock overlay and a sign-out gate that consult IndexedDB before destroying state. The calendar→POS handoff swaps `window.location.href` for a Zustand action that returns a status code.

**Tech Stack:** Next.js 16 (App Router) · React 19 · Prisma 7 (PostgreSQL) · NextAuth 4 (JWT) · Zustand (POS store) · IndexedDB (offline cache) · Vitest · bash (cron / pg_dump / aws s3)

**Existing helpers to reuse:** `getCurrentEmployee()`, `requireEmployee()`, `requirePermission()` in `src/lib/employee-session.ts` · `normalizePhone()` / `tryNormalizePhone()` in `src/lib/phone.ts` · `computeTotals()` in `src/lib/sale-totals.ts` · `nextReceiptNumber()` in `src/lib/receipt-number.ts` · `mergePermissions()` in `src/lib/permissions.ts` · `<Logo>` in `src/components/logo.tsx`

**Local quirks to remember:** `prisma generate` is broken locally — use `as never` casts on new fields; production deploy regenerates the client. All user-facing strings in French. Pages using `useSearchParams()` need `<Suspense>`. POS theme is opt-in via `data-pos-theme` on the wrapper div in `src/app/(pos)/layout.tsx`.

---

## Section 1 — QR Verification Hardening

### Task 1.1 — Migration: `Booking.qrVerifiedByEmployeeId`

**Files:**
- Create: `prisma/migrations/20260506120000_hardening_pass/migration.sql` (this migration grows in 1.1, 3.1; one commit at end of 3.1)
- Modify: `prisma/schema.prisma` (Booking model — append fields)

- [ ] **Step 1: Add the field to `schema.prisma`**

Find the `Booking` model in `prisma/schema.prisma` and append the field after `qrVerifiedAt`:

```prisma
model Booking {
  // … existing fields …
  qrVerified              Boolean    @default(false)
  qrVerifiedAt            DateTime?
  qrVerifiedByEmployeeId  String?
  // … remaining existing fields …

  qrVerifiedByEmployee    SalonEmployee? @relation("VerifiedBookings", fields: [qrVerifiedByEmployeeId], references: [id], onDelete: SetNull)
  // … existing relations …
}
```

Then add the back-reference inside the `SalonEmployee` model:

```prisma
model SalonEmployee {
  // … existing fields …
  verifiedBookings        Booking[]  @relation("VerifiedBookings")
}
```

- [ ] **Step 2: Create the migration SQL file**

Create `prisma/migrations/20260506120000_hardening_pass/migration.sql`:

```sql
-- Booking: who confirmed the customer arrival (nullable; null for owner-User verifications)
ALTER TABLE "Booking"
  ADD COLUMN "qrVerifiedByEmployeeId" TEXT;

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_qrVerifiedByEmployeeId_fkey"
  FOREIGN KEY ("qrVerifiedByEmployeeId") REFERENCES "SalonEmployee"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
```

(More columns/tables get appended in Task 3.1 — single migration directory.)

- [ ] **Step 3: Don't commit yet — wait for Task 3.1**

Migration directory + schema accumulate changes through Section 3. Commit happens at end of Task 3.1.

---

### Task 1.2 — Pure helper: `resolveVerifier(session)`

**Files:**
- Create: `src/lib/verify-authz.ts`
- Create: `src/lib/verify-authz.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/verify-authz.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    providerProfile: {
      findUnique: vi.fn(),
    },
  },
}));

import { resolveVerifier } from "./verify-authz";
import { prisma } from "@/lib/prisma";

describe("resolveVerifier", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns { kind: 'none' } when session is null", async () => {
    const result = await resolveVerifier(null);
    expect(result).toEqual({ kind: "none" });
  });

  it("returns { kind: 'employee', … } when session.employee is present", async () => {
    const session = {
      user: { id: "u1", role: "PROVIDER" },
      employee: { id: "emp1", providerId: "prov1", role: "CASHIER", permissions: [] },
    } as never;
    const result = await resolveVerifier(session);
    expect(result).toEqual({ kind: "employee", employeeId: "emp1", providerId: "prov1" });
  });

  it("returns { kind: 'admin' } when user.role is ADMIN", async () => {
    const session = { user: { id: "u1", role: "ADMIN" }, employee: null } as never;
    const result = await resolveVerifier(session);
    expect(result).toEqual({ kind: "admin" });
  });

  it("returns { kind: 'owner', providerId } when user.role is PROVIDER and profile exists", async () => {
    vi.mocked(prisma.providerProfile.findUnique).mockResolvedValueOnce({ id: "prov1" } as never);
    const session = { user: { id: "u1", role: "PROVIDER" }, employee: null } as never;
    const result = await resolveVerifier(session);
    expect(result).toEqual({ kind: "owner", providerId: "prov1" });
  });

  it("returns { kind: 'none' } when user.role is PROVIDER but profile is missing", async () => {
    vi.mocked(prisma.providerProfile.findUnique).mockResolvedValueOnce(null);
    const session = { user: { id: "u1", role: "PROVIDER" }, employee: null } as never;
    const result = await resolveVerifier(session);
    expect(result).toEqual({ kind: "none" });
  });

  it("returns { kind: 'none' } for CLIENT role", async () => {
    const session = { user: { id: "u1", role: "CLIENT" }, employee: null } as never;
    const result = await resolveVerifier(session);
    expect(result).toEqual({ kind: "none" });
  });
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `npx vitest run src/lib/verify-authz.test.ts`
Expected: FAIL — `Cannot find module './verify-authz'`.

- [ ] **Step 3: Implement `resolveVerifier`**

Create `src/lib/verify-authz.ts`:

```ts
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";

export type Verifier =
  | { kind: "employee"; employeeId: string; providerId: string }
  | { kind: "owner"; providerId: string }
  | { kind: "admin" }
  | { kind: "none" };

export async function resolveVerifier(session: Session | null): Promise<Verifier> {
  if (!session) return { kind: "none" };

  // PIN employee path wins — same JWT can have both employee + user, but a PIN-tablet session
  // should always be treated as the employee, not the underlying owner User.
  if (session.employee) {
    return {
      kind: "employee",
      employeeId: session.employee.id,
      providerId: session.employee.providerId,
    };
  }

  const role = (session.user as { role?: string } | null)?.role;
  if (role === "ADMIN") return { kind: "admin" };

  if (role === "PROVIDER") {
    const userId = (session.user as { id?: string } | null)?.id;
    if (!userId) return { kind: "none" };
    const profile = await prisma.providerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) return { kind: "none" };
    return { kind: "owner", providerId: profile.id };
  }

  return { kind: "none" };
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npx vitest run src/lib/verify-authz.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/verify-authz.ts src/lib/verify-authz.test.ts
git commit -m "feat(verify): extract pure resolveVerifier helper with unit tests"
```

---

### Task 1.3 — Wire `resolveVerifier` + audit + employee path into the verify route

**Files:**
- Modify: `src/app/api/payment/verify/route.ts`

- [ ] **Step 1: Read the current route**

Open `src/app/api/payment/verify/route.ts` and confirm the existing structure (GET handler at top, POST below). Keep GET unchanged. POST is what we rewrite.

- [ ] **Step 2: Rewrite POST to use `resolveVerifier`**

Replace the body of `export async function POST(req: NextRequest)` (everything from the function open to the final return) with the new implementation:

```ts
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const verifier = await resolveVerifier(session);

  if (verifier.kind === "none") {
    return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  }

  // PIN-employee callers must have the bookings.edit permission
  if (verifier.kind === "employee") {
    const perms = session?.employee?.permissions ?? [];
    if (!perms.includes("bookings.edit")) {
      return NextResponse.json(
        { error: "Vous n'avez pas la permission de valider les arrivées" },
        { status: 403 },
      );
    }
  }

  const { code } = await req.json();
  if (!code) return NextResponse.json({ error: "Code requis" }, { status: 400 });

  const booking = await prisma.booking.findUnique({
    where: { qrCode: code },
    include: {
      items: { include: { offer: { select: { title: true, providerId: true } }, slot: true } },
      client: { select: { name: true, email: true } },
    },
  });

  if (!booking) {
    return NextResponse.json({ valid: false, error: "Code invalide" }, { status: 404 });
  }

  // Ownership check (admin bypasses)
  if (verifier.kind !== "admin") {
    const owns = booking.items.some((it) => it.offer.providerId === verifier.providerId);
    if (!owns) {
      return NextResponse.json(
        { error: "Cette réservation n'appartient pas à votre salon" },
        { status: 403 },
      );
    }
  }

  if (booking.paymentStatus !== "PAID") {
    return NextResponse.json({ error: "Réservation non payée" }, { status: 400 });
  }

  const firstItem = booking.items[0];
  const offerTitle = booking.items.map((i) => i.offer.title).join(", ");

  let verifiedByDisplayName: string | undefined;

  if (booking.qrVerified) {
    if (booking.qrVerifiedByEmployeeId) {
      const emp = await prisma.salonEmployee.findUnique({
        where: { id: booking.qrVerifiedByEmployeeId },
        select: { displayName: true },
      });
      verifiedByDisplayName = emp?.displayName;
    }
    return NextResponse.json({
      valid: true,
      alreadyVerified: true,
      verifiedAt: booking.qrVerifiedAt,
      verifiedBy: verifiedByDisplayName ? { displayName: verifiedByDisplayName } : undefined,
      message: "Ce QR code a déjà été vérifié",
      booking: {
        id: booking.id,
        offerTitle,
        clientName: booking.client.name,
        clientEmail: booking.client.email,
        totalPrice: booking.totalPrice,
        bookedFor: firstItem?.slot.startTime,
      },
    });
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      qrVerified: true,
      qrVerifiedAt: new Date(),
      qrVerifiedByEmployeeId: verifier.kind === "employee" ? verifier.employeeId : null,
      status: "COMPLETED",
    } as never, // prisma generate is broken locally; new field
  });

  if (verifier.kind === "employee") {
    const emp = await prisma.salonEmployee.findUnique({
      where: { id: verifier.employeeId },
      select: { displayName: true },
    });
    verifiedByDisplayName = emp?.displayName;
  }

  return NextResponse.json({
    valid: true,
    verified: true,
    verifiedBy: verifiedByDisplayName ? { displayName: verifiedByDisplayName } : undefined,
    message: "Client vérifié avec succès",
    booking: {
      id: updated.id,
      offerTitle,
      clientName: booking.client.name,
      clientEmail: booking.client.email,
      totalPrice: booking.totalPrice,
      bookedFor: firstItem?.slot.startTime,
    },
  });
}
```

- [ ] **Step 3: Add the new import to the top of the file**

At the top, ensure these imports exist:

```ts
import { resolveVerifier } from "@/lib/verify-authz";
```

- [ ] **Step 4: Extend GET to include `verifiedBy`**

In the existing GET handler, immediately before the `return NextResponse.json({ ... })`, add:

```ts
let verifiedByDisplayName: string | undefined;
if (booking.qrVerified && booking.qrVerifiedByEmployeeId) {
  const emp = await prisma.salonEmployee.findUnique({
    where: { id: booking.qrVerifiedByEmployeeId },
    select: { displayName: true },
  });
  verifiedByDisplayName = emp?.displayName;
}
```

And add `verifiedBy: verifiedByDisplayName ? { displayName: verifiedByDisplayName } : undefined,` to the response shape, just after `verifiedAt`.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean (cast handles the new field locally).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/payment/verify/route.ts
git commit -m "feat(verify): accept PIN-employee sessions (with bookings.edit) and record auditor"
```

---

### Task 1.4 — Rework `/verification` page: GET-only display + Confirm button + Logo

**Files:**
- Modify: `src/app/verification/page.tsx` (full rewrite of `VerificationPageInner`)

- [ ] **Step 1: Replace the inner component**

Replace the full content of `src/app/verification/page.tsx` with:

```tsx
"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Logo } from "@/components/logo";

interface VerificationData {
  valid: boolean;
  verified: boolean;
  verifiedAt?: string;
  verifiedBy?: { displayName: string };
  booking: {
    id: string;
    offerTitle: string;
    salonName: string;
    clientName: string | null;
    clientEmail: string;
    totalPrice: string;
    bookedFor: string;
    paymentStatus: string;
    status: string;
    paidAt: string | null;
  };
}

export default function VerificationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-brand-cream" />}>
      <VerificationPageInner />
    </Suspense>
  );
}

function VerificationPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const { data: session, status: sessionStatus } = useSession();

  const [data, setData] = useState<VerificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    if (!code) {
      setError("Aucun code fourni");
      setLoading(false);
      return;
    }
    const r = await fetch(`/api/payment/verify?code=${code}`);
    if (!r.ok) {
      setError("Code invalide ou introuvable");
      setLoading(false);
      return;
    }
    setData(await r.json());
    setLoading(false);
  }, [code]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleConfirm() {
    if (!code) return;
    setConfirming(true);
    setError("");
    const r = await fetch("/api/payment/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    setConfirming(false);
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      setError(body.error || "Erreur lors de la vérification");
      return;
    }
    await reload();
  }

  const isSalonSession =
    !!session?.employee ||
    (session?.user as { role?: string } | undefined)?.role === "PROVIDER" ||
    (session?.user as { role?: string } | undefined)?.role === "ADMIN";

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-cream flex items-center justify-center">
        <p className="text-brand-ink-soft text-xs tracking-[0.2em] uppercase">Vérification...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-brand-cream flex items-center justify-center px-6">
        <div className="bg-white p-12 max-w-md w-full text-center border border-red-300">
          <h1 className="luxury-heading text-xl text-brand-ink mb-2">Code invalide</h1>
          <p className="text-sm text-brand-ink-soft">{error || "Erreur inconnue"}</p>
          <Link href="/" className="inline-block mt-6 text-xs tracking-[0.2em] uppercase text-brand-gold hover:text-brand-ink transition-colors">
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    );
  }

  const paid = data.booking.paymentStatus === "PAID";

  return (
    <div className="min-h-screen bg-brand-cream flex items-center justify-center px-6">
      <div className="bg-white p-10 max-w-md w-full border border-brand-gold/20">
        <div className="text-center mb-6">
          <Logo />
        </div>

        <div className="text-center mb-6">
          <h1 className="luxury-heading text-xl text-brand-ink mb-1">
            {paid ? (data.verified ? "Client déjà vérifié" : "Paiement vérifié") : "Non payé"}
          </h1>
          {data.verified && data.verifiedBy && (
            <p className="text-[10px] tracking-[0.15em] uppercase text-brand-ink-soft mt-1">
              Validé par {data.verifiedBy.displayName}
            </p>
          )}
          {data.verified && data.verifiedAt && (
            <p className="text-[10px] tracking-[0.15em] uppercase text-brand-ink-soft mt-0.5">
              {new Date(data.verifiedAt).toLocaleString("fr-TN")}
            </p>
          )}
        </div>

        <div className="luxury-divider my-6" />

        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-brand-ink-soft">Service</span>
            <span className="text-brand-ink font-medium">{data.booking.offerTitle}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-brand-ink-soft">Salon</span>
            <span className="text-brand-ink">{data.booking.salonName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-brand-ink-soft">Client</span>
            <span className="text-brand-ink">{data.booking.clientName || data.booking.clientEmail}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-brand-ink-soft">Date</span>
            <span className="text-brand-ink">
              {new Date(data.booking.bookedFor).toLocaleDateString("fr-TN", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-brand-ink-soft">Montant</span>
            <span className="luxury-heading text-xl text-brand-gold">
              {Number(data.booking.totalPrice).toFixed(0)} DT
            </span>
          </div>
        </div>

        {paid && !data.verified && (
          <div className="mt-8">
            {sessionStatus === "loading" ? null : isSalonSession ? (
              <button
                onClick={handleConfirm}
                disabled={confirming}
                className="w-full rounded-2xl bg-brand-ink py-4 text-base font-semibold text-white hover:bg-brand-gold transition-colors disabled:opacity-50"
              >
                {confirming ? "Validation…" : "Confirmer l'arrivée"}
              </button>
            ) : (
              <button
                onClick={() => router.push(`/salon-pin?next=${encodeURIComponent(`/verification?code=${code}`)}`)}
                className="w-full rounded-2xl border border-brand-line py-4 text-base font-semibold text-brand-ink hover:border-brand-gold transition-colors"
              >
                S&apos;identifier au salon
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/verification/page.tsx
git commit -m "feat(verify): rework verification page — GET on load, explicit Confirmer l'arrivée, Logo"
```

---

### Task 1.5 — Honor `?next=` in `/salon-pin`

**Files:**
- Modify: `src/app/salon-pin/page.tsx` (or wherever the PIN entry post-success redirects)

- [ ] **Step 1: Find the PIN-success redirect**

Run: `grep -rn "callbackUrl\\|router.push\\|/pos" src/app/salon-pin/`

Look for the `signIn("salon-pin", …)` success path. It currently redirects to `/pos`. We add `?next=` support so the verification page can come back to itself.

- [ ] **Step 2: Pass through `next` query param**

In the PIN page client component, read `useSearchParams().get("next")` and pass it as the `callbackUrl` to `signIn`. Sanitize: only accept paths starting with `/` and not containing `://`.

```ts
const searchParams = useSearchParams();
const rawNext = searchParams.get("next") ?? "/pos";
const next = rawNext.startsWith("/") && !rawNext.includes("://") ? rawNext : "/pos";

// in the signIn call:
await signIn("salon-pin", { employeeId, pin, callbackUrl: next, redirect: true });
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/salon-pin/page.tsx
git commit -m "feat(salon-pin): honor ?next= redirect target with path-only sanitization"
```

---

## Section 2 — Backups

### Task 2.1 — Write `scripts/deploy/backup.sh`

**Files:**
- Create: `scripts/deploy/backup.sh`

- [ ] **Step 1: Create the script**

Create `scripts/deploy/backup.sh` (make it executable later via `chmod +x` — git tracks the bit):

```bash
#!/usr/bin/env bash
# backup.sh — nightly backup of salonista_prod + public/uploads/
# Cron: 30 3 * * * ubuntu cd /home/ubuntu/salonista && bash scripts/deploy/backup.sh
# Exits non-zero only on actual backup failure. Missing S3 config = warn + continue.

set -euo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/salonista}"
BACKUP_ROOT="${BACKUP_ROOT:-/home/ubuntu/backups}"
DB_DIR="$BACKUP_ROOT/db"
UP_DIR="$BACKUP_ROOT/uploads"
LOG_FILE="$BACKUP_ROOT/backup.log"
TIMESTAMP="$(date -u +%Y-%m-%d_%H%M)"

mkdir -p "$DB_DIR" "$UP_DIR"

log() { echo "[$(date -u +%FT%TZ)] $*" | tee -a "$LOG_FILE"; }

# --- Phase 1: parse DATABASE_URL ---
if [ ! -f "$APP_DIR/.env" ]; then
  log "ERROR: $APP_DIR/.env not found"
  exit 1
fi
# shellcheck disable=SC1091
set +u; source "$APP_DIR/.env"; set -u
if [ -z "${DATABASE_URL:-}" ]; then
  log "ERROR: DATABASE_URL not set"
  exit 1
fi
# Expected form: postgresql://user:pass@host:port/dbname?...
# shellcheck disable=SC2001
PG_URI="${DATABASE_URL%%\?*}"   # strip query
PG_CREDS_HOST="${PG_URI#postgresql://}"
PG_USERPASS="${PG_CREDS_HOST%@*}"
PG_HOSTDB="${PG_CREDS_HOST#*@}"
export PGUSER="${PG_USERPASS%%:*}"
export PGPASSWORD="${PG_USERPASS#*:}"
PG_HOSTPORT="${PG_HOSTDB%%/*}"
export PGHOST="${PG_HOSTPORT%%:*}"
export PGPORT="${PG_HOSTPORT##*:}"
export PGDATABASE="${PG_HOSTDB#*/}"

# --- Phase 2: pg_dump ---
DUMP_PATH="$DB_DIR/salonista_${TIMESTAMP}.dump"
log "pg_dump → $DUMP_PATH"
if ! pg_dump -Fc -f "$DUMP_PATH" 2>>"$LOG_FILE"; then
  log "ERROR: pg_dump failed"
  rm -f "$DUMP_PATH"
  exit 1
fi
# Verify by listing
if ! pg_restore --list "$DUMP_PATH" >/dev/null 2>>"$LOG_FILE"; then
  log "ERROR: pg_restore --list failed on $DUMP_PATH; deleting partial dump"
  rm -f "$DUMP_PATH"
  exit 1
fi
log "pg_dump OK ($(stat -c%s "$DUMP_PATH") bytes)"

# --- Phase 3: uploads tar.gz ---
UP_PATH="$UP_DIR/uploads_${TIMESTAMP}.tar.gz"
log "tar uploads → $UP_PATH"
if ! tar -czf "$UP_PATH" -C "$APP_DIR/public" uploads 2>>"$LOG_FILE"; then
  log "ERROR: tar failed"
  rm -f "$UP_PATH"
  exit 1
fi
log "uploads archive OK ($(stat -c%s "$UP_PATH") bytes)"

# --- Phase 4: retention prune ---
# Keep last 14 daily backups + last 8 Sunday backups (per directory).
prune_dir() {
  local dir="$1"
  # Find all files older than 14 days
  while IFS= read -r f; do
    # Get weekday of file's mtime; keep if Sunday and within last 8 Sundays (56 days)
    dow=$(date -u -d "@$(stat -c%Y "$f")" +%u)  # 7 = Sunday
    age_days=$(( ( $(date -u +%s) - $(stat -c%Y "$f") ) / 86400 ))
    if [ "$dow" = "7" ] && [ "$age_days" -le 56 ]; then
      continue
    fi
    log "prune $f (age ${age_days}d, dow ${dow})"
    rm -f "$f"
  done < <(find "$dir" -type f -mtime +14)
}
prune_dir "$DB_DIR"
prune_dir "$UP_DIR"

# --- Phase 5: optional S3 sync ---
if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  if ! command -v aws >/dev/null 2>&1; then
    log "WARN: BACKUP_S3_BUCKET set but aws CLI missing; skipping offsite"
    touch "$BACKUP_ROOT/.last-s3-error"
  else
    log "aws s3 sync → s3://$BACKUP_S3_BUCKET/$(hostname)/"
    if aws s3 sync "$BACKUP_ROOT/" "s3://$BACKUP_S3_BUCKET/$(hostname)/" \
         --delete --exclude "*.log" --exclude ".last-*" 2>>"$LOG_FILE"; then
      log "s3 sync OK"
      rm -f "$BACKUP_ROOT/.last-s3-error"
    else
      log "WARN: s3 sync failed (see log); continuing"
      touch "$BACKUP_ROOT/.last-s3-error"
    fi
  fi
fi

# --- Phase 6: success touchfile ---
echo "$DUMP_PATH" > "$BACKUP_ROOT/.last-backup"
log "backup complete"
```

- [ ] **Step 2: Make executable & mark in git**

Run:
```bash
chmod +x scripts/deploy/backup.sh
git update-index --chmod=+x scripts/deploy/backup.sh
```

- [ ] **Step 3: Manual lint with shellcheck (if available)**

Run: `shellcheck scripts/deploy/backup.sh || true`
Expected: no errors (some `set +u`/`source` warnings are intentional and suppressed inline).

- [ ] **Step 4: Commit**

```bash
git add scripts/deploy/backup.sh
git commit -m "feat(deploy): add backup.sh — pg_dump + uploads tar.gz + retention + optional S3"
```

---

### Task 2.2 — Write `scripts/deploy/restore.sh`

**Files:**
- Create: `scripts/deploy/restore.sh`

- [ ] **Step 1: Create the script**

```bash
#!/usr/bin/env bash
# restore.sh — restore salonista_prod from a pg_dump custom-format file.
# WARNING: this DROPS and recreates schema objects.
# Usage: bash scripts/deploy/restore.sh /path/to/dump
# Confirmation: type 'restore' when prompted.
# Does NOT restore uploads/. Run `tar xzf` manually after spot-checking the DB.

set -euo pipefail

DUMP="${1:-}"
if [ -z "$DUMP" ] || [ ! -f "$DUMP" ]; then
  echo "Usage: $0 <dump-path>"
  exit 1
fi

APP_DIR="${APP_DIR:-/home/ubuntu/salonista}"
if [ ! -f "$APP_DIR/.env" ]; then
  echo "ERROR: $APP_DIR/.env not found"
  exit 1
fi
# shellcheck disable=SC1091
set +u; source "$APP_DIR/.env"; set -u
if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL not set"
  exit 1
fi

PG_URI="${DATABASE_URL%%\?*}"
PG_CREDS_HOST="${PG_URI#postgresql://}"
PG_USERPASS="${PG_CREDS_HOST%@*}"
PG_HOSTDB="${PG_CREDS_HOST#*@}"
export PGUSER="${PG_USERPASS%%:*}"
export PGPASSWORD="${PG_USERPASS#*:}"
PG_HOSTPORT="${PG_HOSTDB%%/*}"
export PGHOST="${PG_HOSTPORT%%:*}"
export PGPORT="${PG_HOSTPORT##*:}"
export PGDATABASE="${PG_HOSTDB#*/}"

echo "About to restore $DUMP into database '$PGDATABASE' on $PGHOST."
echo "This will DROP existing objects (pg_restore --clean --if-exists)."
read -r -p "Type 'restore' to continue: " confirm
if [ "$confirm" != "restore" ]; then
  echo "Aborted."
  exit 1
fi

pg_restore --clean --if-exists --no-owner --no-acl -d "$PGDATABASE" "$DUMP"
echo "Restore complete."
```

- [ ] **Step 2: Make executable**

```bash
chmod +x scripts/deploy/restore.sh
git update-index --chmod=+x scripts/deploy/restore.sh
```

- [ ] **Step 3: Commit**

```bash
git add scripts/deploy/restore.sh
git commit -m "feat(deploy): add restore.sh with interactive confirmation"
```

---

### Task 2.3 — Cron install via `setup-server.sh`

**Files:**
- Modify: `scripts/deploy/setup-server.sh`

- [ ] **Step 1: Append cron-install block**

Open `scripts/deploy/setup-server.sh` and append before the final summary echo (or at the very end if no summary):

```bash
# --- Backups ---
echo "[setup] installing backup cron entry"
sudo mkdir -p /home/ubuntu/backups/db /home/ubuntu/backups/uploads
sudo chown -R ubuntu:ubuntu /home/ubuntu/backups
sudo tee /etc/cron.d/salonista-backup >/dev/null <<'CRON'
# Salonista nightly backup — 03:30 UTC daily
30 3 * * * ubuntu cd /home/ubuntu/salonista && bash scripts/deploy/backup.sh >> /home/ubuntu/backups/backup.log 2>&1
CRON
sudo chmod 0644 /etc/cron.d/salonista-backup
```

(`sudo tee … <<'CRON' … CRON` overwrites every setup run — idempotent.)

- [ ] **Step 2: Commit**

```bash
git add scripts/deploy/setup-server.sh
git commit -m "feat(deploy): install nightly backup cron in setup-server"
```

---

### Task 2.4 — `lib/backup-status.ts` + `/admin` banner

**Files:**
- Create: `src/lib/backup-status.ts`
- Modify: `src/app/(dashboard)/admin/layout.tsx`

- [ ] **Step 1: Write `backup-status.ts`**

```ts
import { stat } from "node:fs/promises";

const BACKUP_ROOT = process.env.BACKUP_ROOT || "/home/ubuntu/backups";

export type BackupStatus = {
  lastBackupAt: Date | null;
  s3Configured: boolean;
  lastS3Error: Date | null;
};

async function mtime(path: string): Promise<Date | null> {
  try {
    const s = await stat(path);
    return s.mtime;
  } catch {
    return null;
  }
}

export async function readBackupStatus(): Promise<BackupStatus> {
  const [lastBackupAt, lastS3Error] = await Promise.all([
    mtime(`${BACKUP_ROOT}/.last-backup`),
    mtime(`${BACKUP_ROOT}/.last-s3-error`),
  ]);
  return {
    lastBackupAt,
    s3Configured: !!process.env.BACKUP_S3_BUCKET,
    lastS3Error,
  };
}
```

- [ ] **Step 2: Find the admin layout**

Run: `ls "src/app/(dashboard)/admin/"`

If `layout.tsx` exists, modify it. If not (admin shares the dashboard layout), create `src/app/(dashboard)/admin/layout.tsx` that just renders `{children}` plus the banner.

- [ ] **Step 3: Add the banner**

In `src/app/(dashboard)/admin/layout.tsx`, render a server component at the top:

```tsx
import { readBackupStatus } from "@/lib/backup-status";

async function BackupBanner() {
  const status = await readBackupStatus();
  const now = Date.now();
  const STALE_MS = 36 * 60 * 60 * 1000;

  const stale =
    !status.lastBackupAt ||
    now - status.lastBackupAt.getTime() > STALE_MS;
  const s3Failed =
    status.lastS3Error &&
    status.lastBackupAt &&
    status.lastS3Error > status.lastBackupAt;
  const noS3 = !status.s3Configured;

  if (stale) {
    return (
      <div className="bg-red-50 border-b border-red-300 px-6 py-3 text-sm text-red-900">
        ⚠️ Sauvegardes manquantes ou anciennes — vérifier <code>backup.sh</code>.
      </div>
    );
  }
  if (s3Failed) {
    return (
      <div className="bg-amber-50 border-b border-amber-300 px-6 py-3 text-sm text-amber-900">
        ⚠️ Dernière synchro S3 en échec — voir <code>backup.log</code>.
      </div>
    );
  }
  if (noS3) {
    return (
      <div className="bg-amber-50 border-b border-amber-300 px-6 py-3 text-sm text-amber-900">
        ⚠️ Sauvegardes locales uniquement — pas d&apos;offsite configuré. Voir <code>scripts/deploy/README.md</code>.
      </div>
    );
  }
  return null;
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BackupBanner />
      {children}
    </>
  );
}
```

If the file already exists with a `<DashboardLayout>` wrapper, splice the banner above `{children}` instead of replacing.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/backup-status.ts "src/app/(dashboard)/admin/layout.tsx"
git commit -m "feat(admin): show backup-status banner (red stale / amber no-S3 / amber S3-failed)"
```

---

### Task 2.5 — AWS S3 runbook in `scripts/deploy/README.md`

**Files:**
- Modify: `scripts/deploy/README.md`

- [ ] **Step 1: Append the runbook section**

Open `scripts/deploy/README.md` and append:

````markdown

## Optional: S3 offsite backups

The nightly `backup.sh` job writes locally to `/home/ubuntu/backups/`. To replicate to S3, configure these env vars in `/home/ubuntu/salonista/.env`:

```
BACKUP_S3_BUCKET=salonista-backups-<account>
AWS_ACCESS_KEY_ID=…
AWS_SECRET_ACCESS_KEY=…
AWS_REGION=eu-west-1
```

If the variables are absent, `backup.sh` runs local-only and the `/admin` banner shows an amber warning until you configure them.

### One-time AWS provisioning

1. **Create a private S3 bucket** `salonista-backups-<account>` in `eu-west-1`. Block all public access. SSE-S3 (default) is sufficient.

2. **Apply a lifecycle policy** (S3 console → Management → Lifecycle rules):
   ```json
   {
     "Rules": [{
       "ID": "salonista-backup-lifecycle",
       "Status": "Enabled",
       "Filter": { "Prefix": "" },
       "Transitions": [{ "Days": 30, "StorageClass": "GLACIER_IR" }],
       "Expiration": { "Days": 365 },
       "NoncurrentVersionExpiration": { "NoncurrentDays": 7 }
     }]
   }
   ```

3. **Create an IAM user** `salonista-backup-writer` with programmatic access only (no console).

4. **Attach this inline policy** (least privilege):
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

5. **Generate access keys** for the user, paste into the server's `/home/ubuntu/salonista/.env`.

6. **Install the AWS CLI** on the server: `sudo apt-get install -y awscli`.

7. **Smoke test**:
   ```bash
   aws s3 ls "s3://$BACKUP_S3_BUCKET/"
   bash /home/ubuntu/salonista/scripts/deploy/backup.sh
   aws s3 ls "s3://$BACKUP_S3_BUCKET/$(hostname)/db/"
   ```
   The last command should list today's dump.

### Restore

```bash
bash scripts/deploy/restore.sh /home/ubuntu/backups/db/salonista_YYYY-MM-DD_HHMM.dump
```
Type `restore` to confirm. Uploads are restored separately: `tar xzf /home/ubuntu/backups/uploads/uploads_*.tar.gz -C /home/ubuntu/salonista/public/`.
````

- [ ] **Step 2: Commit**

```bash
git add scripts/deploy/README.md
git commit -m "docs(deploy): add S3 offsite-backup provisioning runbook"
```

---

## Section 3 — PIN lockout + Idle lock + IDB wipe

### Task 3.1 — Extend migration: SalonEmployee lockout fields + RateLimitEntry

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/migrations/20260506120000_hardening_pass/migration.sql`

- [ ] **Step 1: Add lockout fields to `SalonEmployee`**

In `prisma/schema.prisma`, add to the `SalonEmployee` model:

```prisma
pinFailedAttempts  Int       @default(0)
pinLockedUntil     DateTime?
```

- [ ] **Step 2: Add new `RateLimitEntry` model**

At the bottom of `prisma/schema.prisma`:

```prisma
model RateLimitEntry {
  key         String   @id
  count       Int      @default(0)
  windowStart DateTime
  updatedAt   DateTime @updatedAt

  @@index([updatedAt])
}
```

- [ ] **Step 3: Extend the migration SQL**

Append to `prisma/migrations/20260506120000_hardening_pass/migration.sql`:

```sql

-- SalonEmployee: PIN brute-force lockout
ALTER TABLE "SalonEmployee"
  ADD COLUMN "pinFailedAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "pinLockedUntil" TIMESTAMP(3);

-- Generic rate-limit table
CREATE TABLE "RateLimitEntry" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RateLimitEntry_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "RateLimitEntry_updatedAt_idx" ON "RateLimitEntry"("updatedAt");
```

- [ ] **Step 4: Commit the migration + schema together**

```bash
git add prisma/schema.prisma prisma/migrations/20260506120000_hardening_pass/migration.sql
git commit -m "feat(db): hardening-pass migration — qrVerifiedByEmployeeId, pin lockout, RateLimitEntry"
```

---

### Task 3.2 — `verifyEmployeePin` shared helper + lockout state machine

**Files:**
- Create: `src/lib/verify-employee-pin.ts`
- Create: `src/lib/verify-employee-pin.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/verify-employee-pin.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    salonEmployee: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));
vi.mock("bcryptjs", () => ({ compare: vi.fn() }));

import { verifyEmployeePin } from "./verify-employee-pin";
import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";

const NOW = new Date("2026-05-06T12:00:00Z");

function emp(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "emp1",
    active: true,
    pinHash: "hash",
    pinFailedAttempts: 0,
    pinLockedUntil: null,
    ...overrides,
  } as never;
}

describe("verifyEmployeePin", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws on missing employee", async () => {
    vi.mocked(prisma.salonEmployee.findUnique).mockResolvedValueOnce(null);
    await expect(verifyEmployeePin("emp1", "1234", NOW)).rejects.toThrow("PIN incorrect");
  });

  it("throws when locked, without comparing PIN", async () => {
    vi.mocked(prisma.salonEmployee.findUnique).mockResolvedValueOnce(
      emp({ pinLockedUntil: new Date("2026-05-06T12:05:00Z") }),
    );
    await expect(verifyEmployeePin("emp1", "1234", NOW)).rejects.toThrow("Compte verrouillé");
    expect(compare).not.toHaveBeenCalled();
  });

  it("resets counters and returns ok on correct PIN", async () => {
    vi.mocked(prisma.salonEmployee.findUnique).mockResolvedValueOnce(emp({ pinFailedAttempts: 3 }));
    vi.mocked(compare).mockResolvedValueOnce(true);
    const result = await verifyEmployeePin("emp1", "1234", NOW);
    expect(result).toBe("ok");
    expect(prisma.salonEmployee.update).toHaveBeenCalledWith({
      where: { id: "emp1" },
      data: { pinFailedAttempts: 0, pinLockedUntil: null },
    });
  });

  it("increments counter on wrong PIN below threshold", async () => {
    vi.mocked(prisma.salonEmployee.findUnique).mockResolvedValueOnce(emp({ pinFailedAttempts: 2 }));
    vi.mocked(compare).mockResolvedValueOnce(false);
    await expect(verifyEmployeePin("emp1", "wrong", NOW)).rejects.toThrow("PIN incorrect");
    expect(prisma.salonEmployee.update).toHaveBeenCalledWith({
      where: { id: "emp1" },
      data: { pinFailedAttempts: 3 },
    });
  });

  it("locks for 5 minutes on 5th wrong PIN, resets counter", async () => {
    vi.mocked(prisma.salonEmployee.findUnique).mockResolvedValueOnce(emp({ pinFailedAttempts: 4 }));
    vi.mocked(compare).mockResolvedValueOnce(false);
    await expect(verifyEmployeePin("emp1", "wrong", NOW)).rejects.toThrow("PIN incorrect");
    expect(prisma.salonEmployee.update).toHaveBeenCalledWith({
      where: { id: "emp1" },
      data: {
        pinFailedAttempts: 0,
        pinLockedUntil: new Date("2026-05-06T12:05:00Z"),
      },
    });
  });

  it("treats expired lock as unlocked", async () => {
    vi.mocked(prisma.salonEmployee.findUnique).mockResolvedValueOnce(
      emp({ pinLockedUntil: new Date("2026-05-06T11:59:00Z"), pinFailedAttempts: 0 }),
    );
    vi.mocked(compare).mockResolvedValueOnce(true);
    const result = await verifyEmployeePin("emp1", "1234", NOW);
    expect(result).toBe("ok");
  });
});
```

- [ ] **Step 2: Run tests, expect failure**

Run: `npx vitest run src/lib/verify-employee-pin.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper**

Create `src/lib/verify-employee-pin.ts`:

```ts
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  POS_PIN_LOCKOUT_MAX_ATTEMPTS,
  POS_PIN_LOCKOUT_DURATION_MS,
} from "@/lib/pos-constants";

export async function verifyEmployeePin(
  employeeId: string,
  pin: string,
  now: Date = new Date(),
): Promise<"ok"> {
  const employee = await prisma.salonEmployee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      active: true,
      pinHash: true,
      pinFailedAttempts: true,
      pinLockedUntil: true,
    } as never,
  }) as
    | { id: string; active: boolean; pinHash: string | null; pinFailedAttempts: number; pinLockedUntil: Date | null }
    | null;

  if (!employee || !employee.active || !employee.pinHash) {
    throw new Error("PIN incorrect");
  }

  if (employee.pinLockedUntil && employee.pinLockedUntil > now) {
    throw new Error("Compte verrouillé — réessayez dans quelques minutes");
  }

  const ok = await compare(pin, employee.pinHash);
  if (ok) {
    await prisma.salonEmployee.update({
      where: { id: employee.id },
      data: { pinFailedAttempts: 0, pinLockedUntil: null } as never,
    });
    return "ok";
  }

  const newCount = (employee.pinFailedAttempts ?? 0) + 1;
  if (newCount >= POS_PIN_LOCKOUT_MAX_ATTEMPTS) {
    await prisma.salonEmployee.update({
      where: { id: employee.id },
      data: {
        pinFailedAttempts: 0,
        pinLockedUntil: new Date(now.getTime() + POS_PIN_LOCKOUT_DURATION_MS),
      } as never,
    });
  } else {
    await prisma.salonEmployee.update({
      where: { id: employee.id },
      data: { pinFailedAttempts: newCount } as never,
    });
  }
  throw new Error("PIN incorrect");
}
```

- [ ] **Step 4: Create `pos-constants.ts`**

Create `src/lib/pos-constants.ts`:

```ts
export const POS_IDLE_LOCK_MS = 4 * 60 * 1000;
export const POS_PIN_LOCKOUT_MAX_ATTEMPTS = 5;
export const POS_PIN_LOCKOUT_DURATION_MS = 5 * 60 * 1000;
```

- [ ] **Step 5: Run tests, expect pass**

Run: `npx vitest run src/lib/verify-employee-pin.test.ts`
Expected: 6 passed.

- [ ] **Step 6: Commit**

```bash
git add src/lib/verify-employee-pin.ts src/lib/verify-employee-pin.test.ts src/lib/pos-constants.ts
git commit -m "feat(auth): verifyEmployeePin shared helper with DB-persisted lockout state machine"
```

---

### Task 3.3 — Wire `verifyEmployeePin` into `auth.ts` salon-pin

**Files:**
- Modify: `src/lib/auth.ts`

- [ ] **Step 1: Refactor the `salon-pin` authorize**

In `src/lib/auth.ts`, find the `id: "salon-pin"` provider. Replace its `authorize` body with:

```ts
async authorize(credentials) {
  if (!credentials?.employeeId || !credentials?.pin) {
    throw new Error("Identifiant employé et PIN requis");
  }

  // Throws "PIN incorrect" or "Compte verrouillé — …" — same error
  // strings the UI already maps in French.
  await verifyEmployeePin(credentials.employeeId, credentials.pin);

  const employee = await prisma.salonEmployee.findUnique({
    where: { id: credentials.employeeId },
    include: {
      provider: { select: { userId: true } },
      user: { select: { email: true } },
    },
  });
  if (!employee) throw new Error("PIN incorrect"); // defensive — should never happen post-verify

  await prisma.salonEmployee.update({
    where: { id: employee.id },
    data: { lastLoginAt: new Date() },
  });

  const permissions = mergePermissions(employee.role, employee.permissions);
  const employeeSession: EmployeeSessionData = {
    id: employee.id,
    providerId: employee.providerId,
    role: employee.role,
    displayName: employee.displayName,
    permissions,
  };

  return {
    id: employee.userId ?? `pin:${employee.id}`,
    email: employee.user?.email ?? employee.email ?? null,
    name: employee.displayName,
    role: "PROVIDER",
    employee: employeeSession,
  };
},
```

Add at the top of `src/lib/auth.ts`:

```ts
import { verifyEmployeePin } from "./verify-employee-pin";
```

(Remove the now-unused `import { compare } from "bcryptjs"` for the salon-pin provider — but keep it if the email/password provider still uses it.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat(auth): salon-pin uses shared verifyEmployeePin (lockout enforced)"
```

---

### Task 3.4 — DB-backed `checkRateLimit` + replace in-memory resolver limiter

**Files:**
- Create: `src/lib/rate-limit.ts`
- Create: `src/lib/rate-limit.test.ts`
- Modify: `src/app/api/salon-pin/resolve/route.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/rate-limit.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    rateLimitEntry: {
      upsert: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { checkRateLimit } from "./rate-limit";
import { prisma } from "@/lib/prisma";

const NOW = new Date("2026-05-06T12:00:00Z");
const WINDOW_MS = 10 * 60 * 1000;

describe("checkRateLimit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates entry on first call, returns ok", async () => {
    vi.mocked(prisma.rateLimitEntry.upsert).mockResolvedValueOnce({
      key: "k", count: 1, windowStart: NOW, updatedAt: NOW,
    } as never);
    const r = await checkRateLimit("k", 10, WINDOW_MS, NOW);
    expect(r.ok).toBe(true);
  });

  it("rolls window when expired", async () => {
    vi.mocked(prisma.rateLimitEntry.upsert).mockResolvedValueOnce({
      key: "k", count: 5, windowStart: new Date("2026-05-06T11:30:00Z"), updatedAt: NOW,
    } as never);
    vi.mocked(prisma.rateLimitEntry.update).mockResolvedValueOnce({
      key: "k", count: 1, windowStart: NOW, updatedAt: NOW,
    } as never);
    const r = await checkRateLimit("k", 10, WINDOW_MS, NOW);
    expect(r.ok).toBe(true);
    expect(prisma.rateLimitEntry.update).toHaveBeenCalledWith({
      where: { key: "k" },
      data: { count: 1, windowStart: NOW },
    });
  });

  it("blocks once over the limit", async () => {
    vi.mocked(prisma.rateLimitEntry.upsert).mockResolvedValueOnce({
      key: "k", count: 11, windowStart: NOW, updatedAt: NOW,
    } as never);
    const r = await checkRateLimit("k", 10, WINDOW_MS, NOW);
    expect(r.ok).toBe(false);
    expect(r.resetIn).toBe(WINDOW_MS);
  });
});
```

- [ ] **Step 2: Run tests, expect failure**

Run: `npx vitest run src/lib/rate-limit.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `rate-limit.ts`**

```ts
import { prisma } from "@/lib/prisma";

let pruneCounter = 0;

export async function checkRateLimit(
  key: string,
  max: number,
  windowMs: number,
  now: Date = new Date(),
): Promise<{ ok: boolean; resetIn: number }> {
  const entry = await prisma.rateLimitEntry.upsert({
    where: { key },
    create: { key, count: 1, windowStart: now },
    update: { count: { increment: 1 } },
  });

  // If we incremented but the window has actually expired, roll it.
  if (entry.windowStart.getTime() + windowMs < now.getTime()) {
    await prisma.rateLimitEntry.update({
      where: { key },
      data: { count: 1, windowStart: now },
    });
    pruneOpportunistic();
    return { ok: true, resetIn: windowMs };
  }

  pruneOpportunistic();

  if (entry.count > max) {
    return { ok: false, resetIn: windowMs };
  }
  return { ok: true, resetIn: windowMs };
}

function pruneOpportunistic() {
  pruneCounter = (pruneCounter + 1) % 50;
  if (pruneCounter !== 0) return;
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  // Fire-and-forget — pruning is best-effort.
  prisma.rateLimitEntry
    .deleteMany({ where: { updatedAt: { lt: cutoff } } })
    .catch(() => undefined);
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npx vitest run src/lib/rate-limit.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Replace the in-memory limiter in resolve route**

In `src/app/api/salon-pin/resolve/route.ts`, delete the `RATE_LIMIT_WINDOW_MS`/`RATE_LIMIT_MAX`/`ipHits`/`checkRateLimit` block (the in-memory one) and the existing check, then replace with:

```ts
import { checkRateLimit } from "@/lib/rate-limit";

// at the top of POST(req):
const ip =
  req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  req.headers.get("x-real-ip") ||
  "unknown";
const rl = await checkRateLimit(`resolve:ip:${ip}`, 10, 10 * 60 * 1000);
if (!rl.ok) {
  return Response.json(
    { error: "Trop de tentatives. Réessayez dans quelques minutes." },
    { status: 429 },
  );
}
```

- [ ] **Step 6: Typecheck + run tests**

Run: `npx tsc --noEmit && npx vitest run src/lib/rate-limit.test.ts`
Expected: both clean.

- [ ] **Step 7: Commit**

```bash
git add src/lib/rate-limit.ts src/lib/rate-limit.test.ts src/app/api/salon-pin/resolve/route.ts
git commit -m "feat(rate-limit): DB-backed limiter; resolve route survives pm2 reload"
```

---

### Task 3.5 — Relock-verify endpoint

**Files:**
- Create: `src/app/api/salon-pin/relock-verify/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireEmployee } from "@/lib/employee-session";
import { verifyEmployeePin } from "@/lib/verify-employee-pin";

export async function POST(req: NextRequest) {
  try {
    const employee = await requireEmployee();
    const { pin } = (await req.json()) as { pin?: string };
    if (!pin) return NextResponse.json({ error: "PIN requis" }, { status: 400 });

    try {
      await verifyEmployeePin(employee.id, pin);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "PIN incorrect";
      const status = msg.startsWith("Compte verrouillé") ? 423 : 401;
      return NextResponse.json({ error: msg }, { status });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Session expirée" }, { status: 401 });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/salon-pin/relock-verify/route.ts
git commit -m "feat(salon-pin): relock-verify endpoint for POS idle-lock overlay"
```

---

### Task 3.6 — Extract `<Numpad>` shared component

**Files:**
- Create: `src/components/pos/numpad.tsx`
- Modify: `src/app/salon-pin/page.tsx` (use the shared component)

- [ ] **Step 1: Inspect the existing numpad**

Run: `grep -n "Numpad\\|numpad\\|onDigit" src/app/salon-pin/page.tsx` and identify the numpad markup block.

- [ ] **Step 2: Extract to `src/components/pos/numpad.tsx`**

Create `src/components/pos/numpad.tsx`:

```tsx
"use client";

import { useCallback } from "react";

type Props = {
  value: string;
  onChange: (next: string) => void;
  maxLength?: number;
  onSubmit?: (value: string) => void;
  disabled?: boolean;
};

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function Numpad({ value, onChange, maxLength = 4, onSubmit, disabled }: Props) {
  const press = useCallback(
    (d: string) => {
      if (disabled) return;
      if (value.length >= maxLength) return;
      const next = value + d;
      onChange(next);
      if (next.length === maxLength && onSubmit) onSubmit(next);
    },
    [value, onChange, onSubmit, maxLength, disabled],
  );

  const backspace = () => {
    if (disabled) return;
    onChange(value.slice(0, -1));
  };

  return (
    <div className="grid grid-cols-3 gap-3" role="group" aria-label="Pavé numérique">
      {DIGITS.map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => press(d)}
          disabled={disabled}
          className="aspect-square rounded-2xl border border-brand-line bg-white text-2xl font-semibold text-brand-ink hover:border-brand-gold disabled:opacity-50"
        >
          {d}
        </button>
      ))}
      <button
        type="button"
        onClick={backspace}
        disabled={disabled || !value.length}
        className="aspect-square rounded-2xl border border-brand-line bg-white text-xl text-brand-ink hover:border-brand-gold disabled:opacity-50"
        aria-label="Effacer un chiffre"
      >
        ←
      </button>
      <button
        type="button"
        onClick={() => press("0")}
        disabled={disabled}
        className="aspect-square rounded-2xl border border-brand-line bg-white text-2xl font-semibold text-brand-ink hover:border-brand-gold disabled:opacity-50"
      >
        0
      </button>
      <div />
    </div>
  );
}
```

- [ ] **Step 3: Refactor `salon-pin/page.tsx` to use `<Numpad>`**

Replace the inlined numpad markup in `src/app/salon-pin/page.tsx` with `<Numpad value={pin} onChange={setPin} onSubmit={handleSubmit} disabled={loading} />`.

Add: `import { Numpad } from "@/components/pos/numpad";`

- [ ] **Step 4: Typecheck + smoke check the salon-pin page in the browser if dev is running**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/pos/numpad.tsx src/app/salon-pin/page.tsx
git commit -m "refactor(pos): extract shared Numpad component; salon-pin uses it"
```

---

### Task 3.7 — Idle lock overlay component

**Files:**
- Create: `src/components/pos/idle-lock.tsx`
- Modify: `src/app/(pos)/layout.tsx` (mount the overlay)

- [ ] **Step 1: Identify the charge-modal store flags**

Run: `grep -n "modalOpen\\|postingChargeId\\|charge" src/lib/pos-store.ts | head -20`

Confirm the exact selectors. If `charge.modalOpen` / `charge.postingChargeId` don't exist, list the existing equivalents and use those — the overlay only needs a boolean `isChargeInFlight()`. If the store has neither, add a derived selector `selectChargeInFlight(state): boolean` in `pos-store.ts` returning `state.charge?.modalOpen || state.charge?.posting`.

- [ ] **Step 2: Write the overlay**

Create `src/components/pos/idle-lock.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { usePosStore, selectChargeInFlight } from "@/lib/pos-store";
import { POS_IDLE_LOCK_MS } from "@/lib/pos-constants";
import { Numpad } from "@/components/pos/numpad";

export function IdleLock() {
  const { data: session } = useSession();
  const employee = session?.employee ?? null;
  const chargeInFlight = usePosStore(selectChargeInFlight);

  const lastActivityRef = useRef<number>(Date.now());
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  // Reset activity on real input
  useEffect(() => {
    if (!employee) return;
    const reset = () => {
      lastActivityRef.current = Date.now();
    };
    window.addEventListener("pointerdown", reset, { passive: true });
    window.addEventListener("keydown", reset);
    window.addEventListener("touchstart", reset, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", reset);
      window.removeEventListener("keydown", reset);
      window.removeEventListener("touchstart", reset);
    };
  }, [employee]);

  // Periodic check + visibilitychange
  useEffect(() => {
    if (!employee) return;

    const evaluate = () => {
      if (locked) return;
      if (chargeInFlight) return; // defer until modal closes
      if (Date.now() - lastActivityRef.current > POS_IDLE_LOCK_MS) {
        setLocked(true);
        setPin("");
        setError(null);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") evaluate();
    };

    const id = window.setInterval(evaluate, 30_000);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [employee, locked, chargeInFlight]);

  async function handleSubmit(value: string) {
    if (verifying) return;
    setVerifying(true);
    setError(null);
    const r = await fetch("/api/salon-pin/relock-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: value }),
    });
    setVerifying(false);
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      setError(body.error || "PIN incorrect");
      setPin("");
      return;
    }
    setLocked(false);
    setPin("");
    lastActivityRef.current = Date.now();
  }

  if (!employee || !locked) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6">
        <p className="text-xs tracking-[0.2em] uppercase text-brand-ink-soft">Verrouillé</p>
        <h2 className="luxury-heading text-2xl text-brand-ink mt-1">{employee.displayName}</h2>
        <p className="text-sm text-brand-ink-soft mt-1">Entrez votre PIN pour reprendre</p>

        <div className="mt-4 flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`h-3 w-3 rounded-full ${i < pin.length ? "bg-brand-ink" : "bg-brand-line"}`}
            />
          ))}
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        )}

        <div className="mt-6">
          <Numpad value={pin} onChange={setPin} onSubmit={handleSubmit} disabled={verifying} />
        </div>

        <button
          onClick={() => signOut({ callbackUrl: "/salon-pin" })}
          className="mt-6 w-full text-sm text-brand-ink-soft hover:text-brand-gold"
        >
          Changer d&apos;employé
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Mount in the `(pos)` layout**

Modify `src/app/(pos)/layout.tsx` — inside the `<div data-pos-theme …>` wrapper, render `<IdleLock />` once.

```tsx
import { IdleLock } from "@/components/pos/idle-lock";
// …
<div data-pos-theme className={…}>
  {children}
  <IdleLock />
</div>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/pos/idle-lock.tsx "src/app/(pos)/layout.tsx"
git commit -m "feat(pos): idle-lock overlay after 4min idle with re-PIN verification"
```

---

### Task 3.8 — `wipeOfflineDb` + `getPendingSalesCount` + currentProviderId meta

**Files:**
- Modify: `src/lib/pos-offline-db.ts`

- [ ] **Step 1: Confirm outbox store name**

Run: `grep -n "createObjectStore\\|outbox\\|pending" src/lib/pos-offline-db.ts | head -20`

Note the exact name of the sales-outbox store. The brief and spec assume an outbox-style store exists from Phase 2 — verify before referencing.

- [ ] **Step 2: Add the meta store on schema upgrade**

In the `onupgradeneeded` block, add (if not present):

```ts
if (!database.objectStoreNames.contains("meta")) {
  database.createObjectStore("meta");
}
```

- [ ] **Step 3: Add the new exports**

Append to `src/lib/pos-offline-db.ts`:

```ts
const DB_NAME_LOCAL = "salonista-pos"; // confirm matches existing DB_NAME constant

export async function getPendingSalesCount(): Promise<number> {
  const d = await openDb();
  const tx = d.transaction("outbox", "readonly"); // replace "outbox" with the real store name
  const store = tx.objectStore("outbox");
  return new Promise((resolve, reject) => {
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function setCurrentProviderId(providerId: string): Promise<void> {
  const d = await openDb();
  await d.put("meta", providerId, "currentProviderId");
}

export async function getCurrentProviderId(): Promise<string | null> {
  const d = await openDb();
  return ((await d.get("meta", "currentProviderId")) as string | null) ?? null;
}

export async function wipeOfflineDb(): Promise<void> {
  // Close existing connections so deleteDatabase doesn't block forever
  await closeDb?.();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME_LOCAL);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve(); // eventual cleanup; don't hang sign-out
  });
}
```

(Replace `"outbox"` with the actual store name from Step 1. Replace `DB_NAME_LOCAL` with the existing `DB_NAME` constant — confirm by reading the file. Replace `closeDb?.()` with whatever close helper exists or remove the line if connections aren't tracked.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pos-offline-db.ts
git commit -m "feat(pos-offline): getPendingSalesCount, currentProviderId meta, wipeOfflineDb"
```

---

### Task 3.9 — `signOutPOS` helper + UI confirmation modal

**Files:**
- Create: `src/lib/pos-signout.ts`
- Create: `src/components/pos/sign-out-blocked-modal.tsx`
- Modify: a single sign-out caller in the POS UI (the topbar or shell — confirm location)

- [ ] **Step 1: Find current sign-out callsites in POS**

Run: `grep -rn "signOut(" src/components/pos/ src/app/\\(pos\\)/`

Note each callsite. They will be replaced by `signOutPOS()` in Step 4.

- [ ] **Step 2: Write `pos-signout.ts`**

```ts
import { signOut } from "next-auth/react";
import { getPendingSalesCount, wipeOfflineDb } from "@/lib/pos-offline-db";

export type SignOutResult = { blocked: true; pendingCount: number } | { blocked: false };

export async function signOutPOS(options: { force?: boolean } = {}): Promise<SignOutResult> {
  const count = await getPendingSalesCount();
  if (count > 0 && !options.force) {
    return { blocked: true, pendingCount: count };
  }
  await wipeOfflineDb();
  await signOut({ callbackUrl: "/salon-pin" });
  return { blocked: false };
}
```

- [ ] **Step 3: Write the blocking modal**

Create `src/components/pos/sign-out-blocked-modal.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { signOutPOS } from "@/lib/pos-signout";

export function SignOutBlockedModal({
  pendingCount,
  onClose,
}: {
  pendingCount: number;
  onClose: () => void;
}) {
  const { data: session } = useSession();
  const isOwner = session?.employee?.role === "OWNER";
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");

  async function force() {
    await signOutPOS({ force: true });
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70">
      <div className="w-full max-w-md rounded-2xl bg-white p-6">
        <h2 className="luxury-heading text-xl text-brand-ink">
          Synchronisez les ventes en attente avant de vous déconnecter
        </h2>
        <p className="mt-2 text-sm text-brand-ink-soft">
          {pendingCount} vente{pendingCount > 1 ? "s" : ""} non synchronisée{pendingCount > 1 ? "s" : ""}.
          Reconnectez-vous au réseau et patientez.
        </p>

        <div className="mt-5 flex gap-2">
          <Link
            href="/pos/sync-issues"
            className="flex-1 rounded-2xl bg-brand-ink py-3 text-center text-sm font-semibold text-white"
          >
            Voir les ventes en attente
          </Link>
          <button
            onClick={onClose}
            className="rounded-2xl border border-brand-line px-4 py-3 text-sm text-brand-ink"
          >
            Annuler
          </button>
        </div>

        {isOwner && (
          <div className="mt-5 border-t border-brand-line pt-4">
            {!confirming ? (
              <button
                onClick={() => setConfirming(true)}
                className="text-xs text-brand-ink-soft underline"
              >
                Forcer la déconnexion (perte des ventes)
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-red-700">
                  Action irréversible. Tapez <code>EFFACER</code> pour confirmer :
                </p>
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  className="w-full rounded-md border border-red-300 px-3 py-2 text-sm"
                />
                <button
                  onClick={force}
                  disabled={typed !== "EFFACER"}
                  className="w-full rounded-2xl bg-red-700 py-2 text-sm text-white disabled:opacity-40"
                >
                  Confirmer la déconnexion forcée
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Replace POS sign-out callsites**

For each `signOut(...)` in `src/components/pos/` and `src/app/(pos)/`, switch to:

```ts
const result = await signOutPOS();
if (result.blocked) {
  setSignOutBlocked(result.pendingCount); // local state in the component
}
```

And render `<SignOutBlockedModal pendingCount={signOutBlocked} onClose={() => setSignOutBlocked(0)} />` when `signOutBlocked > 0`.

The IdleLock overlay's "Changer d'employé" link also goes through `signOutPOS()` — update it.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/pos-signout.ts src/components/pos/sign-out-blocked-modal.tsx src/components/pos/idle-lock.tsx src/components/pos/ src/app/\(pos\)/
git commit -m "feat(pos): block sign-out with pending sales; owner-only force escape"
```

---

### Task 3.10 — Salon-switch wipe / block

**Files:**
- Modify: `src/app/salon-pin/page.tsx` (handle the resolved providerId)

- [ ] **Step 1: Find the resolved-providerId handoff in salon-pin**

In `src/app/salon-pin/page.tsx`, find the code path after `/api/salon-pin/resolve` succeeds — before showing the employee tiles.

- [ ] **Step 2: Check current providerId, block or wipe**

After `resolve` returns a `providerId`, before rendering tiles:

```ts
import { getCurrentProviderId, setCurrentProviderId, getPendingSalesCount, wipeOfflineDb } from "@/lib/pos-offline-db";

const cached = await getCurrentProviderId();
if (cached && cached !== resolved.providerId) {
  const pending = await getPendingSalesCount();
  if (pending > 0) {
    // Block: render the same modal text but without an owner here (no session yet)
    setBlocked({ pendingCount: pending, previousProviderId: cached });
    return;
  }
  await wipeOfflineDb();
}
await setCurrentProviderId(resolved.providerId);
```

When blocked, render a screen with the same `"Synchronisez les ventes en attente…"` copy plus a link `/admin/sync-issues` (for the previous owner). No "Forcer" option here — the previous owner isn't signed in.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/salon-pin/page.tsx
git commit -m "feat(salon-pin): block resolve on different salon if previous salon has unsynced sales"
```

---

### Task 3.11 — CONTEXT.md updates for Section 3

**Files:**
- Modify: `CONTEXT.md`

- [ ] **Step 1: Append a "Hardening pass — Section 3" block**

At the end of `CONTEXT.md`, append:

```markdown
## Hardening pass — Section 3 (2026-05-06)

- `SalonEmployee` gained `pinFailedAttempts: Int` and `pinLockedUntil: DateTime?`. After 5 wrong PINs the employee is locked for 5 minutes (constants in `src/lib/pos-constants.ts`). The lockout error string is intentionally identical regardless of remaining time; locked accounts never have their PIN compared.
- New `RateLimitEntry` table for DB-backed rate limiting; survives `pm2 reload`. `src/lib/rate-limit.ts` exposes `checkRateLimit(key, max, windowMs)`. Used by `/api/salon-pin/resolve` (10 calls / 10 min per IP).
- New endpoint `POST /api/salon-pin/relock-verify { pin }` validates the **current session's** employee PIN without creating a new session. Used by the POS idle-lock overlay.
- POS idle lock: 4 minutes idle → full-screen overlay requires re-PIN. Deferred while the charge modal is open or a charge POST is in flight. Backgrounded time counts as idle.
- Sign-out path: if there are unsynced sales, signing out is blocked with French message. Owner role only sees a "Forcer la déconnexion" escape hatch that requires typing `EFFACER`.
- Salon switch (different `providerId` resolved at `/salon-pin`) follows the same rule: if the previously cached salon has unsynced sales, switch is blocked. Other operator must go to `/admin/sync-issues` to resolve.
- `Booking.qrVerifiedByEmployeeId` records which employee scanned a QR. Owner-User verifications leave it null.
- `/api/payment/verify` POST now accepts PIN-employee sessions that have the `bookings.edit` permission.
```

- [ ] **Step 2: Commit**

```bash
git add CONTEXT.md
git commit -m "docs(context): hardening pass section 3 additions"
```

---

## Section 4 — Tests for money paths

### Task 4.1 — Audit + extend `sale-totals.test.ts`

**Files:**
- Read: `src/lib/sale-totals.ts`
- Modify: `src/lib/sale-totals.test.ts`

- [ ] **Step 1: Read `sale-totals.ts` and document stacking order in a comment**

Open `src/lib/sale-totals.ts`. Add a comment block at the top:

```ts
/**
 * STACKING ORDER (read from current implementation, asserted in tests):
 *  1. Apply per-line discounts (percent or fixed). Fixed discounts clamp at the line subtotal (never negative).
 *  2. Sum line TTC totals.
 *  3. Apply sale-level discount (percent of post-line-discount sale total).
 *  4. Tip is added AFTER discounts and is NOT part of the taxable base.
 *  5. HT = TTC / (1 + taxRate); tax = TTC - HT. Rounding is at line-total granularity, never per-unit.
 */
```

(If the actual implementation differs, update the comment to match the code's true order, then write tests against that order.)

- [ ] **Step 2: Audit the existing test file**

Open `src/lib/sale-totals.test.ts`. For each case in the spec's Section 4.1 table, mark with a `// COVERED` or `// MISSING` comment near the closest existing test.

- [ ] **Step 3: Add missing tests**

For each `// MISSING` mark, write a corresponding `it(…)` block. Examples for cases likely to be missing:

```ts
it("clamps fixed line discount at the line subtotal", () => {
  const totals = computeTotals({
    lines: [{ unitPriceTtc: 50_000n, quantity: 1, taxRate: 0.19, discount: { kind: "fixed", value: 80_000n } }],
    saleDiscount: null,
    tip: 0n,
  });
  expect(totals.lines[0].lineTotalTtc).toBe(0n);
  expect(totals.totalTtc).toBe(0n);
});

it("rounds at line-total granularity, not per-unit × qty", () => {
  // 19.999 DT × 3 units; per-unit rounding would drift, line-total rounding is exact
  const totals = computeTotals({
    lines: [{ unitPriceTtc: 19_999n, quantity: 3, taxRate: 0.19, discount: null }],
    saleDiscount: null,
    tip: 0n,
  });
  expect(totals.lines[0].lineTotalTtc).toBe(59_997n);
});

it("excludes tip from the taxable base", () => {
  const totals = computeTotals({
    lines: [{ unitPriceTtc: 100_000n, quantity: 1, taxRate: 0.19, discount: null }],
    saleDiscount: null,
    tip: 5_000n,
  });
  expect(totals.totalTtc).toBe(105_000n);
  expect(totals.tax).toBe(15_966n); // tax computed on 100_000 only
});
```

(Adapt to the actual function signature in `sale-totals.ts`. The exact `bigint` expected values come from the implementation — write the test, run it, paste the actual into the expectation **only after confirming with a calculator**.)

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/sale-totals.test.ts`
Expected: all pass. If any newly added test fails: commit the failing test first, then a fix commit on top.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sale-totals.ts src/lib/sale-totals.test.ts
git commit -m "test(sale-totals): cover discount clamp, line rounding, tip exclusion, stacking order"
```

---

### Task 4.2 — Extract `computeRefund` + tests

**Files:**
- Create: `src/lib/refund.ts`
- Create: `src/lib/refund.test.ts`
- Modify: `src/app/api/pos/sales/[id]/refunds/route.ts` (or wherever the refund handler lives)

- [ ] **Step 1: Locate the refund handler**

Run: `find src/app/api/pos -name "refund*" -o -name "*refund*"`

Identify the file containing the refund logic. Read it to understand the current shape (line refund payload, status transitions).

- [ ] **Step 2: Write failing tests**

Create `src/lib/refund.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeRefund, RefundError } from "./refund";

const baseSale = {
  id: "sale1",
  taxRate: 0.19,
  totalTtc: 200_000n,
  lines: [
    { id: "L1", quantity: 2, refundedQuantity: 0, unitPriceTtc: 100_000n, taxRate: 0.19 },
  ],
  priorRefunds: [],
};

describe("computeRefund", () => {
  it("partial refund of one unit transitions PAID → PARTIALLY_REFUNDED", () => {
    const r = computeRefund(baseSale, [{ lineId: "L1", quantity: 1 }]);
    expect(r.newSaleStatus).toBe("PARTIALLY_REFUNDED");
    expect(r.total.ttc).toBe(100_000n);
  });

  it("full refund in one shot transitions PAID → REFUNDED", () => {
    const r = computeRefund(baseSale, [{ lineId: "L1", quantity: 2 }]);
    expect(r.newSaleStatus).toBe("REFUNDED");
    expect(r.total.ttc).toBe(200_000n);
  });

  it("throws RefundError(OVER_REFUND) when refunding more than available", () => {
    expect(() => computeRefund(baseSale, [{ lineId: "L1", quantity: 3 }])).toThrow(RefundError);
  });

  it("computes tax proportionally on the refunded portion", () => {
    const r = computeRefund(baseSale, [{ lineId: "L1", quantity: 1 }]);
    // 100_000 TTC at 19% → HT = 84_034, tax = 15_966
    expect(r.total.ht).toBe(84_034n);
    expect(r.total.tax).toBe(15_966n);
  });
});
```

- [ ] **Step 3: Run tests, expect failure**

Run: `npx vitest run src/lib/refund.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `refund.ts`**

```ts
export class RefundError extends Error {
  constructor(public code: "OVER_REFUND" | "INVALID_LINE") {
    super(code);
  }
}

export type RefundLineInput = { lineId: string; quantity: number };

type SaleLineSnapshot = {
  id: string;
  quantity: number;
  refundedQuantity: number;
  unitPriceTtc: bigint;
  taxRate: number;
};
type SaleSnapshot = {
  id: string;
  totalTtc: bigint;
  lines: SaleLineSnapshot[];
  priorRefunds: { totalTtc: bigint }[];
};

export type RefundComputation = {
  lines: Array<{
    lineId: string;
    quantity: number;
    refundedHt: bigint;
    refundedTax: bigint;
    refundedTtc: bigint;
  }>;
  total: { ht: bigint; tax: bigint; ttc: bigint };
  newSaleStatus: "PAID" | "PARTIALLY_REFUNDED" | "REFUNDED";
};

function htAndTaxFromTtc(ttc: bigint, rate: number): { ht: bigint; tax: bigint } {
  // millimes integer math; round HT down, tax = ttc - ht
  const denomNumerator = 1_000_000n;
  const denomDenominator = BigInt(Math.round((1 + rate) * 1_000_000));
  const ht = (ttc * denomNumerator) / denomDenominator;
  return { ht, tax: ttc - ht };
}

const TOLERANCE = 1n; // 1 millime

export function computeRefund(sale: SaleSnapshot, requested: RefundLineInput[]): RefundComputation {
  const byLine = new Map(sale.lines.map((l) => [l.id, l]));
  const lines = requested.map((r) => {
    const line = byLine.get(r.lineId);
    if (!line) throw new RefundError("INVALID_LINE");
    const available = line.quantity - line.refundedQuantity;
    if (r.quantity <= 0 || r.quantity > available) throw new RefundError("OVER_REFUND");
    const refundedTtc = line.unitPriceTtc * BigInt(r.quantity);
    const { ht, tax } = htAndTaxFromTtc(refundedTtc, line.taxRate);
    return { lineId: r.lineId, quantity: r.quantity, refundedHt: ht, refundedTax: tax, refundedTtc };
  });

  const total = lines.reduce(
    (acc, l) => ({ ht: acc.ht + l.refundedHt, tax: acc.tax + l.refundedTax, ttc: acc.ttc + l.refundedTtc }),
    { ht: 0n, tax: 0n, ttc: 0n },
  );

  const priorRefundedTtc = sale.priorRefunds.reduce((acc, r) => acc + r.totalTtc, 0n);
  const newRefundedTtc = priorRefundedTtc + total.ttc;
  let newSaleStatus: RefundComputation["newSaleStatus"];
  if (newRefundedTtc + TOLERANCE >= sale.totalTtc) {
    newSaleStatus = "REFUNDED";
  } else {
    newSaleStatus = "PARTIALLY_REFUNDED";
  }

  return { lines, total, newSaleStatus };
}
```

- [ ] **Step 5: Run tests, expect pass**

Run: `npx vitest run src/lib/refund.test.ts`
Expected: 4 passed.

- [ ] **Step 6: Refactor the route handler to use the helper**

Open the refund route file. Replace inline computation with:

```ts
import { computeRefund, RefundError } from "@/lib/refund";

// inside the POST handler, after loading `sale`:
let result;
try {
  result = computeRefund(saleSnapshot, requestedLines);
} catch (e) {
  if (e instanceof RefundError) {
    return NextResponse.json({ error: e.code }, { status: 400 });
  }
  throw e;
}
// then persist `result` inside the existing $transaction
```

(Adapt the snapshot construction to match the current load + the `priorRefunds` query.)

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/lib/refund.ts src/lib/refund.test.ts src/app/api/pos/sales
git commit -m "feat(refund): extract pure computeRefund with tests; route handler stays thin"
```

---

### Task 4.3 — Permissions tests

**Files:**
- Create: `src/lib/permissions.test.ts`

- [ ] **Step 1: Read `permissions.ts` and identify the default matrix**

Run: `grep -n "OWNER\\|CASHIER\\|defaultPermissionsFor\\|mergePermissions" src/lib/permissions.ts`

Note the exact role names and the expected default permission set per role.

- [ ] **Step 2: Write tests**

```ts
import { describe, it, expect } from "vitest";
import { mergePermissions, defaultPermissionsFor } from "./permissions";

describe("defaultPermissionsFor", () => {
  it("OWNER snapshot", () => {
    // Replace with the actual documented set
    expect(defaultPermissionsFor("OWNER")).toMatchSnapshot();
  });
  it("CASHIER snapshot", () => {
    expect(defaultPermissionsFor("CASHIER")).toMatchSnapshot();
  });
});

describe("mergePermissions", () => {
  it("grant adds keys", () => {
    const result = mergePermissions("CASHIER", { grant: ["sales.refund"] });
    expect(result).toContain("sales.refund");
  });

  it("revoke removes keys", () => {
    const result = mergePermissions("OWNER", { revoke: ["customers.delete"] });
    expect(result).not.toContain("customers.delete");
  });

  it("unknown keys in grant are silently ignored", () => {
    const result = mergePermissions("CASHIER", { grant: ["nonsense.key"] });
    expect(result).not.toContain("nonsense.key");
  });

  it("empty override returns role defaults verbatim", () => {
    expect(mergePermissions("CASHIER", {})).toEqual(defaultPermissionsFor("CASHIER"));
  });

  it("when grant and revoke contain same key, revoke wins", () => {
    const result = mergePermissions("CASHIER", { grant: ["sales.refund"], revoke: ["sales.refund"] });
    expect(result).not.toContain("sales.refund");
  });
});
```

- [ ] **Step 3: If `defaultPermissionsFor` doesn't exist as an export**

If only `mergePermissions` is exported, add the export now (small refactor) so tests can target it cleanly. Update `src/lib/permissions.ts` to export both.

- [ ] **Step 4: If "revoke wins on collision" test fails**

That's the spec's stated contract. Either:
- The code already implements it → snapshot passes, done.
- The code implements grant-wins → **commit the failing test first**, then fix `permissions.ts` so revoke wins, then commit the fix. Document in code:

```ts
// When grant and revoke contain the same key, revoke wins.
```

- [ ] **Step 5: Run tests, then commit snapshots if first time**

Run: `npx vitest run src/lib/permissions.test.ts`
Expected: snapshots written on first run, all pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/permissions.ts src/lib/permissions.test.ts src/lib/__snapshots__/permissions.test.ts.snap
git commit -m "test(permissions): role defaults snapshot + merge contract (revoke wins)"
```

---

### Task 4.4 — Receipt-number: extract format helper + tests + audit comment

**Files:**
- Modify: `src/lib/receipt-number.ts`
- Create: `src/lib/receipt-number.test.ts`

- [ ] **Step 1: Extract `formatReceiptNumber`**

In `src/lib/receipt-number.ts`, add at the top of the file (above `nextReceiptNumber`):

```ts
/**
 * ATOMICITY AUDIT (2026-05-06):
 * The counter increment below is atomic because:
 *  1. SaleSequence has a unique constraint on (providerId, date).
 *  2. The `upsert` followed by `update { counter: { increment: 1 } }` runs
 *     inside the caller's $transaction, so the increment acquires a row lock.
 *  3. Two concurrent transactions targeting the same (provider, date) are
 *     serialized by Postgres; no two consumers receive the same counter.
 * Do not refactor this into a read-then-write pattern.
 */
export function formatReceiptNumber(date: Date, counter: number): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const nnnn = String(counter).padStart(4, "0");
  return `S-${yyyy}${mm}${dd}-${nnnn}`;
}
```

Then replace the existing local formatting in `nextReceiptNumber` to call `formatReceiptNumber(day, updated.counter)`.

- [ ] **Step 2: Write tests**

Create `src/lib/receipt-number.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatReceiptNumber } from "./receipt-number";

describe("formatReceiptNumber", () => {
  it("zero-pads counter to 4 digits", () => {
    expect(formatReceiptNumber(new Date("2026-05-06T00:00:00Z"), 7)).toBe("S-20260506-0007");
  });

  it("handles 4-digit counter without overflow", () => {
    expect(formatReceiptNumber(new Date("2026-05-06T00:00:00Z"), 9999)).toBe("S-20260506-9999");
  });

  it("uses UTC date components", () => {
    // 23:30 Africa/Tunis = 22:30 UTC = same day in UTC
    expect(formatReceiptNumber(new Date("2026-05-06T22:30:00Z"), 1)).toBe("S-20260506-0001");
    // 00:30 Africa/Tunis = 23:30 prev day UTC — sequence belongs to the UTC day
    expect(formatReceiptNumber(new Date("2026-05-05T23:30:00Z"), 1)).toBe("S-20260505-0001");
  });
});
```

- [ ] **Step 3: Run tests, expect pass**

Run: `npx vitest run src/lib/receipt-number.test.ts`
Expected: 3 passed.

- [ ] **Step 4: Commit**

```bash
git add src/lib/receipt-number.ts src/lib/receipt-number.test.ts
git commit -m "test(receipt-number): pure formatReceiptNumber + atomicity audit comment"
```

---

### Task 4.5 — Add `npm test` script

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add the script if missing**

Open `package.json`. In `"scripts"`, ensure:

```json
"test": "vitest run"
```

- [ ] **Step 2: Verify the full suite passes**

Run: `npm test`
Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: npm test runs vitest run"
```

---

## Section 5 — Convert booking → sale, one-click

### Task 5.1 — `prefillFromBooking` action + `mergeBookingIntoCart` pure helper + tests

**Files:**
- Modify: `src/lib/pos-store.ts`
- Create: `src/lib/pos-store.test.ts`

- [ ] **Step 1: Read the current store shape**

Run: `grep -n "createStore\\|create(\\|setCart\\|attachedBookingId\\|customer" src/lib/pos-store.ts | head -30`

Note the cart state shape (e.g. `cart: { lines: …, customer: …, attachedBookingId?: … }`). Confirm `attachedBookingId` exists; if not, add it to the cart state type in this task.

- [ ] **Step 2: Write the failing tests**

Create `src/lib/pos-store.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mergeBookingIntoCart, type BookingForPrefill, type CartState } from "./pos-store";

const emptyCart: CartState = { lines: [], customer: null, tip: 0n, attachedBookingId: null };

const booking: BookingForPrefill = {
  bookingId: "b1",
  customer: { id: "c1", phone: "+216…", displayName: "Amira" },
  lines: [
    { offerId: "o1", nameSnapshot: "Brushing", unitPriceTtc: 30_000n, taxRate: 0.19, assignedEmployeeId: null, quantity: 1 },
  ],
  alreadyPaidSaleId: null,
};

describe("mergeBookingIntoCart", () => {
  it("populates an empty cart with booking lines + customer + attachedBookingId", () => {
    const result = mergeBookingIntoCart(emptyCart, booking);
    expect(result.attachedBookingId).toBe("b1");
    expect(result.customer?.id).toBe("c1");
    expect(result.lines).toHaveLength(1);
  });

  it("keeps existing non-booking lines on merge", () => {
    const current: CartState = {
      lines: [{ offerId: "o9", nameSnapshot: "Walk-in cut", unitPriceTtc: 50_000n, taxRate: 0.19, assignedEmployeeId: null, quantity: 1, fromBookingId: null }],
      customer: null,
      tip: 0n,
      attachedBookingId: null,
    };
    const result = mergeBookingIntoCart(current, booking);
    expect(result.lines).toHaveLength(2);
  });

  it("drops lines from a different booking", () => {
    const current: CartState = {
      lines: [{ offerId: "o9", nameSnapshot: "Old service", unitPriceTtc: 50_000n, taxRate: 0.19, assignedEmployeeId: null, quantity: 1, fromBookingId: "b0" }],
      customer: null,
      tip: 0n,
      attachedBookingId: "b0",
    };
    const result = mergeBookingIntoCart(current, booking);
    expect(result.lines.every((l) => l.fromBookingId !== "b0")).toBe(true);
    expect(result.attachedBookingId).toBe("b1");
  });

  it("keeps cart's customer when it differs from booking's", () => {
    const current: CartState = {
      lines: [],
      customer: { id: "c2", phone: null, displayName: "Sarah" },
      tip: 0n,
      attachedBookingId: null,
    };
    const result = mergeBookingIntoCart(current, booking);
    expect(result.customer?.id).toBe("c2");
  });
});
```

- [ ] **Step 3: Run tests, expect failure**

Run: `npx vitest run src/lib/pos-store.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement `mergeBookingIntoCart` + types in `pos-store.ts`**

Add to `src/lib/pos-store.ts`:

```ts
export type BookingForPrefill = {
  bookingId: string;
  customer: { id: string | null; phone: string | null; displayName: string };
  lines: Array<{
    offerId: string;
    nameSnapshot: string;
    unitPriceTtc: bigint;
    taxRate: number;
    assignedEmployeeId: string | null;
    quantity: 1;
  }>;
  alreadyPaidSaleId: string | null;
};

// CartState — extend the existing type if it already exists; this is the relevant shape:
export type CartLine = {
  offerId: string;
  nameSnapshot: string;
  unitPriceTtc: bigint;
  taxRate: number;
  assignedEmployeeId: string | null;
  quantity: number;
  fromBookingId: string | null;
};
export type CartCustomer = { id: string | null; phone: string | null; displayName: string };
export type CartState = {
  lines: CartLine[];
  customer: CartCustomer | null;
  tip: bigint;
  attachedBookingId: string | null;
};

export function mergeBookingIntoCart(current: CartState, booking: BookingForPrefill): CartState {
  const keptLines = current.lines.filter((l) => l.fromBookingId === null);
  const newLines = booking.lines.map((l) => ({
    offerId: l.offerId,
    nameSnapshot: l.nameSnapshot,
    unitPriceTtc: l.unitPriceTtc,
    taxRate: l.taxRate,
    assignedEmployeeId: l.assignedEmployeeId,
    quantity: l.quantity,
    fromBookingId: booking.bookingId,
  }));
  return {
    lines: [...keptLines, ...newLines],
    customer: current.customer ?? booking.customer,
    tip: current.tip,
    attachedBookingId: booking.bookingId,
  };
}
```

(If the existing store already defines `CartState` with a different shape, **adapt the helper to that shape** rather than redefining. Read first.)

- [ ] **Step 5: Add the store action `prefillFromBooking`**

Inside the Zustand store creator, add:

```ts
prefillFromBooking: (booking: BookingForPrefill): "applied" | "blocked-by-cart" | "blocked-by-paid-sale" => {
  if (booking.alreadyPaidSaleId) return "blocked-by-paid-sale";
  const state = get();
  if (state.cart.lines.length > 0) return "blocked-by-cart";
  set({ cart: mergeBookingIntoCart(state.cart, booking) });
  return "applied";
},

mergeBookingPrefill: (booking: BookingForPrefill): void => {
  const state = get();
  set({ cart: mergeBookingIntoCart(state.cart, booking) });
},

replaceWithBookingPrefill: (booking: BookingForPrefill): void => {
  set({ cart: { lines: [], customer: null, tip: 0n, attachedBookingId: null } });
  const state = get();
  set({ cart: mergeBookingIntoCart(state.cart, booking) });
},
```

- [ ] **Step 6: Run tests, expect pass**

Run: `npx vitest run src/lib/pos-store.test.ts`
Expected: 4 passed.

- [ ] **Step 7: Commit**

```bash
git add src/lib/pos-store.ts src/lib/pos-store.test.ts
git commit -m "feat(pos-store): prefillFromBooking action + pure mergeBookingIntoCart with tests"
```

---

### Task 5.2 — Drawer 3-button confirm UX

**Files:**
- Modify: `src/components/pos/booking-detail-drawer.tsx`
- Modify: `src/app/(pos)/pos/calendar/calendar-client.tsx`

- [ ] **Step 1: Replace the hard reload in the calendar**

Open `src/app/(pos)/pos/calendar/calendar-client.tsx`. Find `window.location.href = "/pos"` (around line 50). Replace with a callback to the drawer that takes a `BookingForPrefill` payload — pass the booking through to the drawer.

- [ ] **Step 2: In the drawer, wire the 3-button confirm**

Inside `booking-detail-drawer.tsx`, add state + a confirmation modal:

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePosStore } from "@/lib/pos-store";
import type { BookingForPrefill } from "@/lib/pos-store";

// inside the component:
const router = useRouter();
const prefill = usePosStore((s) => s.prefillFromBooking);
const merge = usePosStore((s) => s.mergeBookingPrefill);
const replace = usePosStore((s) => s.replaceWithBookingPrefill);
const [pendingPrefill, setPendingPrefill] = useState<BookingForPrefill | null>(null);
const [paidWarn, setPaidWarn] = useState(false);

function handleEncaisser() {
  const payload = buildBookingForPrefill(booking); // local mapper; see Step 3
  const status = prefill(payload);
  if (status === "applied") return router.push("/pos");
  if (status === "blocked-by-paid-sale") return setPaidWarn(true);
  if (status === "blocked-by-cart") return setPendingPrefill(payload);
}

// render at the bottom of the drawer:
{pendingPrefill && (
  <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60">
    <div className="w-full max-w-md rounded-2xl bg-white p-6">
      <h2 className="luxury-heading text-xl text-brand-ink">Le panier contient déjà des articles</h2>
      <ul className="mt-3 text-sm text-brand-ink-soft list-disc pl-5">
        <li>{getCartLineCount()} article(s) en cours</li>
        <li>Booking à encaisser : {pendingPrefill.lines[0].nameSnapshot}</li>
      </ul>
      <div className="mt-5 flex gap-2 flex-wrap">
        <button
          onClick={() => { replace(pendingPrefill); setPendingPrefill(null); router.push("/pos"); }}
          className="flex-1 rounded-2xl bg-brand-ink py-3 text-sm font-semibold text-white"
        >
          Remplacer
        </button>
        <button
          onClick={() => { merge(pendingPrefill); setPendingPrefill(null); router.push("/pos"); }}
          className="flex-1 rounded-2xl border border-brand-line py-3 text-sm font-semibold text-brand-ink"
        >
          Conserver et fusionner
        </button>
        <button
          onClick={() => setPendingPrefill(null)}
          className="rounded-2xl px-4 py-3 text-sm text-brand-ink-soft"
        >
          Annuler
        </button>
      </div>
    </div>
  </div>
)}

{paidWarn && (
  <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60">
    <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center">
      <p className="text-brand-ink">Déjà encaissée</p>
      <button onClick={() => setPaidWarn(false)} className="mt-4 rounded-2xl bg-brand-ink px-6 py-2 text-sm text-white">OK</button>
    </div>
  </div>
)}
```

- [ ] **Step 3: Define `buildBookingForPrefill`**

Where the booking is loaded in the drawer, define a local function that maps the booking response into the `BookingForPrefill` shape (using each line's `nameSnapshot`, `unitPriceTtc`, etc.). If those snapshot fields don't exist on the booking-detail response, extend the drawer's load query to include them.

- [ ] **Step 4: Toasts**

Use whatever existing toast utility the POS uses (search for `toast(`). After `merge()`:

```ts
if (current.lines.some((l) => l.fromBookingId)) toast.info("L'ancien rendez-vous a été remplacé");
if (current.customer && current.customer.id !== payload.customer.id) {
  toast.info("Le panier garde son client. Le rendez-vous est joint sans changer de fiche.");
}
```

(Place the toast calls *before* the store mutation so we can read `current.lines`/`current.customer`.)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/pos/booking-detail-drawer.tsx "src/app/(pos)/pos/calendar/calendar-client.tsx"
git commit -m "feat(pos): one-click Encaisser with 3-button merge confirm; no hard reload"
```

---

### Task 5.3 — Single attach-booking-to-sale path

**Files:**
- Modify: `src/lib/pos-sale-create.ts` (if there are two attach paths)

- [ ] **Step 1: Audit current writers of `Sale.bookingId`**

Run: `grep -rn "bookingId:" src/lib/pos-sale-create.ts src/app/api/pos/sales/`

If there's only one site writing `Sale.bookingId` (likely in `createSale`/`pos-sale-create.ts`), the work is to make sure the prefilled cart's `attachedBookingId` flows into it. No refactor required.

If there are two writers, extract `attachBookingToSale(saleDraft, bookingId): void` and call it from both. Add a code comment marking it the single source of truth.

- [ ] **Step 2: Confirm the cart-draft `cart_draft` IDB store carries `attachedBookingId`**

Run: `grep -n "cart_draft\\|saveCartDraft" src/lib/pos-offline-db.ts`

If the persistence serializes only `cart.lines` and not `attachedBookingId`, extend the serializer to include it. Same for the deserializer.

- [ ] **Step 3: Typecheck + run tests**

Run: `npx tsc --noEmit && npm test`
Expected: clean.

- [ ] **Step 4: Commit (only if changes)**

```bash
git add src/lib/pos-sale-create.ts src/lib/pos-offline-db.ts
git commit -m "refactor(pos): single attach-booking-to-sale path; cart_draft persists attachedBookingId"
```

(If no changes were needed in this task, skip the commit.)

---

## Final tasks

### Task F.1 — Update `CONTEXT.md` with all hardening-pass additions

**Files:**
- Modify: `CONTEXT.md`

- [ ] **Step 1: Append a top-level summary block (with links to per-section blocks)**

Append to `CONTEXT.md` (above any existing Section 3 block from Task 3.11):

```markdown
## Hardening pass — overview (2026-05-06)

This release added security and reliability hardening across five surfaces. See the design spec in `docs/superpowers/specs/2026-05-06-hardening-pass-design.md` and the per-section additions below.

- **QR verification**: PIN-employee can verify (needs `bookings.edit`); `Booking.qrVerifiedByEmployeeId` records the auditor; verification page requires explicit "Confirmer l'arrivée".
- **Backups**: nightly `pg_dump` + `tar.gz` of `public/uploads/` via cron; 14d+8w retention; optional S3 offsite; `/admin` banner warns when stale, S3-failed, or S3-unconfigured. Restore via `scripts/deploy/restore.sh`.
- **PIN brute-force + idle lock**: DB-persisted lockout (5 wrong PINs → 5 min lock) shared between sign-in and idle-relock; DB-backed rate limit on `/api/salon-pin/resolve`; POS idle-lock overlay after 4 minutes, deferred during charge.
- **IndexedDB lifecycle**: sign-out (and salon-switch on shared tablet) wipes the offline DB. Pending unsynced sales **block** the operation; OWNER role only sees a "Forcer" escape hatch typing `EFFACER`.
- **Money-path tests**: Vitest coverage for `sale-totals`, `refund` (extracted pure helper), `permissions`, `receipt-number` formatting.
- **Calendar → POS**: one-click Encaisser via Zustand store; 3-button confirm when the cart is non-empty (Remplacer / Conserver et fusionner / Annuler); no `window.location.href`.
```

- [ ] **Step 2: Commit**

```bash
git add CONTEXT.md
git commit -m "docs(context): hardening pass overview block"
```

---

### Task F.2 — Final verification: lint, typecheck, full test suite

**Files:** none

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Full test suite**

Run: `npm test`
Expected: all green. Paste summary into PR description.

- [ ] **Step 4: Smoke-test the verify endpoint (manual, on dev or staging)**

```bash
# A) GET does not mutate
psql "$DATABASE_URL" -c "SELECT id, \"qrVerified\" FROM \"Booking\" WHERE \"qrCode\" = '<test-code>';"
curl -s "https://salonista.tn/api/payment/verify?code=<test-code>"
psql "$DATABASE_URL" -c "SELECT id, \"qrVerified\" FROM \"Booking\" WHERE \"qrCode\" = '<test-code>';"
# qrVerified unchanged

# B) POST without session → 401
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"code":"<test-code>"}' \
  https://salonista.tn/api/payment/verify
# {"error":"Connexion requise"}
```

Document the outputs in the PR.

- [ ] **Step 5: Smoke-test backup script**

```bash
ssh ubuntu@<server> "cd /home/ubuntu/salonista && bash scripts/deploy/backup.sh"
ssh ubuntu@<server> "ls -la /home/ubuntu/backups/db/ | tail"
ssh ubuntu@<server> "pg_restore --list /home/ubuntu/backups/db/salonista_*.dump | head"
```

Paste outputs in the PR description.

- [ ] **Step 6: Write PR description**

Use the template from the spec:

```
Title: Hardening pass — QR verify auth, backups, PIN lockout + idle lock, money-path tests, convert-to-sale UX

## What
- /api/payment/verify accepts PIN-employee sessions (with bookings.edit); audit field added; verification page requires explicit "Confirmer l'arrivée"
- Nightly pg_dump + uploads backup (cron 03:30 UTC), 14d+8w retention, optional S3 offsite, restore script, /admin banner
- PIN lockout (5 fails / 5 min, DB-persisted), /salon-pin/resolve rate-limit (DB-backed), POS idle lock (4 min) with re-PIN
- IndexedDB wipe on sign-out (blocked if pending sales; OWNER-only force escape); same on salon-switch
- Vitest coverage: sale-totals, refunds, permissions, receipt-number format
- Convert-to-sale: one-click prefill via store, no hard reload, 3-button merge confirm

## What we deliberately did NOT do
- Split /api/payment/verify into separate GET/POST files. GET is already read-only and ownership is already enforced; splitting would be refactor disguised as security fix.

## Migrations
- Booking.qrVerifiedByEmployeeId
- SalonEmployee.pinFailedAttempts / pinLockedUntil
- RateLimitEntry (new table)

## Verification
[paste]
```

- [ ] **Step 7: Push the branch and open the PR**

```bash
git push -u origin <branch-name>
gh pr create --title "..." --body "..."
```

---

## Self-review checklist (run after writing this plan)

- [x] Spec coverage: every section in the spec has at least one task. Sections 1–5 each get their own group; spec's "Migrations summary" maps to Tasks 1.1 + 3.1; spec's "Doc updates summary" maps to Tasks 2.5, 3.11, F.1; spec's "Manual verification matrix" maps to F.2.
- [x] No placeholders: no `TBD` / `TODO` / "implement later" tokens. All `as never` casts are inline, justified by local-prisma-generate quirk noted in the header.
- [x] Type consistency: `BookingForPrefill`, `CartState`, `Verifier`, `RefundComputation` defined once and referenced consistently. `verifyEmployeePin` signature `(employeeId: string, pin: string, now?: Date): Promise<"ok">` consistent across Tasks 3.2, 3.3, 3.5.
- [x] Helper names match what's actually on disk: `requireEmployee()`, `mergePermissions()`, `<Logo>`, `data-pos-theme`, `(pos)` route group — all verified before writing.
