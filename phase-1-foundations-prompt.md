# Salonista — Phase 1: Foundations + PWA Scaffolding

> Prerequisite: read `CONTEXT.md` and `AGENTS.md` before writing any code. This codebase runs **Next.js 16.2 + Turbopack + React 19 + Tailwind v4 + Prisma 7 + NextAuth v4 (JWT)**, and several patterns are non-obvious. Honor them.

## Mission

Lay the foundations for two upcoming modules — a salon **POS** and a **Reward Points** system — without implementing either. Specifically:

1. Database schema for employees, customers, and module subscriptions
2. Permission system + PIN authentication for shared salon tablets
3. Customer entity decoupled from `User` (walk-ins don't have accounts)
4. Module gating helpers so paid features can be activated per salon
5. Super admin UI to flip module subscriptions on/off
6. Tax-rate field on offers (Tunisian TVA: 0/7/13/19%)
7. **PWA scaffolding** for the future POS (manifest + icons + service-worker shell)

POS UI, sales transactions, products, rewards programs, wallets, receipts, refunds, offline sync — **all out of scope**. Those land in Phases 2 and 5.

---

## Stack-specific patterns to honor

Pulled from `CONTEXT.md`. Don't fight these:

- **Prisma client import**: `import { PrismaClient } from "@/generated/prisma/client"` (custom output, committed to repo). Existing helper at `@/lib/prisma` already exports a configured instance with the `PrismaPg` adapter — use it.
- **Local Prisma generate is broken** (`MODULE_NOT_FOUND` for `effect`). When new schema fields aren't reflected in the TS client, use `as never` casts in route handlers — production deploy regenerates fine.
- **Money columns**: `Decimal(10, 3)` for Tunisian Dinar (millimes, 3 decimal places).
- **Atomic multi-step writes**: use `prisma.$transaction([...])` — existing precedent in `/api/bookings`.
- **Image uploads** must render through `<UploadedImage>` (`src/components/uploaded-image.tsx`). Never use raw `<Image>` for `/uploads/` paths.
- **Pages using `useSearchParams()`** must be wrapped in `<Suspense>` (Next.js 16 requirement).
- **Add new public paths to `next.config.ts` `localPatterns`** if they go through the image optimizer.
- **Brand tokens** (use the new ones, not the deprecated bordeaux/rose aliases):
  - `brand-ink` / `brand-ink-soft` — primary/secondary text, primary buttons
  - `brand-cream` — page background
  - `brand-sand` — card / panel background
  - `brand-gold` / `brand-gold-soft` — accent
  - `brand-line` — borders
- **Typography**: `.luxury-heading` (Playfair Display) for headings; `tracking-[0.18em]` uppercase for UI labels.
- **All user-facing strings are French.**
- **Existing `<Logo>` component** (`src/components/logo.tsx`) — use both tones (`ink` for light backgrounds, `light` for dark).
- **NextAuth v4 multi-provider**: existing `authOptions` in `src/lib/auth.ts` already has Credentials + Google. Add a second Credentials provider with a different `id` for PIN flow — both can coexist.

---

## 1. Prisma schema changes

### New enums

```prisma
enum EmployeeRole {
  OWNER
  MANAGER
  CASHIER
  STYLIST
}

enum SubscriptionModule {
  POS
  REWARDS
}

enum SubscriptionStatus {
  ACTIVE
  SUSPENDED
  EXPIRED
  TRIAL
}
```

### New models

```prisma
model Customer {
  id           String    @id @default(cuid())
  phone        String    @unique           // E.164: "+21612345678"
  firstName    String?
  lastName     String?
  email        String?
  birthday     DateTime?
  notes        String?
  userId       String?   @unique           // set when this customer also has a CLIENT login
  firstSalonId String?                     // ProviderProfile.id of the salon that first registered them
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  user      User?     @relation(fields: [userId], references: [id], onDelete: SetNull)
  bookings  Booking[]

  @@index([phone])
  @@index([firstSalonId])
}

model SalonEmployee {
  id          String       @id @default(cuid())
  providerId  String
  userId      String?      // optional — only set if employee has a full account
  displayName String
  phone       String?
  email       String?
  pinHash     String?      // 4–6 digit PIN, bcrypt-hashed
  role        EmployeeRole @default(CASHIER)
  permissions Json?        // override map { "pos.discount": false, ... }
  active      Boolean      @default(true)
  lastLoginAt DateTime?
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  provider     ProviderProfile @relation(fields: [providerId], references: [id], onDelete: Cascade)
  user         User?           @relation(fields: [userId], references: [id], onDelete: SetNull)
  bookingsLed  Booking[]       @relation("BookingAssignedEmployee")
  itemsLed     BookingItem[]   @relation("BookingItemAssignedEmployee")

  @@index([providerId, active])
  @@index([userId])
}

model SalonSubscription {
  id                String              @id @default(cuid())
  providerId        String
  module            SubscriptionModule
  status            SubscriptionStatus  @default(ACTIVE)
  activatedAt       DateTime            @default(now())
  expiresAt         DateTime?           // null = lifetime / manual
  activatedByUserId String?             // ADMIN user who flipped the switch
  pricingSnapshot   Json?               // { monthlyPrice: 30, currency: "DT" } for future billing
  notes             String?
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt

  provider ProviderProfile @relation(fields: [providerId], references: [id], onDelete: Cascade)

  @@unique([providerId, module])
  @@index([status])
}
```

### Modifications to existing models (additive only — no breaking changes)

- `Offer`: add `taxRate Decimal @default(19.00) @db.Decimal(5, 2)`
- `Booking`:
  - add `customerId String?` (nullable; existing `clientId` stays untouched)
  - add `walkIn Boolean @default(false)`
  - add `createdViaPos Boolean @default(false)`
  - add `assignedEmployeeId String?` with relation `assignedEmployee SalonEmployee? @relation("BookingAssignedEmployee", fields: [assignedEmployeeId], references: [id], onDelete: SetNull)`
  - add `customer Customer? @relation(fields: [customerId], references: [id], onDelete: SetNull)`
- `BookingItem`: add `assignedEmployeeId String?` with the matching named relation `BookingItemAssignedEmployee`
- `ProviderProfile`: add back-relations `employees SalonEmployee[]`, `subscriptions SalonSubscription[]`
- `User`: add back-relation `customer Customer?`

### Migration

```bash
npx prisma migrate dev --name phase1_foundations_and_pwa
```

Confirm `prisma/migrations/<timestamp>_phase1_foundations_and_pwa/migration.sql` is committed.

---

## 2. Backfill script

Create `prisma/backfill-phase1.ts`. Idempotent. Documented in `scripts/deploy/README.md` under "One-time scripts".

For every existing `User` with role `CLIENT` and a non-null `phone`:
- Normalize phone to E.164
- `upsert` a `Customer` row keyed on the phone, with `userId` linked
- Skip if a Customer with that phone already exists with a different userId (log a warning)

For every existing `Booking`:
- Find the linked Customer via `booking.client.phone → Customer.phone`
- Set `booking.customerId` if not already set

For every existing `ProviderProfile`:
- Create one `SalonEmployee` if none exists for that providerId
- `role: OWNER`, `userId: providerProfile.userId`, `displayName: user.name || salonName`, `pinHash: null`, `permissions: null` (relies on OWNER role defaults)

Run order documented:

```bash
npx prisma migrate deploy
npx tsx prisma/backfill-phase1.ts
```

---

## 3. Phone normalization

`src/lib/phone.ts`:

```ts
/**
 * Normalize Tunisian phone numbers to E.164 (+216XXXXXXXX).
 * Accepts: "12345678", "012345678", "21612345678", "0021612345678",
 *          "+216 12 345 678", "(+216) 12-345-678".
 * Validates: 8 digits, must start with 2, 3, 4, 5, 7, or 9.
 * Throws InvalidPhoneError on invalid input.
 */
export function normalizePhone(input: string): string;

/** Same as above, returns null instead of throwing. */
export function tryNormalizePhone(input: string): string | null;

/** Display format for UIs: "+216 12 345 678" */
export function formatPhoneDisplay(e164: string): string;

export class InvalidPhoneError extends Error {}
```

Add `src/lib/phone.test.ts` with cases for each accepted format, each invalid case (empty, too short, too long, foreign +33, letters, leading-0 ambiguity), and the display formatter. Use vitest if present, otherwise scaffold it: `npm install --save-dev vitest @vitejs/plugin-react` and add a `vitest.config.ts`.

---

## 4. Permission system

`src/lib/permissions.ts`:

```ts
import type { SalonEmployee, EmployeeRole } from "@/generated/prisma/client";

export const PERMISSIONS = [
  "pos.sell",
  "pos.refund",
  "pos.discount",
  "pos.void",
  "pos.cash_drawer",
  "bookings.view",
  "bookings.create",
  "bookings.edit",
  "bookings.cancel",
  "customers.view",
  "customers.edit",
  "inventory.view",
  "inventory.edit",
  "products.manage",
  "analytics.view",
  "rewards.adjust",
  "rewards.settings",
  "employees.manage",
  "settings.manage",
] as const;

export type Permission = typeof PERMISSIONS[number];

export const ROLE_DEFAULTS: Record<EmployeeRole, Record<Permission, boolean>>;

export function getRoleDefaults(role: EmployeeRole): Record<Permission, boolean>;
export function hasPermission(employee: SalonEmployee, permission: Permission): boolean;
//   merges ROLE_DEFAULTS[employee.role] with employee.permissions JSON override
```

Use the matrix from the spec exactly:

| Permission | OWNER | MANAGER | CASHIER | STYLIST |
|---|:-:|:-:|:-:|:-:|
| pos.sell | ✓ | ✓ | ✓ | ✓ |
| pos.discount | ✓ | ✓ |  |  |
| pos.refund | ✓ | ✓ |  |  |
| pos.void | ✓ | ✓ |  |  |
| pos.cash_drawer | ✓ | ✓ | ✓ |  |
| bookings.view | ✓ | ✓ | ✓ | ✓ |
| bookings.create | ✓ | ✓ | ✓ |  |
| bookings.edit | ✓ | ✓ | ✓ |  |
| bookings.cancel | ✓ | ✓ | ✓ |  |
| customers.view | ✓ | ✓ | ✓ | ✓ |
| customers.edit | ✓ | ✓ | ✓ |  |
| inventory.view | ✓ | ✓ | ✓ |  |
| inventory.edit | ✓ | ✓ |  |  |
| products.manage | ✓ | ✓ |  |  |
| analytics.view | ✓ | ✓ |  |  |
| rewards.adjust | ✓ | ✓ |  |  |
| rewards.settings | ✓ |  |  |  |
| employees.manage | ✓ |  |  |  |
| settings.manage | ✓ |  |  |  |

---

## 5. PIN authentication

### NextAuth provider

In `src/lib/auth.ts`, add a second Credentials provider:

```ts
CredentialsProvider({
  id: "salon-pin",
  name: "Salon PIN",
  credentials: {
    employeeId: { type: "text" },
    pin: { type: "password" },
  },
  async authorize({ employeeId, pin }) {
    // 1. Find SalonEmployee by id, must be active and have pinHash
    // 2. bcrypt.compare(pin, employee.pinHash)
    // 3. Update lastLoginAt
    // 4. Return a User-shaped object that includes the employeeId/providerId
  },
}),
```

Extend the JWT/session callbacks so when authorized via `salon-pin`, the session includes:

```ts
session.employee = {
  id: string,
  providerId: string,
  role: EmployeeRole,
  displayName: string,
  permissions: Record<Permission, boolean>,  // merged from role defaults + override
};
```

Update `src/types/next-auth.d.ts` (create if absent) to type-augment `Session` and `JWT` accordingly.

### Server helpers

`src/lib/employee-session.ts`:

```ts
export type EmployeeSession = {
  id: string;
  providerId: string;
  role: EmployeeRole;
  displayName: string;
  permissions: Record<Permission, boolean>;
};

/** Returns the active SalonEmployee for the current session, or null. */
export async function getCurrentEmployee(): Promise<EmployeeSession | null>;

/** Throws Response 401 JSON if no employee. */
export async function requireEmployee(): Promise<EmployeeSession>;

/** Throws Response 403 JSON if missing permission. */
export async function requirePermission(perm: Permission): Promise<EmployeeSession>;
```

When the caller is a PROVIDER user (email/password login, not PIN), auto-resolve their OWNER `SalonEmployee` row. If the OWNER row doesn't exist (edge case for a provider who pre-dates this migration), create it lazily.

### PIN entry page

`src/app/salon-pin/page.tsx` — wrap in `<Suspense>` if it reads search params.

UI flow (French strings throughout):

1. **Step 1 — Identify salon.** Input: salon owner's email *or* phone. POST `/api/salon-pin/resolve` returns `{ providerId, salonName, employees: [{ id, displayName, role, hasPin: bool, avatarColor }] }`. Display salon name + a grid of employee tiles. OWNER tiles without PINs are dimmed with a small note "Connexion par email".
2. **Step 2 — PIN entry.** When a tile is tapped, show a numpad (custom on-screen pad, 0–9 + backspace). 4-digit minimum, 6-digit maximum. Auto-submit when length matches employee's stored PIN length (or on tap of an "Entrer" button).
3. **Success → redirect.** `signIn("salon-pin", { employeeId, pin, redirect: false })`, then `router.push("/prestataire/pos")`.

Style: large tap targets (60px+ touch areas), `brand-sand` panel on `brand-cream` background, gold dot accents matching the logo. Should feel like an iPad checkout app, not a web form.

API:

- `POST /api/salon-pin/resolve` — body `{ identifier }`, returns the salon + employees structure above. No auth required (it's the entry point), but rate-limit by IP if a simple in-memory limiter is feasible.

### Don't break existing flows

PROVIDER users logging in via email/password keep going to `/prestataire`. Only direct visits to `/prestataire/pos` (or to `/salon-pin`) trigger the PIN flow.

---

## 6. Module gating

`src/lib/modules.ts`:

```ts
export async function hasModule(
  providerId: string,
  module: SubscriptionModule
): Promise<boolean>;
//   true iff SalonSubscription exists with:
//   status in (ACTIVE, TRIAL)
//   AND (expiresAt is null OR expiresAt > now)

export async function requireModule(
  providerId: string,
  module: SubscriptionModule
): Promise<void>;
// throws Response 403 JSON { error: "Module non activé" } if not active

export async function getActiveModules(
  providerId: string
): Promise<SubscriptionModule[]>;
```

Server component `<ModuleGate module={...} providerId={...} fallback={...}>` in `src/components/module-gate.tsx`. When inactive, renders a French "Module non activé — contactez l'administrateur" placeholder card.

---

## 7. Customer lookup API

Three routes, all guarded by `requireEmployee()` (or PROVIDER session) + appropriate permission.

### `GET /api/customers/lookup?phone=XXX`

Permission: `customers.view`. Steps:

1. Normalize phone via `normalizePhone()`. Return 400 on invalid.
2. Look up `Customer` by phone.
3. Determine the requesting `providerId` (from PROVIDER session or `employee.providerId`).
4. If not found → return `{ found: false }`.
5. Compute scope:
   - **own**: `customer.firstSalonId === providerId` OR customer has any `Booking` with an offer belonging to this provider
   - **external**: otherwise
6. If **own**, return:
   ```json
   {
     "found": true,
     "scope": "own",
     "customer": {
       "id", "phone", "firstName", "lastName", "email", "birthday", "notes",
       "createdAt"
     },
     "stats": {
       "bookingsCount": 0,
       "lastVisitAt": null,
       "lifetimeSpend": "0.000"
     }
   }
   ```
7. If **external**, return only:
   ```json
   {
     "found": true,
     "scope": "external",
     "customer": { "id", "phone", "firstName", "lastName" }
   }
   ```
   No email, no birthday, no notes, no stats.

### `POST /api/customers`

Permission: `customers.edit`. Body: `{ phone, firstName?, lastName?, email?, birthday? }`.

- Normalize phone, validate.
- If a Customer already exists with this phone:
  - If `firstSalonId === providerId` → return `200` with the existing record (idempotent).
  - Else → return `409 Conflict { existing: { scope: "external", customer: {...} } }` so the UI can offer "Use existing" with the partial profile.
- Else create a new Customer with `firstSalonId: providerId`. Return `201`.

### `PUT /api/customers/[id]`

Permission: `customers.edit`. Body: subset of `{ firstName, lastName, email, birthday, notes }`.

- If `customer.firstSalonId === providerId` → all fields editable.
- Else → only `firstName` and `lastName` editable. Reject other fields with `403 { error: "Modification limitée — ce client a été enregistré par un autre salon" }`.

All error messages French.

---

## 8. Super admin: subscriptions page

### Route

`src/app/(dashboard)/admin/subscriptions/page.tsx`. Add nav item **"Abonnements"** to the ADMIN array in `src/app/(dashboard)/layout.tsx`, between "Offres" and "Réservations".

### UI

Match the existing admin styling. Reference `/admin/utilisateurs` for table/card patterns.

- Header: `luxury-badge` "Administration", `luxury-heading` "Abonnements modules"
- Search input (client-side filter on salon name + city)
- Filter chips: "Tous / POS actif / Rewards actif / Expire bientôt (≤ 7 jours)"
- Table columns: **Salon**, **Ville**, **POS**, **Rewards**, **Actions**
- Status pills:
  - `ACTIVE` → green border, "Actif"
  - `TRIAL` → amber border, "Essai (jusqu'au DD/MM)"
  - `SUSPENDED` → red border, "Suspendu"
  - `EXPIRED` → gray border, "Expiré"
  - none → muted "Inactif"
- Per-row "Gérer" button opens a side drawer (or right-side panel) with two cards (POS, Rewards). Each card shows current state and per-action buttons:
  - Inactive → "Activer" → modal: status (`ACTIVE` or `TRIAL`), expiresAt (date picker, optional), monthly price (number), notes (textarea). On submit, POST `/api/admin/subscriptions`.
  - Active/Trial → "Suspendre", "Modifier l'expiration", "Modifier le prix"
  - Suspended → "Réactiver"
- Audit footer in each card: "Activé par <admin name> le <date>" if `activatedByUserId` set.

### API

```
GET    /api/admin/subscriptions              → list all providers + their subs
POST   /api/admin/subscriptions              → upsert { providerId, module, status, expiresAt?, pricingSnapshot?, notes? }
PUT    /api/admin/subscriptions/[id]         → update status / expiresAt / notes
DELETE /api/admin/subscriptions/[id]         → set status=SUSPENDED (soft, never hard-delete)
```

All routes guard with `session.user.role === "ADMIN"`. Set `activatedByUserId` to the admin's user id on POST.

When activating REWARDS, **do not** create a `RewardProgram` record (Phase 5).

---

## 9. Tax rate on Offer

In the existing offer create/edit form (`src/app/(dashboard)/prestataire/offres/...`), add a **TVA** select field below price:

```
0%  – Exonéré
7%  – TVA réduite
13% – TVA intermédiaire
19% – TVA standard (par défaut)
Personnalisé...
```

When "Personnalisé..." is chosen, reveal a numeric input (0–100, max 2 decimals, validated client + server side).

Update `POST /api/offers` and `PUT /api/offers/[id]` to accept and validate `taxRate`. On the public offer card and salon page, display the small note **"TVA incluse: X%"** under the price.

---

## 10. PWA scaffolding

The POS will run as a PWA. We're laying the foundation here so Phase 2 doesn't have to retrofit global config.

### Library

Use **Serwist** (`@serwist/next`) — modern Workbox successor with native Next.js App Router support and Turbopack compatibility.

```bash
npm install @serwist/next serwist
npm install --save-dev @types/serviceworker
```

### Configuration

Update `next.config.ts`:

```ts
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: false,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
});

export default withSerwist({
  // ...existing config
});
```

The `disable` flag in dev avoids fighting Turbopack hot reload. To smoke-test PWA locally, do a production build (`npm run build && npm start`) on port 3000.

### Service worker

`src/app/sw.ts`:

```ts
// PHASE 1: Empty service worker — registration only, no caching strategies.
// Phase 2 will add:
//   - StaleWhileRevalidate for /api/customers/lookup
//   - CacheFirst for product catalog
//   - NetworkFirst with timeout for /api/pos/sales POST (queued offline via Background Sync)
//   - IndexedDB-backed offline cart and sync queue

import { defaultCache } from "@serwist/next/worker";
import { Serwist } from "serwist";

declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: (string | { url: string; revision: string | null })[];
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [], // Phase 2 fills this
});

serwist.addEventListeners();
```

### Manifest

`public/manifest.json`:

```json
{
  "name": "Salonista POS",
  "short_name": "Salonista",
  "description": "Caisse et réservations pour salons Salonista",
  "start_url": "/salon-pin",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#FBFAF7",
  "theme_color": "#1F1A1C",
  "icons": [
    { "src": "/icons/pwa-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/pwa-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/pwa-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" },
    { "src": "/icons/pwa-180-apple.png", "sizes": "180x180", "type": "image/png" }
  ],
  "categories": ["business", "productivity"]
}
```

Generate the four icon files from the existing brand mark (`src/app/icon.svg`):
- `public/icons/pwa-192.png` — 192×192, charcoal background, italic gold S + dot
- `public/icons/pwa-512.png` — 512×512, same
- `public/icons/pwa-512-maskable.png` — 512×512 with a safe zone (icon centered in inner 80%), so Android adaptive icons render correctly
- `public/icons/pwa-180-apple.png` — 180×180, iOS home screen, no rounded corners (iOS adds them)

Use `sharp` for the conversion:

```bash
npm install --save-dev sharp
```

Add a build script `scripts/generate-pwa-icons.mjs` that reads `src/app/icon.svg`, renders to PNG at the four sizes (with the inner-80% padding for the maskable variant), and writes the four files. Wire it into `package.json` as `"icons:pwa": "node scripts/generate-pwa-icons.mjs"`. Run it once and commit the resulting PNGs.

### Layout integration

Update `src/app/layout.tsx`:

```ts
export const metadata: Metadata = {
  // ...existing
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Salonista POS",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icons/pwa-180-apple.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1F1A1C",
};
```

### Install prompt

`src/components/pwa-install-prompt.tsx`:

- Listens for `beforeinstallprompt` event
- Suppresses Chrome's automatic mini-bar with `e.preventDefault()`
- Renders a dismissible banner: **"Ajouter Salonista à l'écran d'accueil — accès rapide au POS"**
- Clicking "Installer" calls `prompt()` and tracks outcome
- Stores dismissal in localStorage with 30-day TTL (key `pwa_install_dismissed_until`)
- iOS fallback: detects iOS Safari (no `beforeinstallprompt`), shows **"Pour installer : appuyez sur l'icône de partage puis 'Sur l'écran d'accueil'"**

Mount it on `/salon-pin` page only — not globally. The salon-pin page is the natural install moment (cashier opens it on the front-desk tablet).

### Service worker registration

Serwist auto-registers via the build output. No manual `navigator.serviceWorker.register()` call needed in client code. Verify in Chrome DevTools → Application → Service Workers that `/sw.js` is registered after a production build.

### Nginx note

Add a one-liner to `scripts/deploy/README.md` under "Notes": **"Nginx must serve `/sw.js` with `Cache-Control: no-cache`. The default config passes through to Next.js, which sets correct headers — no Nginx change needed unless you add explicit caching rules for `.js` files."**

---

## 11. POS placeholder page

`src/app/(dashboard)/prestataire/pos/page.tsx`:

```tsx
// Phase 1 stub — actual POS UI lands in Phase 2

import { ModuleGate } from "@/components/module-gate";
import { requirePermission } from "@/lib/employee-session";

export default async function PosPage() {
  const employee = await requirePermission("pos.sell");
  return (
    <ModuleGate module="POS" providerId={employee.providerId}>
      <div className="p-12">
        <p className="luxury-badge mb-3">Caisse</p>
        <h1 className="luxury-heading text-3xl text-brand-ink">
          Bienvenue, {employee.displayName}
        </h1>
        <p className="text-sm text-brand-ink-soft mt-4">
          L'interface de caisse est en cours de développement (Phase 2).
        </p>
      </div>
    </ModuleGate>
  );
}
```

Add a sidebar nav item "Caisse" to the PROVIDER nav array, **conditionally** — only render it if the provider has the POS module active. Implement via a server component that checks `hasModule()` server-side and passes the active modules list to the client layout, which filters the nav items.

---

## 12. Seed updates

Update `prisma/seed.ts` to add (preserving existing seeds):

- For each existing provider, create:
  - One OWNER `SalonEmployee` linked to their User (no PIN)
  - One CASHIER `SalonEmployee` with `pinHash: bcrypt.hashSync("1234", 10)`, `displayName: "Sarra (Caisse)"` for provider1, `"Mounir (Caisse)"` for provider2, no userId
- 5 sample `Customer` rows with normalized E.164 phones — at least 2 linked to existing CLIENT users via `userId`, the others as walk-ins. Include `firstSalonId` set to provider1 for some, provider2 for others, to exercise cross-salon visibility.
- For provider1: `SalonSubscription { module: POS, status: ACTIVE }` and `SalonSubscription { module: REWARDS, status: TRIAL, expiresAt: +30 days }`
- For provider2: `SalonSubscription { module: POS, status: ACTIVE }` only (no rewards) — contrast case
- Update existing `Booking` seeds to populate the new `customerId` field

Add a comment block at the top of `seed.ts`:

```
// Seed credentials:
//   Provider 1 (POS + Rewards trial):  salon.nour@example.com / password123
//   Provider 2 (POS only):              institut.yasmine@example.com / password123
//   Cashier PIN (both salons):          1234
//   Admin: run `npx tsx scripts/create-admin.ts`
```

---

## 13. CONTEXT.md update

After completing the PR, append a new section to `CONTEXT.md` (after the "Open work / known limitations" section, before "Contacts"):

````md
## Phase 1 additions (foundations + PWA shell)

- **Customer entity** decoupled from User. Walk-ins have a `Customer` row but no `User`.
- **SalonEmployee** with role-based permissions + per-employee JSON override. PIN auth via NextAuth `salon-pin` Credentials provider.
- **SalonSubscription** gates paid modules (POS, REWARDS). Helpers: `hasModule()`, `requireModule()`, `<ModuleGate>`.
- **Tax rate on Offer**: Tunisian TVA (0/7/13/19% + custom).
- **PWA scaffolding**: Serwist, manifest, icons, install prompt on `/salon-pin`. Service worker is empty — Phase 2 adds offline caching strategies and IndexedDB sync queue.

Routes added:
- `/salon-pin` — employee PIN entry (PWA install entry point)
- `/admin/subscriptions` — module activation
- `/prestataire/pos` — placeholder, gated by POS module
- `/api/customers/lookup`, `/api/customers`, `/api/customers/[id]`
- `/api/admin/subscriptions`, `/api/admin/subscriptions/[id]`
- `/api/salon-pin/resolve`

One-time backfill: `npx tsx prisma/backfill-phase1.ts` (idempotent).
````

Also update the "Recurring gotchas" section to add:
- **PWA service worker caches aggressively in production**. After deploying changes that affect `/salon-pin` or `/prestataire/pos`, users may need to close and reopen the installed app for `skipWaiting/clientsClaim` to take effect. Bump a version constant in `sw.ts` if a hard refresh is needed.

---

## What NOT to do

- ❌ POS UI (cart / catalog / calendar / checkout) — Phase 2
- ❌ `Product`, `Sale`, `SaleItem`, `Payment`, `StockMovement`, `CashDrawerSession` models — Phase 2
- ❌ Service worker runtime caching strategies, IndexedDB, sync queue — Phase 2
- ❌ Receipt printing or email — Phase 2
- ❌ Tips, refunds, voids, cash drawer — Phase 2
- ❌ Reward program, wallets, transactions, customer "Mes cartes" — Phase 5
- ❌ Any change to public-facing pages (homepage, salon listing, search, offer detail)
- ❌ Any change to influencer collaboration system, tracking links, commissions
- ❌ Any change to existing booking / offer / slot business logic beyond the additive fields
- ❌ Any change to image upload, opening hours, or slot regeneration logic

If you find yourself touching anything in this list, stop and confirm.

---

## Verification checklist

Before submitting the PR:

1. `npx prisma migrate status` — clean (note: local generate may fail due to the known `effect` bug; that's fine, prod regenerates)
2. `npm run build` — succeeds. Watch the Lightsail OOM constraint; if local build is fine, deploy will be too thanks to the 2 GB swap.
3. `npm run lint` — passes
4. `npx tsx prisma/seed.ts` followed by `npx tsx prisma/backfill-phase1.ts` — both succeed; the backfill is no-op on a second run
5. Phone tests pass: `npx vitest run src/lib/phone.test.ts`
6. **PWA audit** in Chrome DevTools (Lighthouse → PWA section): manifest valid, icons load at all sizes, service worker registers, "installable" check passes, no console errors
7. Manual smoke tests:
   - **Admin**: log in, navigate to `/admin/subscriptions`, see both providers, activate POS for a third (manually-created) provider, verify it persists across reload
   - **`hasModule()`**: verify provider1 has POS+REWARDS, provider2 has POS only, third has POS only after admin activation
   - **Customer lookup cross-salon**: as provider1, lookup a phone whose `firstSalonId === provider1` → returns full profile with stats. As provider2, lookup the same phone → returns degraded `scope: "external"` payload, no email/birthday/notes/stats.
   - **PIN flow**: visit `/salon-pin`, enter `salon.nour@example.com`, see Sarra's tile, tap it, enter `1234`, redirect to `/prestataire/pos` placeholder which renders the welcome banner with employee's display name. Wrong PIN shows error without leaking which employee/PIN is wrong.
   - **PWA install (desktop)**: Chrome on desktop, visit `/salon-pin`, install banner appears, "Installer" launches the standalone window with the manifest's start URL
   - **PWA install (iOS)**: Safari on iOS, visit `/salon-pin`, see the iOS-specific instructions banner instead of the install button
   - **Existing flows untouched**: book a service as a client end-to-end; provider sees it in `/prestataire/reservations`; admin sees it in `/admin/reservations`. No regressions.
8. **CONTEXT.md updated** with the new section above

---

## Deliverables summary

**New files**
- `src/lib/phone.ts` + `src/lib/phone.test.ts`
- `src/lib/permissions.ts`
- `src/lib/modules.ts`
- `src/lib/employee-session.ts`
- `src/components/module-gate.tsx`
- `src/components/pwa-install-prompt.tsx`
- `src/app/sw.ts`
- `src/app/salon-pin/page.tsx` + supporting client component
- `src/app/(dashboard)/admin/subscriptions/page.tsx` + drawer/modal client components
- `src/app/(dashboard)/prestataire/pos/page.tsx` (placeholder)
- `src/app/api/admin/subscriptions/route.ts`
- `src/app/api/admin/subscriptions/[id]/route.ts`
- `src/app/api/customers/lookup/route.ts`
- `src/app/api/customers/route.ts`
- `src/app/api/customers/[id]/route.ts`
- `src/app/api/salon-pin/resolve/route.ts`
- `src/types/next-auth.d.ts` (or update if exists)
- `public/manifest.json`
- `public/icons/pwa-{192,512,512-maskable,180-apple}.png`
- `scripts/generate-pwa-icons.mjs`
- `prisma/backfill-phase1.ts`
- `vitest.config.ts` (only if no test runner exists yet)

**Updated files**
- `prisma/schema.prisma`
- `prisma/seed.ts`
- `src/lib/auth.ts` (second Credentials provider + JWT/session callbacks)
- `src/app/(dashboard)/layout.tsx` (admin nav + provider nav with conditional "Caisse")
- `src/app/layout.tsx` (manifest + appleWebApp + viewport metadata)
- `src/app/(dashboard)/prestataire/offres/...` (TVA field on offer form + API)
- `src/app/api/offers/route.ts` and `[id]/route.ts` (taxRate validation)
- `next.config.ts` (Serwist wrapper)
- `package.json` (deps + `icons:pwa` script)
- `scripts/deploy/README.md` (backfill instructions + sw.js cache header note)
- `CONTEXT.md` (Phase 1 additions + PWA gotcha)

**Migration**
- `prisma/migrations/<timestamp>_phase1_foundations_and_pwa/migration.sql`

---

## PR description template

Title: **Phase 1 — Foundations + PWA scaffolding (employees, customers, subscriptions)**

Body:
```
## What
- New models: Customer, SalonEmployee, SalonSubscription
- Tax rate on Offer (Tunisian TVA)
- Permissions + PIN auth via NextAuth salon-pin provider
- /admin/subscriptions for module activation
- /salon-pin PIN entry page (PWA install entry point)
- /prestataire/pos placeholder gated by POS module
- PWA shell: Serwist + manifest + icons + install prompt

## Migration
1. `prisma migrate deploy` (auto via deploy.sh)
2. `npx tsx prisma/backfill-phase1.ts` (manual, one-time, idempotent)

## Verification
[paste screenshots of Lighthouse PWA audit, /admin/subscriptions page, PIN flow]

## Out of scope (next phases)
- Phase 2: POS UI, Sale/Product models, offline sync queue, runtime SW caching
- Phase 5: Reward program, wallets, customer fidelity cards
```
