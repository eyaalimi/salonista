# Salonista — Project Context

> **Read this first.** Snapshot of what the project is, how it's built, and how it's deployed. Update it when something changes.

## TL;DR

**Salonista** is a beauty marketplace for Tunisia (`salonista.tn`) connecting three roles:

- **Clients** browse offers, book slots, pay online, get a QR code, present it at the salon.
- **Prestataires (salons)** publish discounted offers with auto-generated time slots and receive bookings.
- **Influenceuses** accept salon collaboration proposals, share unique tracking links on Instagram, earn a commission on each conversion.

There's also an **Admin** role for moderation.

The site is deployed on **Amazon Lightsail Ubuntu** behind **Nginx + PM2**, with a **PostgreSQL** database and **Cloudflare DNS**. Code lives on **GitHub** and a push to `main` triggers SSH-based deploy via GitHub Actions.

---

## Stack

| Layer | Tech |
|---|---|
| Framework | **Next.js 16.2** (App Router, Turbopack) on **Node 20** |
| UI | **React 19**, **Tailwind v4** (single `globals.css`), Playfair Display + Geist Sans |
| Auth | **NextAuth v4** (JWT strategy, credentials + Google) |
| ORM | **Prisma 7** with `@prisma/adapter-pg` |
| DB | **PostgreSQL** (DB name `salonista_prod` in production) |
| Email | **Nodemailer** + Gmail SMTP (App Password) |
| Image hosting | Local `public/uploads/` served by Nginx |
| Deploy | **GitHub Actions** → SSH → bash script on EC2/Lightsail |
| Process mgr | **PM2** with `ecosystem.config.js` |
| TLS | **Let's Encrypt** via certbot |

Important runtime quirk: **Prisma generated client is committed to `src/generated/prisma/`** (custom `output` in `schema.prisma`). On every deploy, `prisma generate` runs and overwrites it — but locally, you may need to regenerate after editing the schema.

---

## Domain model

Six core relationships you must internalize before touching the DB:

1. **User → role-specific profile** (`ProviderProfile`, `InfluencerProfile`). Clients have no profile row.
2. **ProviderProfile → Offer** (1:N). Each offer has a price, category, **`durationMinutes`**, and an array of photo URLs.
3. **Offer → TimeSlot** (1:N). Slots are **auto-generated** from `ProviderProfile.openingHours` (JSON) + `Offer.durationMinutes` for the next 30 days. See `src/lib/slots.ts` and `src/lib/opening-hours.ts`.
4. **Booking → BookingItem → TimeSlot** (multi-service cart). One booking can include multiple consecutive offers from the same salon (Treatwell-style); the API allocates back-to-back slots in a transaction.
5. **CollaborationRequest → CollaborationOffer → TrackingLink**. A salon proposes a multi-offer collab with a single commission %; if the influenceuse accepts, one `TrackingLink` is created per offer (so each offer has its own shareable URL).
6. **TrackingLink → Click → Booking → Commission**. When a client clicks a link, a cookie is set; if they book within 7 days, the commission is attributed to the influencer.

Money math:
- `Commission.platformAmount` = our cut
- `Commission.influencerAmount` = `Booking.totalPrice * commissionPct / 100` (only if attribution exists)
- `Commission.providerAmount` = remainder

---

## Routes overview

### Public
- `/` — Treatwell-inspired hero + Pinterest-style offer feed + salon cards
- `/offres` — searchable/filterable list (q + category)
- `/offre/[id]` — offer detail with **inline auth + booking** (a not-logged-in visitor coming from a tracking link can register/login AND book in one form, no detour to `/login`)
- `/salon/[id]` — salon detail with multi-service cart (`salon-client.tsx` persists draft in localStorage with 7-day TTL)
- `/login`, `/register`, `/verification`, `/verify-email`
- `/forgot-password`, `/reset-password?token=...`

