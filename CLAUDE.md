@AGENTS.md

# Salonista — Claude Context

> **Read this every session.** Snapshot of what this app is, how it's wired, and the non-obvious traps that bite. If anything below conflicts with what you read in code, trust the code and update this file.

---

## TL;DR

**Salonista** is a beauty marketplace for Tunisia (`salonista.tn`) connecting four roles:

- **CLIENT** — browses offers, books one or several services in a single trip, pays online, gets a QR code, presents it at the salon.
- **PROVIDER** (`prestataire` in URLs) — a salon. Publishes discounted offers, defines opening hours; slots auto-generate; receives bookings.
- **INFLUENCER** (`influenceuse`) — accepts collaboration proposals from salons, gets one tracking link per offer, earns a commission on each conversion within 7 days.
- **ADMIN** — moderation: users, offers, reservations, commissions.

Deployed on **Amazon Lightsail Ubuntu** behind **Nginx + PM2** with **PostgreSQL** and **Cloudflare DNS** (DNS-only, grey cloud). Push to `main` → GitHub Actions SSHes the server and runs `scripts/deploy/deploy.sh`.

A fuller human-oriented narrative lives in [CONTEXT.md](CONTEXT.md) — read it once for background. This file is the agent operating manual.

---

## Hard rules — read before editing anything

1. **Next.js 16.2 is not your training data.** Read `node_modules/next/dist/docs/` (or the official 16 docs) before assuming an API exists. App Router conventions, route handlers, `useSearchParams` rules, and image optimization all changed.
2. **Use `<UploadedImage>` for any `/uploads/...` path.** Never `<Image>` directly — the optimizer can't see files written after build, and you'll ship 400s. See [src/components/uploaded-image.tsx](src/components/uploaded-image.tsx).
3. **Wrap pages that call `useSearchParams()` in `<Suspense>`.** Login, register, verification, payment, reservation already do this — keep the pattern.
4. **Set `sizes` whenever `<Image fill>` is used.** Next logs warnings otherwise.
5. **`localPatterns` in [next.config.ts](next.config.ts)** must list every public path that the optimizer touches. Currently `/uploads/**` and `/images/**` — add new ones explicitly.
6. **Never run `prisma migrate dev`** against production. Schema changes go through `prisma migrate dev --name <name>` locally → commit migration → deploy runs `prisma migrate deploy`.
7. ~~**Local `npx prisma generate` is broken**~~ — **RESOLVED 2026-08-12.** This was a corrupt `node_modules`, not a project defect. `rm -rf node_modules && npm install` fixed it; `npx prisma generate` now works. The same corruption also masked **Vitest** (`npm test` → 99 tests) and **ESLint**. The generated client at `src/generated/prisma/` is **gitignored**, so run `npx prisma generate` after a fresh clone. Legacy `as never` casts remain in older route code — harmless, removable on sight. **If a tool looks broken, reinstall before designing around it.**
8. **The site is in French.** UI strings, error messages, email templates — all French. Don't translate to English without being asked.
9. **Money is `Decimal(10, 3)`** in TND (Tunisian dinar uses 3 decimals — millimes). Don't convert to `number` for arithmetic; use `Decimal` math from Prisma's runtime.

---

## Stack

| Layer | Tech |
|---|---|
| Framework | **Next.js 16.2** (App Router, Turbopack) on **Node 20** |
| UI | **React 19**, **Tailwind v4** (single `globals.css`), Playfair Display + Geist Sans |
| Auth | **NextAuth v4** (JWT strategy, Credentials + Google) |
| ORM | **Prisma 7** with `@prisma/adapter-pg`, client generated into `src/generated/prisma/` (gitignored — run `npx prisma generate`) |
| DB | **PostgreSQL** (`salonista_prod` in prod) |
| Email | **Nodemailer** + Gmail SMTP App Password |
| QR | `qrcode` package, `bcryptjs` for password hashing, `nanoid` for tokens |
| Image hosting | Local `public/uploads/` served by Nginx with 7-day cache |
| Process mgr | **PM2**, single fork instance on port 3000, see [ecosystem.config.js](ecosystem.config.js) |
| Reverse proxy | **Nginx** with three location blocks (`/`, `/uploads/`, `/_next/static`) |
| TLS | **Let's Encrypt** via certbot |
| Deploy | **GitHub Actions** SSH into Lightsail on push to `main` |

