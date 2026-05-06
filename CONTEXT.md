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

## Contacts

- **Owner / dev**: alimieyaa@gmail.com
- **Server admin**: supervisor (Lightsail account holder; reach out for reboots / IP-level changes)