### Dashboards (under route group `(dashboard)`)
- `/cliente` — bookings list, profile, payment, QR
- `/prestataire` — offers, slots, reservations, collaborations, profile (with opening-hours editor)
- `/influenceuse` — collaborations (accept/refuse), tracking links, gains
- `/admin` — users, offers, reservations, commissions

### API (in `src/app/api/`)
- **Auth**: `[...nextauth]`, `register`, `verify-email`, `password-reset/{request,confirm}`, `auth/redirect`
- **Tracking**: `tracking/click` (sets cookie + redirect to `/offre/<id>`)
- **Offers**: `offers`, `offers/[id]`
- **Bookings**: `bookings` (multi-item), `client/bookings/...`, `provider/bookings/...`
- **Payment**: `payment`, `payment/verify`
- **Reviews**: `reviews`
- **Collaborations**: `collaborations`, `collaborations/[id]` (multi-offer)
- **Influencer**: `influencer/{links,gains,stats,profile}`
- **Provider**: `provider/{profile,bookings,stats}`
- **Admin**: `admin/{users,offers,bookings,commissions,stats}`
- **Upload**: `upload` (writes to `public/uploads/<uuid>.<ext>`, max 5 MB, JPG/PNG/WebP/AVIF)

---

## Brand & design system

| Token | Hex | Usage |
|---|---|---|
| `--color-brand-ink` | `#1F1A1C` | Primary text, primary buttons |
| `--color-brand-ink-soft` | `#4A4244` | Secondary text |
| `--color-brand-cream` | `#FBFAF7` | Page background |
| `--color-brand-sand` | `#F4EFE8` | Hero panel, card backgrounds |
| `--color-brand-gold` | `#D4A574` | Accent, hover, dot in logo |
| `--color-brand-gold-soft` | `#E8D2B5` | Soft gold |
| `--color-brand-line` | `#E8E2D7` | Borders |

Old aliases (`brand-bordeaux`, `brand-rose`, etc.) still work — they're remapped to the new tokens in `globals.css`.

Typography: **Playfair Display** (display, italic-friendly) for headings via `.luxury-heading`, **Geist Sans** for body. UI labels are uppercase with `tracking-[0.18em]`.

Brand wordmark is the [`<Logo>`](src/components/logo.tsx) component — *"salon"* italic + *"ista"* + gold dot. Two tones (`ink` for light backgrounds, `light` for dark backgrounds). The favicon is [`src/app/icon.svg`](src/app/icon.svg) (charcoal rounded square, italic gold S + dot).

---

## Critical implementation notes

These are non-obvious things that took time to figure out — preserve them when refactoring.

### 1. User uploads bypass `next/image` optimization

Next.js's image optimizer snapshots `public/` at build time. Files written **after** the build (every offer photo) become invisible to the optimizer → 400 "received null".

**Fix**: render uploaded photos with [`<UploadedImage>`](src/components/uploaded-image.tsx) (a `next/image` wrapper with `unoptimized`). Nginx serves `/uploads/` directly with 7-day caching. Don't bring back `<Image>` for `/uploads/` paths.

### 2. Tracking link redirect uses forwarded host, not `req.url`

Behind Nginx, `req.url` resolves to `localhost:3000`. The tracking endpoint at `src/app/api/tracking/click/route.ts` builds the redirect URL from `x-forwarded-proto` / `x-forwarded-host` (with `NEXTAUTH_URL` as fallback). If you change Nginx config, ensure these headers are forwarded.

### 3. Tracking attribution survives cross-browser pasting

When a client clicks an influencer's link in an Instagram story, opens it in a fresh in-app browser, registers, then comes back later in Safari, the cookie won't carry. We dual-store the token: cookie (set in the redirect handler) **and** localStorage (set on the offer page). The `/api/bookings` call accepts an explicit `trackingToken` field as a third fallback.

### 4. Inline auth on the offer page