---

## Domain model

Source of truth: [prisma/schema.prisma](prisma/schema.prisma). Internalize these relationships:

```
User (role: CLIENT | PROVIDER | INFLUENCER | ADMIN)
 ├─ ProviderProfile (1:1, only for PROVIDER)
 │   ├─ openingHours: Json   ← drives slot generation
 │   ├─ Offer[] (1:N)
 │   │   ├─ durationMinutes  ← slot length
 │   │   ├─ TimeSlot[] (1:N, auto-generated for next 30 days)
 │   │   └─ CollaborationOffer[]
 │   └─ CollaborationRequest[]
 │
 ├─ InfluencerProfile (1:1, only for INFLUENCER)
 │   ├─ TrackingLink[] (1 per accepted CollaborationOffer)
 │   ├─ CollaborationRequest[]
 │   └─ Payout[]
 │
 ├─ Booking[] (clients only)
 │   ├─ BookingItem[] (1:N — multi-service cart, consecutive slots)
 │   │   ├─ Offer
 │   │   └─ TimeSlot (FK Restrict — slots can't be deleted while booked)
 │   ├─ Click? (1:1 — attribution if clicked from a tracking link)
 │   ├─ Commission? (1:1 — created at booking time)
 │   └─ Review?
 │
 └─ Review[]

Tracking attribution:
TrackingLink ──(click)──> Click ──(within 7d)──> Booking ──> Commission
                                                              ├─ providerAmount
                                                              ├─ influencerAmount = total × pct/100
                                                              └─ platformAmount   = remainder
```

Six relationships you must know cold:

1. **User → role-specific profile** (`ProviderProfile`, `InfluencerProfile`). Clients have no profile row.
2. **ProviderProfile → Offer** (1:N). Each offer has a price, category, **`durationMinutes`**, and a `photos` string array.
3. **Offer → TimeSlot** (1:N). Slots are **auto-generated** from `ProviderProfile.openingHours` + `Offer.durationMinutes` for the next 30 days. See [src/lib/slots.ts](src/lib/slots.ts) and [src/lib/opening-hours.ts](src/lib/opening-hours.ts).
4. **Booking → BookingItem → TimeSlot** (multi-service cart). One booking can include multiple consecutive offers from the **same salon**; the API allocates back-to-back slots in a single transaction.
5. **CollaborationRequest → CollaborationOffer → TrackingLink**. A salon proposes a multi-offer collab with a single commission %; if the influencer accepts, **one `TrackingLink` is created per offer** (each offer has its own shareable URL).
6. **TrackingLink → Click → Booking → Commission**. Click sets a cookie + localStorage token; if the client books within 7 days, the commission is attributed to the influencer.

### Enums to remember

- `Role`: `CLIENT | INFLUENCER | PROVIDER | ADMIN`
- `Category`: `COIFFURE | ESTHETIQUE | ONGLERIE | MASSAGE | PARFUMERIE | AUTRE`
- `BookingStatus`: `PENDING | CONFIRMED | COMPLETED | CANCELLED`
- `PaymentStatus`: `UNPAID | PAID | REFUNDED`
- `CommissionStatus`: `PENDING | PAID`
- `PayoutStatus`: `PENDING | PROCESSING | PAID | FAILED`
- `CollabStatus`: `PENDING | ACCEPTED | REJECTED`

---

## Routes

### Public

| Route | Purpose |
|---|---|
| `/` | Treatwell-inspired hero + Pinterest-style offer feed + salon cards |
| `/offres` | Searchable/filterable list (`?q=` + category) |
| `/offre/[id]` | Offer detail with **inline auth + booking** (un-logged visitor from a tracking link can register/login AND book in one form) |
| `/salon/[id]` | Salon detail with multi-service cart (`salon-client.tsx` persists draft in localStorage with 7-day TTL) |
| `/login`, `/register`, `/verification`, `/verify-email` | Auth flows |
| `/forgot-password`, `/reset-password?token=...` | Password reset |

### Dashboards (route group `(dashboard)`, shared sidebar layout)

| Route | Role | Pages |
|---|---|---|
| `/cliente` | CLIENT | bookings list, profile, payment, QR |
| `/prestataire` | PROVIDER | offers (CRUD), reservations, collaborations, profile (with opening-hours editor) |
| `/influenceuse` | INFLUENCER | collaborations (accept/refuse), tracking links, gains |
| `/admin` | ADMIN | users, offers, reservations, commissions |

Role enforcement: [src/middleware.ts](src/middleware.ts) (matcher on `/prestataire`, `/influenceuse`, `/cliente`, `/admin`). ADMIN can access any dashboard.

### API (`src/app/api/`)

- **Auth**: `[...nextauth]`, `register`, `verify-email`, `password-reset/{request,confirm}`, `auth/redirect`
- **Tracking**: `tracking/click` (sets cookie + redirects to `/offre/<id>`)
- **Offers**: `offers`, `offers/[id]`
- **Bookings**: `bookings` (multi-item POST), `client/bookings/...`, `provider/bookings/...`
- **Payment**: `payment` (POST → **410**, GET sert le QR), `payment/verify` (validation d'arrivée par le salon)
- **Reviews**: `reviews`
- **Collaborations**: `collaborations`, `collaborations/[id]` (multi-offer)
- **Influencer**: `influencer/{links,gains,stats,profile}`
- **Provider**: `provider/{profile,bookings,stats}`
- **Admin**: `admin/{users,offers,bookings,commissions,stats}`
- **Upload**: `upload` (writes `public/uploads/<uuid>.<ext>`, max 5 MB, JPG/PNG/WebP/AVIF)

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

Old aliases (`brand-bordeaux`, `brand-rose`, etc.) still work — remapped to new tokens in [src/app/globals.css](src/app/globals.css).

Typography: **Playfair Display** for headings via `.luxury-heading` (italic-friendly), **Geist Sans** for body. UI labels are uppercase with `tracking-[0.18em]`.

Wordmark: [`<Logo>`](src/components/logo.tsx) — *salon* italic + *ista* + gold dot. Two tones (`ink` for light bg, `light` for dark bg). Favicon: [src/app/icon.svg](src/app/icon.svg).

---

## Critical implementation notes

These are non-obvious things that cost real time to figure out. Preserve them when refactoring.

### 1. User uploads bypass `next/image` optimization

Next's optimizer snapshots `public/` at build time. Files written **after** build (every offer photo) become invisible to the optimizer → 400 "received null".

**Fix:** render uploaded photos with [`<UploadedImage>`](src/components/uploaded-image.tsx). Nginx serves `/uploads/` directly with 7-day caching. **Don't** bring back `<Image>` for `/uploads/` paths.

Depuis le lot C, ce composant utilise un **`loader`** plutôt que `unoptimized`
pour les images qui ont des variantes (`.webp` sous `/uploads/`) : Next
construit alors son `srcset` sur les fichiers `-400`/`-800`/`-1600` écrits au
téléversement. Les images antérieures (`.jpg`, `.png`) n'en ont pas et restent
en `unoptimized`.

**Passer `srcSet` en prop ne marche pas** — `get-img-props` fait un
`delete rest.srcSet`, et le force à `undefined` sous `unoptimized`. Le loader
est le seul point d'entrée prévu.

### 2. Tracking-link redirect uses forwarded host, not `req.url`

Behind Nginx, `req.url` resolves to `localhost:3000`. The endpoint at `src/app/api/tracking/click/route.ts` builds the redirect URL from `x-forwarded-proto` / `x-forwarded-host` (with `NEXTAUTH_URL` as fallback). If you change Nginx config, ensure these headers are forwarded.

### 3. Tracking attribution survives cross-browser pasting

When a client clicks an influencer's link in an Instagram in-app browser, opens it in a fresh browser, registers, then comes back later in Safari, the cookie won't carry. We **dual-store** the token: cookie (set in the redirect handler) **and** localStorage (set on the offer page). The `/api/bookings` call accepts an explicit `trackingToken` field as a third fallback.

### 4. Inline auth on the offer page

`/offre/[id]` shows a register/login tab inside the booking form when `!session`. The flow: register → `signIn("credentials")` → `updateSession()` → POST `/api/bookings`. The register endpoint accepts `autoVerify: true` (CLIENT role only) so the booking isn't blocked by email verification — the user verifies later, before payment.

### 5. Slot generation

When a salon edits `openingHours` or creates an offer, `regenerateOfferSlots(offerId)` (or `regenerateAllProviderSlots` for hour changes) recomputes the next 30 days of slots, **preserving existing bookings**. Booked slots (`bookedCount > 0`) are protected; only orphaned slots are deleted. See [src/lib/slots.ts](src/lib/slots.ts).

### 6. Multi-service booking is atomic

`POST /api/bookings` accepts `{ offerIds: string[], startTime: ISO }`. The server walks a cursor through consecutive slots inside a Prisma `$transaction` and validates capacity for each slot. If any slot is full, the whole booking rolls back. `BookingItem.slotId` has `onDelete: Restrict` to prevent slot deletion while booked.

### 7. Photo upload race condition

The submit button on offer create/edit forms is disabled while a photo upload is in progress (`onUploadingChange` callback on [`<ImageUpload>`](src/components/image-upload.tsx)). Without this, fast users created offers with empty `photos: []` arrays even though the file uploaded successfully.

### 8. Email verification is feature-flagged

`REQUIRE_EMAIL_VERIFICATION` env var. When `true`, new users get a verification email and can't sign in until they verify. Inline auth on the offer page bypasses this for CLIENT role only (see #4 above). Auth check: [src/lib/auth.ts:44](src/lib/auth.ts#L44).

### 9. ~~Local Prisma generate is broken~~ — RESOLVED 2026-08-12

This was a corrupt `node_modules`, not a project defect. `rm -rf node_modules && npm install` restored `npx prisma generate`, and with it **Vitest** and **ESLint**, which the same corruption had masked.

The lesson is worth keeping: a whole implementation plan was once designed around "there is no test framework here" and "typecheck reports ~80 unavoidable errors" — both false. **Reinstall before designing around a broken tool.**

### 10. JWT role refresh on every token cycle

[src/lib/auth.ts](src/lib/auth.ts) re-reads `User.role` from the DB on every JWT refresh, so admin-promotions take effect on the next request without a forced sign-out. Don't "optimize" this away.

### 11. Le QR naît avec la réservation, pas avec un paiement

Salonista n'encaisse rien : la cliente réserve en ligne et **règle au salon**.
`POST /api/bookings` pose donc `qrCode` et `status: "CONFIRMED"` dès la
création ; `paymentStatus` reste `UNPAID` — durablement, ce n'est pas un
oubli.

Trois conséquences à ne pas défaire :

- **`POST /api/payment` répond 410.** Il posait `PAID` et envoyait
  « Paiement effectué avec succès » sans qu'aucun dinar ne change de main :
  toute cliente connectée obtenait un QR valide gratuitement. Le `GET` reste,
  il sert à réafficher le QR.
- **`POST /api/payment/verify` ne contrôle plus le règlement.** Exiger
  `paymentStatus === "PAID"` rendrait tout QR invalide, puisque la cliente
  vient précisément payer sur place. L'appartenance au salon et le refus de
  double validation restent en place.
- **Ne jamais afficher `paymentStatus` à la cliente.** Il vaut toujours
  `UNPAID` et ne veut rien dire pour elle. Les écrans pivotent sur `qrVerified`
  et `status`.

La décision d'état vit dans [src/lib/booking-state.ts](src/lib/booking-state.ts)
(pur, testé). Le drapeau `PAIEMENT_EN_LIGNE_ACTIF` y rassemble ce qu'il faudra
rallumer quand un PSP tunisien sera branché.

Rattrapage des réservations d'avant, sans QR :
`npx tsx scripts/backfill-qr-reservations.ts --apply` (idempotent, inspecte par
défaut).

### 12. Comment le salon valide une arrivée

Le QR contient une **URL** (`/verification?code=BT-…`), pas un code nu : c'est
ce qui permet de le lire avec **l'appareil photo natif d'un téléphone**, sans
installer d'application. Ne le remplacez pas par un code brut.

Deux chemins mènent à la validation, tous deux vers la même page
`/verification` :

- **L'appareil photo du téléphone** — le lien s'ouvre tout seul.
- **`/pos/scan`** — un scanner intégré à la caisse, via `BarcodeDetector`
  (API **native**, aucune dépendance ajoutée). Support inégal : absent de
  Safari iOS à ce jour, d'où un repli explicite + saisie manuelle du code.
  L'extraction du code est isolée dans
  [src/lib/qr-code-reservation.ts](src/lib/qr-code-reservation.ts) (pur, testé)
  — elle rejette les QR étrangers et les `?code=` portés par d'autres pages.

Après « Confirmer l'arrivée », un bouton **« Encaisser maintenant »** ouvre
`/pos?bookingId=…` et pré-remplit le panier — le même mécanisme que le bouton
« Encaisser » de l'agenda. Sans lui, valider et encaisser restaient deux gestes
sans lien et la caissière devait retrouver la cliente à la main.

### 13. Le chiffre d'affaires compte aussi les salons sans caisse

**`POST /api/pos/sales` exige le module POS et répond 403 sans lui.** Or les
statistiques ne comptaient que des `Sale` : un salon non abonné voyait
**« 0 TND » en permanence**, alors qu'il validait les QR de ses clientes et
encaissait au comptoir.

`/api/pos/analytics/summary` additionne désormais deux sources via
[src/lib/revenu-salon.ts](src/lib/revenu-salon.ts) (pur, 11 tests) :

- les **ventes** (`Sale`), quand le salon a la caisse ;
- les **rendez-vous terminés** (`Booking.status = COMPLETED`) **sans vente
  rattachée**, sinon.

Deux règles à ne pas défaire :

- **`aUneVente` évite le double comptage.** Quand la caisse encaisse un
  rendez-vous, elle pose `Sale.bookingId` *et* passe le `Booking` à
  `COMPLETED` — le compter des deux côtés doublerait la recette.
- **Le filtre porte sur `qrVerifiedAt`, pas `createdAt`.** Ce qui compte est
  le jour de la **visite**, pas celui de la réservation. (`Booking` n'a pas
  d'`updatedAt`.)

Les boutons « Encaisser » sont masqués sans le module — sur `/verification`
(via `caisseDisponible` renvoyé par l'API) et dans l'agenda (`peutEncaisser`).
Ils menaient à un échec silencieux : panier rempli, enregistrement en 403.

### 14. Le format d'une image se lit dans ses octets, jamais dans `file.type`

`file.type` est l'en-tête MIME **annoncé par le navigateur** : trivialement
falsifiable. L'ancienne route s'y fiait *et* tirait l'extension de
`file.name.split(".").pop()`. On déposait donc un `.html` ou un `.svg` en
déclarant `image/png` ; Nginx servant `/uploads/` en direct, le fichier
s'exécutait **en même origine que l'application**.

Trois règles, dans [src/lib/upload-image.ts](src/lib/upload-image.ts) (pur,
27 tests) et [src/app/api/upload/route.ts](src/app/api/upload/route.ts) :

1. **Le format vient de `sharp(buffer).metadata()`**, jamais de l'appelant.
   Liste blanche : `jpeg`/`png`/`webp`/`avif`. Le SVG est refusé — il peut
   porter du script.
2. **L'extension est imposée par le code** (`.webp`), jamais reprise du nom
   d'origine. Le nom de fichier est un UUID généré côté serveur.
3. **Tout est ré-encodé** en WebP 400/800/1600 px. Outre le `srcset`, le
   ré-encodage détruit toute charge utile cachée dans le fichier d'origine.

Quota : 40 envois par 24 h et par utilisateur (`UploadLog`). La clé est
`User.id`, ou l'identifiant d'employé pour une session PIN — d'où l'absence de
clé étrangère sur `UploadLog.userId`.

**Nginx n'est pas mis à jour par `deploy.sh`.** Les en-têtes `nosniff` et
`default_type` ajoutés à `setup-server.sh` doivent être appliqués à la main
sur un serveur déjà en place — voir le runbook
[scripts/deploy/README.md](scripts/deploy/README.md).

---

## Repo layout

```
prisma/
├── schema.prisma          # source of truth for the DB
├── migrations/            # numbered SQL migrations (committed)
└── seed.ts                # demo data — `npm run db:seed`

src/
├── app/
│   ├── (auth)/            # login, register, verification (route group)
│   ├── (dashboard)/       # cliente / prestataire / influenceuse / admin (shared layout)
│   ├── api/               # all backend route handlers
│   ├── offre/[id]/        # public offer page + inline booking
│   ├── salon/[id]/        # public salon page (multi-service cart)
│   ├── offres/            # public offers list
│   ├── forgot-password/   # password reset request
│   ├── reset-password/    # password reset confirm
│   ├── icon.svg           # favicon (charcoal square, gold S)
│   ├── globals.css        # full design system
│   ├── layout.tsx         # root layout, metadata
│   ├── page.tsx           # homepage
│   ├── robots.ts
│   └── sitemap.ts
│
├── components/
│   ├── logo.tsx
│   ├── uploaded-image.tsx       # ← MUST use this for /uploads/ photos
│   ├── home-nav.tsx, bottom-nav.tsx, nav-account.tsx
│   ├── booking-calendar.tsx, multi-service-calendar.tsx
│   ├── opening-hours-editor.tsx
│   ├── image-upload.tsx         # has onUploadingChange — use it
│   ├── greeting.tsx, promo-banner.tsx
│   └── providers.tsx            # NextAuth SessionProvider
│
├── lib/
│   ├── auth.ts            # NextAuth config (JWT, role refresh)
│   ├── prisma.ts          # singleton client
│   ├── mail.ts            # all transactional email templates
│   ├── opening-hours.ts   # OpeningHours JSON type + slot helpers
│   └── slots.ts           # auto slot regeneration
│
├── generated/prisma/      # generated Prisma client (COMMITTED)
└── middleware.ts          # role-based route protection

scripts/
├── deploy/
│   ├── setup-server.sh    # one-shot bootstrap (Node, Postgres, Nginx, certbot, UFW)
│   ├── deploy.sh          # invoked by GitHub Actions on each push
│   └── README.md          # deploy runbook
├── create-admin.ts        # one-shot admin user creation
└── force-complete.ts

.github/workflows/
└── deploy.yml             # SSH deploy on push to main

ecosystem.config.js        # PM2 config
next.config.ts             # localPatterns: /uploads/**, /images/**
prisma.config.ts
CONTEXT.md                 # human-oriented narrative
AGENTS.md                  # short note: read Next.js 16 docs first
CLAUDE.md                  # this file
```

---

## Production setup

- **Server**: Amazon Lightsail Ubuntu 22.04, public IP `3.127.102.192`
- **App dir**: `/home/ubuntu/salonista`
- **Domain**: `salonista.tn` (Cloudflare DNS-only mode for Let's Encrypt)
- **DB**: local Postgres `salonista_prod`, user `salonista`
- **Process**: PM2, app name `salonista`, port 3000, single fork instance
- **Reverse proxy**: Nginx `/etc/nginx/sites-enabled/salonista.tn` — three `location` blocks (`/`, `/uploads/`, `/_next/static`)
- **SMTP**: Gmail App Password (16 chars, no spaces) in `SMTP_PASS`
- **Swap**: 2 GB swapfile required — `next build` OOMs on Lightsail's 1 GB RAM without it
- **File permissions**: `/home/ubuntu` needs `o+x` so Nginx (`www-data`) can traverse into `public/uploads/`

### Required server `.env`

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

[.github/workflows/deploy.yml](.github/workflows/deploy.yml) SSHes into the server on every push to `main` and:

1. `git fetch && git reset --hard origin/main` (pulls **before** invoking the script — avoids stale-script self-modify bugs)
2. Runs `bash ./scripts/deploy/deploy.sh` which does: `npm install` → `prisma migrate deploy` → `prisma generate` → `npm run build` → `pm2 reload ecosystem.config.js --update-env`

We use `npm install` (not `npm ci`) because npm 10 occasionally fails ci-mode on transient peer-dep mismatches (e.g., `preact` via `@auth/core`).

---

## Recurring gotchas

- **Hard-refresh after deploy.** PM2 caches the optimizer; a single failed image sticks. `pm2 restart salonista` clears it.
- **Cloudflare proxy must stay OFF.** Cloudflare's origin certificate breaks Let's Encrypt validation. DNS-only / grey cloud.
- **Don't forget `prisma generate`** after schema edits — even if migrations apply, the TS client won't see new fields.
- **`useSearchParams()` needs `<Suspense>`** in Next.js 16 — wrap login/register/verification/payment/reservation pages.
- **`Image` `sizes` is required** with `fill`.
- **`localPatterns`** must include any new public path that goes through the optimizer.

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

### Local dev

```powershell
# install
npm install

# dev (Turbopack)
npm run dev

# Prisma
npm run db:generate   # generate client (currently broken locally — see hard rule #7)
npm run db:push       # push schema without migration (dev only)
npm run db:seed       # seed demo data
npm run db:studio     # open Prisma Studio

# lint
npm run lint
```

---

## Open work / known limitations

- ~~Local `npx prisma generate` fails~~ — resolved 2026-08-12 by reinstalling `node_modules`.
- Image optimizer is bypassed for `/uploads/` — we lose webp/avif/srcset for user photos. OK for now; revisit if photo bandwidth becomes an issue.
- No CDN in front of `/uploads/` yet. Nginx 7-day caching handles it.
- **Le règlement se fait au salon** — Salonista n'encaisse pas. Aucun PSP n'est
  intégré ; le drapeau `PAIEMENT_EN_LIGNE_ACTIF` dans
  [src/lib/booking-state.ts](src/lib/booking-state.ts) isole ce qu'il faudra
  rallumer le jour où un prestataire tunisien (Paymee, Konnect, Flouci,
  ClicToPay) sera branché.
- Mobile app is not on the roadmap.

---

## POS launch readiness additions (2026-06-13)

### New schema fields/models

- `Offer.publishedToMarketplace` (Boolean, default false; backfilled true for existing rows)
- `Offer.originalPrice` is now nullable
- `ProviderProfile.onboardingDismissedAt` (DateTime?)
- `Product.costPrice` (Decimal?, nullable; new canonical cost source, `purchasePrice` deprecated)
- `StockMovement.unitCost` (Decimal?, snapshotted at PURCHASE time)
- `CashDrawerExpense` model + `ExpenseCategory` enum
- `Booking.qrVerifiedByEmployeeId` (set in earlier hardening pass)

### New routes

- `/pos/services` — quick-add table for POS-only services (perm `products.manage`)
- `/pos/bienvenue` — onboarding wizard for fresh OWNER providers
- `/pos/bienvenue/test-print` — auto-prints a test ticket
- `/pos/products/reception` — bulk stock reception with costed PURCHASE
- `/pos/cash-drawer/[id]/rapport` — Z report (server-aggregated, auto-prints)
- `/api/pos/drawer/expenses` (POST/GET), `/api/pos/drawer/expenses/[id]` (DELETE)
- `/api/pos/products/reception-bulk` (POST)
- `/api/pos/analytics/product-margin` (GET)

### Permission reuse

- `/pos/services` reuses `products.manage` (no new permission).
- Bulk reception uses `products.manage`; single-product stock keeps `inventory.edit`.
- Expense DELETE uses `pos.refund` (manager-level money operation).

### Shared print layout

- `src/components/pos/thermal/thermal-layout.tsx` — `<ThermalLayout>` + primitives (Header/Row/Total/Separator/Section/Footer). Single 80mm CSS source.
- Three consumers: receipt (`thermal/receipt-content.tsx`), test ticket (`thermal/test-ticket-content.tsx`), Z report (`thermal/z-report-content.tsx`).

### Deprecated

- `Product.purchasePrice` — not read in business logic; kept for migration safety. New cost flows write `costPrice`.

### Known follow-ups (not in this PR)

- FIFO/weighted-average inventory costing.
- ESC/POS direct printing via Web Bluetooth.
- `POST /api/pos/employees` (wizard step 4 currently shows a placeholder card).

---

## Contacts

- **Owner / dev**: alimieyaa@gmail.com
- **Server admin**: supervisor (Lightsail account holder; reach out for reboots / IP-level changes)