`/offre/[id]` shows a register/login tab inside the booking form when `!session`. The flow is: register → `signIn("credentials")` → `updateSession()` → POST `/api/bookings`. The register endpoint accepts `autoVerify: true` (CLIENT role only) so the booking isn't blocked by email verification — the user verifies later, before payment.

### 5. Slot generation

When a salon edits `openingHours` or creates an offer, `regenerateOfferSlots(offerId)` (or `regenerateAllProviderSlots` for hour changes) recomputes the next 30 days of slots, **preserving existing bookings**. Booked slots are protected; only orphaned slots are deleted.

### 6. Multi-service booking is atomic

POST `/api/bookings` accepts `{ offerIds: [], startTime: ISO }`. The server walks a cursor through consecutive slots inside a Prisma `$transaction` and validates capacity for each slot. If any slot is full, the whole booking rolls back.

### 7. Photo upload race condition

The submit button on offer create/edit forms is disabled while a photo upload is in progress (`onUploadingChange` callback on `<ImageUpload>`). Without this, fast users created offers with empty `photos: []` arrays even though the file uploaded successfully.

### 8. Email verification is feature-flagged

`REQUIRE_EMAIL_VERIFICATION` env var. When `true`, new users get a verification email and can't sign in until they verify. Inline auth on the offer page bypasses this for CLIENT role only (see #4).

### 9. Local Prisma generate is broken

`npx prisma generate` fails locally with `MODULE_NOT_FOUND` for `effect/dist/cjs/index.js` — corrupt npm install. Production deploy runs it fine. When schema changes need new fields on the client, either fix the local install or use `as never` casts in the route until the next deploy regenerates.

---

## Repo layout

```
prisma/
├── schema.prisma          # source of truth for the DB
├── migrations/            # numbered SQL migrations (committed)
└── seed.ts                # demo data — run with `npm run db:seed`
src/
├── app/
│   ├── (auth)/            # login, register, verification (route group)
│   ├── (dashboard)/       # client/provider/influencer/admin spaces (route group with shared sidebar)
│   ├── api/               # all backend routes
│   ├── offre/[id]/        # public offer page + booking
│   ├── salon/[id]/        # public salon page (multi-service cart)
│   ├── offres/            # public offers list
│   ├── forgot-password/   # password reset request
│   ├── reset-password/    # password reset confirm
│   ├── icon.svg           # favicon
│   ├── globals.css        # full design system
│   ├── layout.tsx         # root layout, metadata
│   ├── page.tsx           # homepage (hero + feed + salons + CTA)
│   ├── robots.ts
│   └── sitemap.ts
├── components/
│   ├── logo.tsx
│   ├── uploaded-image.tsx # MUST use this for any /uploads/ photo
│   ├── home-nav.tsx
│   ├── nav-account.tsx
│   ├── booking-calendar.tsx
│   ├── multi-service-calendar.tsx
│   ├── opening-hours-editor.tsx
│   ├── image-upload.tsx
│   └── providers.tsx      # NextAuth SessionProvider
├── lib/
│   ├── auth.ts            # NextAuth config
│   ├── prisma.ts
│   ├── mail.ts            # all transactional email templates
│   ├── opening-hours.ts   # types + helpers for OpeningHours JSON
│   └── slots.ts           # auto slot generation
├── generated/prisma/      # generated client (committed)
└── middleware.ts          # role-based route protection
scripts/
├── deploy/
│   ├── setup-server.sh    # one-shot bootstrap (Node, Postgres, Nginx, certbot, UFW)
│   ├── deploy.sh          # invoked by GitHub Actions on each push
│   └── README.md          # deploy runbook
└── create-admin.ts        # one-shot admin user creation
.github/workflows/
└── deploy.yml             # SSH deploy on push to main
ecosystem.config.js        # PM2 config
next.config.ts
prisma.config.ts
CONTEXT.md                 # this file
AGENTS.md                  # short note: read Next.js 16 docs before coding
CLAUDE.md                  # @AGENTS.md
```

---

## Production setup

- **Server**: Amazon Lightsail Ubuntu 22.04, public IP `3.127.102.192`
- **App dir**: `/home/ubuntu/salonista`
- **Domain**: `salonista.tn` (via Cloudflare DNS-only mode for Let's Encrypt)
- **DB**: local Postgres `salonista_prod`, user `salonista`, credentials in `.env`
- **Process**: PM2, app name `salonista`, port 3000
- **Reverse proxy**: Nginx `/etc/nginx/sites-enabled/salonista.tn` with three `location` blocks (`/`, `/uploads/`, `/_next/static`)
- **SMTP**: Gmail App Password (16 chars, no spaces) in `SMTP_PASS`
- **Swap**: 2 GB swapfile required — `next build` OOMs on Lightsail's 1 GB RAM without it
- **File permissions**: `/home/ubuntu` needs `o+x` for Nginx (`www-data`) to traverse into `public/uploads/`

### Required env vars (server `.env`)

```
DATABASE_URL=postgresql://salonista:...@localhost:5432/salonista_prod?schema=public
NEXTAUTH_URL=https://salonista.tn
NEXTAUTH_SECRET=<long random string>
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...@gmail.com
SMTP_PASS=<16-char Gmail App Password>
SMTP_FROM=Salonista <noreply@salonista.tn>
REQUIRE_EMAIL_VERIFICATION=true
```

### Deploy pipeline

`.github/workflows/deploy.yml` SSHes into the server on every push to `main` and:

1. `git fetch && git reset --hard origin/main` (pulls **before** invoking the script — avoids stale-script self-modify bugs)
2. Runs `bash ./scripts/deploy/deploy.sh` which does: `npm install` → `prisma migrate deploy` → `prisma generate` → `npm run build` → `pm2 reload ecosystem.config.js --update-env`

`npm install` is used (not `npm ci`) because npm 10 occasionally fails ci-mode on transient peer-dep mismatches (e.g., `preact` via `@auth/core`).

---

## Recurring gotchas

- **Hard-refresh** after deploy. PM2 caches the optimizer; if an image fails once, it sticks. `pm2 restart salonista` clears it.
- **Cloudflare proxy off**. Cloudflare's origin certificate breaks Let's Encrypt validation. Keep DNS in "DNS only" mode (grey cloud).
- **Don't forget `prisma generate`** after schema edits — even if migrations apply, the TS client won't see new fields.
- **`useSearchParams()` needs `<Suspense>`** in Next.js 16 — wrap login/register/verification/payment/reservation pages.
- **Image `sizes` is required** when `fill` is set — Next.js logs a warning otherwise.
- **`localPatterns` in `next.config.ts`** must include any new public path that goes through the optimizer (currently `/uploads/**`, `/images/**`).
- **PWA service worker caches aggressively in production**. After deploying changes that affect `/salon-pin` or `/pos`, users may need to close and reopen the installed app for `skipWaiting/clientsClaim` to take effect. Bump `SW_VERSION` in `public/sw.js` if a hard refresh is needed.
- **Stock can go negative** when offline POS sales sync. This is intentional Tier B graceful degradation — `StockMovement.requiresReview = true` flags those movements, and the conflict surfaces at `/pos/sync-issues`.
- **Phantom bookings**: every paid POS sale auto-creates a `Booking` if none exists (`Booking.phantom = true`). Filter `phantom = false` when displaying public-facing booking lists (e.g., `/cliente`); include phantoms in analytics and the POS calendar.

---

## Useful one-liners

```bash
# Inspect newest offers + their photo counts
sudo -u postgres psql salonista_prod -c \
  "SELECT id, title, array_length(photos, 1) AS photo_count, photos FROM \"Offer\" ORDER BY \"createdAt\" DESC LIMIT 5;"

# List newest uploads
ls -la /home/ubuntu/salonista/public/uploads/ | tail -10

# Tail live PM2 logs
pm2 logs salonista --lines 50

# Restart app (kills cached optimizer)
pm2 restart salonista

# Re-run a single migration manually
sudo -u postgres psql salonista_prod < prisma/migrations/<timestamp>_<name>/migration.sql

# Create an admin
npx tsx scripts/create-admin.ts
```

---

## Open work / known limitations

- Local `npx prisma generate` fails (corrupt `effect` package) — non-blocking, prod regenerates fine.
- Image optimizer is bypassed for `/uploads/` — we lose webp/avif/srcset for user photos. OK for now; revisit if photo bandwidth becomes an issue.
- No CDN in front of `/uploads/` yet. Nginx 7-day caching handles it for now.
- Payment is a stub (no real PSP integration).
- Mobile app is not on the roadmap.

---

## Phase 1 additions (foundations + PWA shell)

- **Customer entity** decoupled from User. Walk-ins have a `Customer` row but no `User`. Linked to a User via `Customer.userId` when the client also signs up. `firstSalonId` records the salon that registered them and gates cross-salon visibility.
- **SalonEmployee** with role-based permissions (`OWNER`/`MANAGER`/`CASHIER`/`STYLIST`) plus a per-employee JSON override map. PIN auth via NextAuth `salon-pin` Credentials provider — same JWT session strategy, second provider id.
- **SalonSubscription** gates paid modules (`POS`, `REWARDS`). Helpers in [src/lib/modules.ts](src/lib/modules.ts): `hasModule()`, `requireModule()`, `getActiveModules()`. Server component [`<ModuleGate>`](src/components/module-gate.tsx) renders a French "Module non activé" placeholder when inactive.
- **Tax rate on Offer**: Tunisian TVA (0/7/13/19% + custom). Stored as `Decimal(5, 2)` with a 19.00 default. Displayed under the price on `/offre/[id]`, `/salon/[id]`, and `/offres`.
- **Phone normalization**: [src/lib/phone.ts](src/lib/phone.ts) — accepts `12345678`/`012345678`/`216...`/`+216...` and returns E.164. Tested in [src/lib/phone.test.ts](src/lib/phone.test.ts) (vitest, 31 cases).
- **PWA scaffolding**: static [`public/manifest.json`](public/manifest.json) + four PNG icons in `public/icons/` (generated from `src/app/icon.svg` via `npm run icons:pwa`) + a no-op `public/sw.js` registered globally by [`<SwRegister>`](src/components/sw-register.tsx). [`<PwaInstallPrompt>`](src/components/pwa-install-prompt.tsx) is mounted on `/salon-pin` only. **Note**: we did not use Serwist — it doesn't yet support Next 16 / Turbopack. Phase 2 will pick a different path (or revisit Serwist when it ships Turbopack support).

Routes added:
- `/salon-pin` — employee PIN entry (PWA install entry point)
- `/admin/subscriptions` — module activation
- `/prestataire/pos` — placeholder, gated by POS module + `pos.sell` permission
- `/api/customers/lookup`, `/api/customers`, `/api/customers/[id]`
- `/api/admin/subscriptions`, `/api/admin/subscriptions/[id]`
- `/api/salon-pin/resolve`

Dashboard nav for PROVIDER now conditionally includes "Caisse" — only when the provider's `POS` subscription is active. Layout fetches `getActiveModules()` server-side and passes the list to the client nav.

One-time backfill: `npx tsx prisma/backfill-phase1.ts` (idempotent — see deploy README).

---

## Phase 2 additions (POS Core + Tier B offline)

- **POS lives at `/pos`** (separate top-level route group `(pos)`, not under `/prestataire`). Full-screen layout with a top bar — no dashboard sidebar.
- **New models**: `Product`, `StockMovement`, `Sale`, `SaleItem`, `Payment`, `TipAllocation`, `Refund`, `RefundItem`, `SaleSequence`. Plus enums `SaleStatus`, `SaleItemKind`, `PaymentMethod`, `RefundReason`, `StockMovementReason`.
- **Receipt numbers** `S-YYYYMMDD-NNNN`, daily counter per salon via the `SaleSequence` model with row-level upsert + `increment` for atomicity. Offline sales temp ID `OFF-<short>` swapped on sync.
- **Pricing convention**: prices stored TTC (Tunisian convention). HT/TVA derived for receipts via `src/lib/money.ts`. Sale-level discounts allocated proportionally across lines so per-rate tax breakdowns stay correct.
- **Three-panel POS UI** (`src/components/pos/pos-client.tsx`): Customer | Cart | Catalog. Catalog has Services + Products tabs; products tab auto-focuses a barcode input.
- **Charge modal**: split tender (cash + card + transfer + other), tip auto-allocation across line stylists with manual override, optional print + email receipt.
- **Receipt component** (`src/components/pos/receipt.tsx`): hidden print-only div with `@page { size: 80mm }` styles for thermal printers.
- **Refunds**: per-line, gated by `pos.refund`. Optional `restock` per product line, generates `StockMovement` rows with `RETURN` reason.
- **Per-line stylist assignment** stored on `SaleItem.assignedEmployeeId`. Cart defaults services to the current cashier.
- **PWA Tier B offline** via `public/sw.js` (Workbox 7 from CDN, no build-step injection):
  - `NetworkFirst` for `/salon-pin` + `/pos*` shell (3s timeout)
  - `StaleWhileRevalidate` for `/api/pos/catalog` and `/api/customers/lookup`
  - `CacheFirst` for `/uploads/**`, `/images/**`, `/_next/static/**`
  - POSTs to `/api/pos/sales` are NOT cached — they go through `src/lib/pos-offline-db.ts` (IndexedDB queue) when offline, retried via Background Sync (Chrome) or in-app polling (Safari).
- **Online status**: `OnlineStatusProvider` + `OnlineStatusBadge` in the POS top bar. Probes `/api/health` every 30s, listens for `online`/`offline` window events, auto-syncs on reconnect.
- **Sync conflicts** (deleted entities, price drift, stock negative) surface on `Sale.syncConflicts: Json` and at `/pos/sync-issues` (gated by `pos.refund`).
- **Provider profile** gained `matriculeFiscal` and `receiptFooter` — a yellow banner at the top of `/pos` nudges providers to fill in matricule fiscal.

Routes added:
- `/pos`, `/pos/sales`, `/pos/sales/[id]`, `/pos/products`, `/pos/products/new`, `/pos/products/[id]/edit`, `/pos/sync-issues`
- `/api/pos/sales` (GET list / POST create), `/api/pos/sales/[id]` (GET detail), `/api/pos/sales/[id]/refunds` (POST), `/api/pos/sales/[id]/email` (POST), `/api/pos/sales/sync` (POST batch)
- `/api/pos/products`, `/api/pos/products/[id]`, `/api/pos/products/[id]/stock`, `/api/pos/products/lookup?barcode=`
- `/api/pos/catalog` (offline cache primer)
- `/api/health` (connectivity probe)

Helpers: `computeTotals()` + `totalsEqual()` (sale-totals.ts, run client- and server-side), `nextReceiptNumber()` (atomic via SaleSequence), `formatDT()` / `ttcToHt()` / `htToTtc()` / `taxFromTtc()` / `applyDiscount()` (money.ts, ints-in-millimes math), `pos-offline-db` IndexedDB layer (`refreshCatalog`, `queueSale`, `attemptSync`, `findCachedProductByBarcode`, etc.).

**Note on Serwist**: The Phase 2 plan called for `@serwist/next`; we kept Phase 1's static `public/sw.js` and added Workbox 7 via `importScripts` from CDN instead. Reason: `@serwist/next` injects a webpack config but Next 16 defaults to Turbopack, which conflicts. Workbox-from-CDN gives the same caching strategies without a build-step dependency.

---

## Phase 3 additions (POS reservations, cash drawer, analytics)

- **POS center-panel mode toggle**: Cart ↔ Calendrier in `pos-client.tsx`. The cart state survives mode switches so the cashier can flip back to a half-built cart from the calendar. `<PosCalendar>` is a dedicated component (not extending `<MultiServiceCalendar>` — see top-of-file comment for the decision rationale).
- **Walk-ins**: every paid POS sale without a `bookingId` auto-creates a phantom `Booking` (`phantom: true, walkIn: true, createdViaPos: true, status: COMPLETED`). The phantom carries no `BookingItem`/`TimeSlot` rows. Sale↔Booking link is bidirectional from then on. Backfill: `prisma/backfill-phase3.ts` retroactively does the same for Phase 2 sales.
- **POS bookings API** under `/api/pos/bookings/*` — separate from public `/api/bookings` because POS path bypasses payment requirements, supports walk-ins, and gates on `bookings.{create,edit,cancel}` permissions. Reuses slot allocation primitives (`regenerateOfferSlots` etc.) — no duplication.
- **Convert booking to sale** (Encaisser): cashier taps Encaisser on a calendar block → cart prefills with the booking's services + customer → banner shows the reference → on charge, `Sale.bookingId` is set and `Booking.status` flips to `COMPLETED`.
- **CashDrawerSession** model. Cashier opens with float, every cash `Payment` during the session links via `Payment.cashDrawerSessionId`, close-out captures variance = `closingCount - expectedCash`. `OWNER`/`MANAGER` can mark `RECONCILED`. One open session per employee at a time (enforced server-side). Offline syncs of cash sales attempt to retroactively link to whichever session was open at the sale's `createdAt` — unlinked ones land in `/pos/sync-issues`.
- **Analytics page** `/pos/analytics` (gated by `analytics.view`). KPI tiles: revenu net, ventes payées, ticket moyen, nouveaux clients (each with previous-period delta). Recharts for the line/bar charts. 7×24 heatmap (Lun→Dim, 0h→23h). Low-stock list with inline restock CTA. CSV export for sales/refunds/drawer with Tunisian comma decimals + UTF-8 BOM so Excel opens cleanly.

KPI definitions (locked):
- **Revenu net** = sum(Sale.total of paid sales) − sum(Refund.totalAmount) in range
- **Ventes payées** = count of sales with status PAID/PARTIALLY_REFUNDED/REFUNDED, closedAt in range
- **Ticket moyen** = revenu net / ventes payées (— if 0 sales)
- **Nouveaux clients** = count of customers with firstSalonId = providerId AND createdAt in range

Routes added:
- `/pos/cash-drawer`, `/pos/cash-drawer/[id]`, `/pos/analytics`
- `/api/pos/bookings`, `/api/pos/bookings/[id]`, `/api/pos/bookings/[id]/cancel`, `/api/pos/bookings/[id]/move`
- `/api/pos/cash-drawer/{current,open,/,[id],[id]/summary,[id]/close,[id]/reconcile}`
- `/api/pos/analytics/{summary,revenue,top-services,top-products,by-employee,heatmap,low-stock,export.csv}`

POS top bar gained nav items: Caisse, Ventes, Produits, Sessions (cash drawer), Analytique, Conflits (sync) — each gated by the matching permission. Cash drawer indicator (red/green dot + running expected cash) sits next to the online-status badge.

One-time backfill: `npx tsx prisma/backfill-phase3.ts` (idempotent — see deploy README).

**Performance note**: All analytics queries are live aggregates against `Sale`/`SaleItem`/`Payment`. Each route handler has a top-of-file TODO: "If query latency >500ms in production, materialize a daily aggregates table." A single salon's volume is small enough that this is unnecessary today.

---

## Contacts

- **Owner / dev**: alimieyaa@gmail.com
- **Server admin**: supervisor (Lightsail account holder; reach out for reboots / IP-level changes)
