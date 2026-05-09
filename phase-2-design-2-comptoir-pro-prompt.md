# Salonista — Phase 2 (revised): POS Core with Design 2 "Comptoir Pro"

> **This prompt REPLACES the UI portion of the original Phase 2 prompt** (`phase-2-pos-core-prompt.md`). The data model, API routes, offline mode, refunds, receipts, and Tier B sync queue from the original Phase 2 spec are unchanged and assumed below. Read the original Phase 2 prompt first for those — this document only specifies what's new or different.
>
> **Prerequisites**: Phase 1 must be merged. Read `CONTEXT.md` (with Phase 1 additions) and `AGENTS.md`.

---

## What's different from the original Phase 2 prompt

The original prompt assumed a 3-panel layout (Customer | Cart | Catalog) with a mode toggle in the center for cart-vs-calendar. Design 2 ("Comptoir Pro") replaces that with a **4-panel command-palette layout** optimized for high-volume cashiers who type instead of tap.

| Original Phase 2 | This prompt (Design 2) |
|---|---|
| 3 panels: Customer (left) / Cart (center) / Catalog (right) | 4 panels: Rail (60px) / Search results (main) / Cart (380px) / Side panel (320px) |
| Cart and Calendar share the center via mode toggle | Calendar deferred entirely to Phase 3; main panel is search results only |
| Tabbed catalog: Services tab vs Products tab | **Universal search** — services + products in a single mixed result list |
| Customer panel left, calendar/cart center | Customer card lives in the right side panel along with today's bookings + recent sales |
| Brand tokens: `brand-ink`, `brand-cream`, `brand-sand`, `brand-gold` | New POS-scoped tokens: `--pos-bg`, `--pos-ink`, `--pos-accent` etc. (see §1) |
| Touch-first; minimal keyboard | **Keyboard-first**; every primary action has a `⌘`-shortcut shown inline as `<kbd>` |
| Charge button: bottom action bar full-width | Charge button: bottom of cart panel, includes total |

**Everything from the original Phase 2 prompt that is NOT about UI/layout still applies verbatim:**
- Schema additions (`Sale`, `SaleItem`, `Payment`, `TipAllocation`, `Refund`, `RefundItem`, `Product`, `StockMovement`, `SaleSequence`)
- All API routes under `/api/pos/*`
- All helpers (`computeTotals`, `nextReceiptNumber`, `ttcToHt`, `htToTtc`, `formatDT`, `pos-offline-db`)
- Offline (Tier B) capability matrix and sync logic
- Receipt printing + email templates
- Per-line refund logic
- `ProviderProfile.matriculeFiscal` + `receiptFooter` fields
- The `(pos)` route group at `/pos` with full-screen layout
- All seed data
- Phase 2 backfill steps

If anything in this document conflicts with the original prompt, **this document wins for UI/layout/search/keyboard concerns; the original wins for everything else.**

---

## 1. POS theme tokens

Design 2 introduces its own visual language that's deliberately different from the consumer marketplace. The salon-facing customer pages keep `brand-*` tokens. The POS gets its own scoped tokens.

### Add to `src/app/globals.css` (or wherever Tailwind v4 `@theme` definitions live)

```css
@layer base {
  [data-pos-theme] {
    /* Surfaces */
    --pos-bg: #FAFAF7;          /* warm off-white background */
    --pos-surface: #FFFFFF;     /* cards, cart panel */
    --pos-rail: #F2F1EC;        /* left rail */

    /* Borders & lines */
    --pos-border: #E4E2DC;
    --pos-border-strong: #C9C5BB;

    /* Text */
    --pos-ink: #0F0E0F;         /* primary text, near-black */
    --pos-ink-2: #3D3A3C;       /* secondary text */
    --pos-ink-3: #6E6A66;       /* tertiary, muted */
    --pos-ink-4: #9F9B95;       /* placeholders, hints */

    /* Accents */
    --pos-accent: #1FB077;      /* emerald — success, online status */
    --pos-accent-soft: #E5F5EE;
    --pos-highlight: #FFF7D6;   /* yellow — hover, selected, focus */
    --pos-yellow: #FACC15;      /* topbar accent (brand dot, scan border) */
    --pos-warn: #D97706;
    --pos-danger: #C73838;
    --pos-danger-soft: #FEE5E5;
  }
}
```

### Add to Tailwind config

Map the tokens to Tailwind utilities so we can write `bg-pos-bg`, `text-pos-ink`, `border-pos-border`, etc. (Tailwind v4 syntax, adjust as needed for the project's actual config.)

```css
@theme {
  --color-pos-bg: var(--pos-bg);
  --color-pos-surface: var(--pos-surface);
  --color-pos-rail: var(--pos-rail);
  --color-pos-border: var(--pos-border);
  --color-pos-border-strong: var(--pos-border-strong);
  --color-pos-ink: var(--pos-ink);
  --color-pos-ink-2: var(--pos-ink-2);
  --color-pos-ink-3: var(--pos-ink-3);
  --color-pos-ink-4: var(--pos-ink-4);
  --color-pos-accent: var(--pos-accent);
  --color-pos-accent-soft: var(--pos-accent-soft);
  --color-pos-highlight: var(--pos-highlight);
  --color-pos-yellow: var(--pos-yellow);
  --color-pos-warn: var(--pos-warn);
  --color-pos-danger: var(--pos-danger);
  --color-pos-danger-soft: var(--pos-danger-soft);
}
```

### Apply theme

In `src/app/(pos)/layout.tsx`, set `data-pos-theme` on the root element so all POS routes use these tokens:

```tsx
<html data-pos-theme>
  <body className="bg-pos-bg text-pos-ink">
    {children}
  </body>
</html>
```

(Or apply `data-pos-theme` to the `(pos)` layout's root div if it inherits the global `<html>`.)

### Fonts

POS uses three families. Add to `src/app/(pos)/layout.tsx` via `next/font`:

```ts
import { IBM_Plex_Sans, IBM_Plex_Mono, Newsreader } from "next/font/google";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-pos-sans",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-pos-mono",
});
const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["500"],
  style: ["italic"],
  variable: "--font-pos-display",
});
```

- `--font-pos-sans` (IBM Plex Sans) — UI body, headings
- `--font-pos-mono` (IBM Plex Mono) — numbers, SKUs, barcodes, kbd hints, totals
- `--font-pos-display` (Newsreader italic) — brand "salonista." in topbar only

Set `font-pos-sans` as the default body font in the POS layout.

---

## 2. Layout shell

### Grid

`src/app/(pos)/layout.tsx` renders this grid (CSS-grid; absolute pixel widths matter for the cashier mental model — don't make them flexible):

```
┌────────────────────────────────────────────────────────────────────────┐
│  TOPBAR  (48px)                                                        │
├──────┬─────────────────────────────────────┬──────────────┬────────────┤
│      │                                      │              │            │
│ RAIL │  MAIN — Universal search results    │  CART        │  SIDE      │
│ 60px │  flex                                │  380px       │  320px     │
│      │                                      │              │            │
└──────┴─────────────────────────────────────┴──────────────┴────────────┘
```

`grid-template-columns: 60px 1fr 380px 320px;`
`grid-template-rows: 48px 1fr;`

### Responsive

- **≥ 1440px** — full layout as above (target)
- **1280–1440px** — side panel collapses to 280px; cart stays 380px
- **1024–1280px** — side panel hidden behind a toggle (rail button "S"); cart stays 380px; main flexes
- **< 1024px** — emergency mode: cart becomes a bottom sheet pulled up, main goes full-width, side opens as overlay. Show a small banner at first load: "Cet écran est plus confortable sur tablette ou plus grand."

The 1024px threshold is the Phase 2 target minimum. Don't optimize below that.

---

## 3. Topbar

`src/components/pos/topbar.tsx`. Background `var(--pos-ink)` (near-black), 48px tall, white-ish text.

Layout left-to-right with `gap: 18px`:

1. **Brand** — "salonista" in Newsreader italic 18px, `.` colored `var(--pos-yellow)`
2. **Salon context** — small text, e.g. "**Fadwa Dhibi** · La Marsa" (provider name + city). Border-left separator.
3. **Universal search bar** — flex 1, max-width 520px, centered. Dark input background `#1E1C1D`, yellow focus ring on `:focus`. Left icon, right `<kbd>⌘K</kbd>` hint. Placeholder: **"Rechercher service ou produit, scanner un code-barres…"**
4. **Right cluster** — online/offline pill, monospace clock (HH:MM updates every 30s), employee avatar (32px circle, initials, `var(--pos-yellow)` background)

The clock displays the device's local time, formatted `HH:MM` in `--font-pos-mono`. Update via a small `useEffect` interval — do NOT use `Date.now()` in render or it'll cause hydration mismatches.

The online/offline pill renders `<EN LIGNE>` (green dot) or `<HORS LIGNE — N en attente>` (yellow dot + queued count) — wired to the `useOnlineStatus()` hook from the original Phase 2 prompt.

---

## 4. Left rail

`src/components/pos/rail.tsx`. Background `var(--pos-rail)`, 60px wide, vertical stack of icon buttons.

### Items (top to bottom)

| Icon | Label | Route | Shortcut | Permission gate | Phase |
|---|---|---|---|---|---|
| ▦ | Caisse | `/pos` | `1` | `pos.sell` | 2 |
| ⌖ | Bookings | (toggles side panel focus) | `B` | `bookings.view` | 2 |
| ☻ | Clients | `/pos/customers` | `C` | `customers.view` | 2 |
| ☐ | Produits | `/pos/products` | `P` | `inventory.view` | 2 |
| — | (separator) | | | | |
| ⌧ | Ventes | `/pos/sales` | `V` | `pos.sell` | 2 |
| $ | Caisse-fond | `/pos/cash-drawer` | `F` | `pos.cash_drawer` | **3 — render disabled in Phase 2** |
| ⏚ | Analytique | `/pos/analytics` | `A` | `analytics.view` | **3 — render disabled in Phase 2** |

Cash-drawer and Analytique buttons render with reduced opacity and a tooltip: **"Disponible bientôt (Phase 3)"**. Don't link them anywhere — clicks no-op.

### Button anatomy

Each button is 44×44px, rounded 6px, with:
- Centered icon (16px)
- Single-letter shortcut hint absolute-positioned bottom-right at 8px size, `var(--pos-ink-4)` color

Hover: `bg-pos-rail` darker variant + `text-pos-ink`.
Active route: `bg-pos-ink` + `text-pos-bg`, hint color stays muted but visible.

Permission-gated buttons are **hidden** for employees lacking the permission, not disabled. (Cash-drawer/Analytique are the exception — disabled-with-tooltip is the right state for "coming soon".)

### Use real icons, not box-drawing characters

The HTML mockup uses Unicode glyphs (▦, ⌖, ☻ etc.) for portability. **In production use Lucide React icons:**

```tsx
import { LayoutGrid, Calendar, Users, Package, Receipt, Wallet, BarChart3 } from "lucide-react";
```

Map: Caisse → `LayoutGrid`, Bookings → `Calendar`, Clients → `Users`, Produits → `Package`, Ventes → `Receipt`, Caisse-fond → `Wallet`, Analytique → `BarChart3`. Tooltips remain French.

---

## 5. Universal search (the centerpiece)

This is the most novel piece. A single input — pinned in the topbar — searches **services and products together** with relevance ranking. The cashier doesn't pick a tab.

### API: `GET /api/pos/search?q=<query>&limit=20`

Permission: `pos.sell` (any active POS employee).

#### Search logic

Inside the request handler:

```ts
const q = (searchParams.get("q") ?? "").trim();
const limit = Math.min(Number(searchParams.get("limit") ?? 20), 50);

if (q.length === 0) {
  // Empty query → return "frequently used" — top 20 by sales volume in last 30 days,
  // mixing services and products. Cache this query result for 60 seconds (it doesn't change minute-to-minute).
  return Response.json(await getFrequentlyUsed(providerId, limit));
}
```

#### Ranking (when q is non-empty)

Score each candidate item; return top `limit` items sorted by score desc. Same scorer for services and products so they interleave naturally:

1. **Exact barcode match** (products only) — score 1000. Used by USB scanners.
2. **Exact SKU match** (products only) — score 900.
3. **Name starts with q** (case-insensitive, accent-insensitive) — score 500. Add 50 if it starts with the query as a *whole word*.
4. **Name contains q** — score 200.
5. **Description contains q** (services with description, products with description) — score 50.
6. **Category contains q** — score 25.

Tiebreaker (same score): higher sales volume (last 30 days) ranks higher. Final tiebreaker: alphabetical.

#### Response shape

```jsonc
{
  "query": "ker",
  "results": [
    {
      "kind": "PRODUCT",
      "id": "prod_xxx",
      "name": "Kérastase Bain Hydra-Apaisant",
      "category": "Soins capillaires",
      "subtitle": "250ml",                 // size/duration
      "code": "3474636614851",             // barcode for products, "SVC-..." for services
      "salePrice": "95.000",
      "taxRate": "19.00",
      "stock": { "quantity": 12, "threshold": 5, "status": "ok" },  // products only
      "photo": "/uploads/...",
      "score": 1000
    },
    {
      "kind": "SERVICE",
      "id": "off_yyy",
      "name": "Soin Kératine express",
      "category": "Coiffure",
      "subtitle": "30 min",
      "code": "SVC-KER-30",                // synthesized server-side
      "salePrice": "55.000",
      "taxRate": "19.00",
      "duration": 30,
      "score": 200
    }
    // ...
  ]
}
```

The synthesized service code is `SVC-{SLUG}-{DURATION_MIN}`, where SLUG is the first 3–5 uppercase letters of the offer name (latinized). Used for visual parity with product codes in the table. It's display-only — don't store it.

#### Accent-insensitive matching

Use Postgres `unaccent` or a Prisma raw query with `LOWER(unaccent(name)) ILIKE LOWER(unaccent($1)) || '%'`. Tunisian salon names use accents ("Mèches", "Pédicure") and cashiers will not type accents under time pressure. If `unaccent` extension isn't installed, document the migration step in `scripts/deploy/README.md`:

```sql
CREATE EXTENSION IF NOT EXISTS unaccent;
```

### Frontend search behavior

Component: `src/components/pos/universal-search.tsx` (mounts inside `topbar.tsx`).

- Debounced input — 150ms after last keystroke before firing the request
- Cancel in-flight requests when a new query starts (use `AbortController`)
- Empty query → fetch `/api/pos/search?q=` once on mount; cache in-memory for the session
- Result mapping: when a request resolves, push results into a Zustand store (or React context) consumed by the main panel
- **Enter key** in the search input adds the *currently-selected* result to the cart
- **Arrow Down / Up** moves selection through visible results
- **Esc** clears the query and refocuses the input

### Offline behavior

When `useOnlineStatus().online === false`:
- The search bar still works — falls back to **client-side filtering of cached catalog** (Phase 2's `pos-offline-db`).
- Same ranking algorithm runs in JS over the cached array. The catalog endpoint already includes services + products + customers; ensure ranking is implemented in `src/lib/pos-offline-db.ts` as `searchCachedCatalog(q: string, limit: number)`.
- Yellow "Hors ligne" indicator on the topbar tells the cashier results may be stale.

### Frequently used (empty-query state)

`getFrequentlyUsed(providerId, limit)`:

```sql
-- Pseudocode; implement in Prisma
SELECT
  CASE WHEN si.kind = 'SERVICE' THEN o.id ELSE p.id END AS id,
  ...
FROM "SaleItem" si
JOIN "Sale" s ON s.id = si.saleId AND s.status = 'PAID'
LEFT JOIN "Offer" o ON o.id = si.offerId
LEFT JOIN "Product" p ON p.id = si.productId
WHERE s.providerId = $1 AND s.closedAt > NOW() - INTERVAL '30 days'
GROUP BY id
ORDER BY SUM(si.quantity) DESC
LIMIT $2;
```

Cache the result for 60 seconds per `providerId` using a simple in-memory Map keyed by providerId. Invalidation isn't critical — staleness of <1min is fine.

---

## 6. Main panel — search results

`src/components/pos/results.tsx`. Background `var(--pos-bg)`. Renders the universal search results as a dense table.

### Toolbar (top)

Filter chips that *narrow* the universal results to `Tout / Services / Produits / Cartes cadeau`.

- "Tout" is the default
- Cartes cadeau is a placeholder filter for now (gift cards aren't in scope until later); show as disabled with `opacity: 0.4` and tooltip "Cartes cadeau bientôt"
- Sort dropdown right-aligned: "Pertinence (défaut) / Prix ↑ / Prix ↓ / Nom A→Z" with `<kbd>⇧S</kbd>` hint

### Results header (sticky under toolbar)

5-column grid header showing column labels uppercase, 10px, `var(--pos-ink-3)` text, letter-spacing 0.08em:

```
[ ] | ARTICLE | CODE | STOCK | PRIX
```

### Result rows

5-column grid matching header. Per row:

| Col 1 (24px) | Col 2 (1fr) | Col 3 (110px) | Col 4 (72px) | Col 5 (90px) |
|---|---|---|---|---|
| Type badge: square 20×20px, mono "S" or "P", colored | Item name (500 weight) + subtitle (11px, ink-3) | Code in mono | Stock pill (products) or `—` (services) | Price in mono, right-aligned, with "DT TTC" small subscript |

Type badge palette:
- Service: `background: #EAE5DC; color: #6B5A2E;` (warm beige)
- Product: `background: #DCEAE3; color: #1F6F4E;` (cool sage)

Stock pill states (fixed text):
- `quantity > threshold` → "ok" — `bg-pos-accent-soft text-pos-accent`, label is the number
- `0 < quantity ≤ threshold` → "low" — `bg-#FEF3D9 text-#A8731F`, label is the number
- `quantity === 0` → "out" — `bg-pos-danger-soft text-pos-danger`, label "0"

### Row interactions

- **Hover** → `bg-pos-highlight` (yellow tinge)
- **Selected** (via arrow keys) → left border 2px `var(--pos-accent)`, `bg-pos-accent-soft`, padding-left adjusted so layout doesn't shift
- **Click** → add to cart (qty 1) and re-focus the search bar with the current query intact (so cashier can immediately add another)
- **Enter on selected row** → same as click

When a row is added, briefly flash it with `bg-pos-accent-soft` for 250ms (CSS keyframe) so cashier gets visual confirmation without losing focus.

### Barcode prompt (always visible, pinned)

A black bar pinned to the bottom of the main panel (above any cart-bottom-sheet on mobile). Always rendered; always has an input ready for keyboard input from a USB scanner.

```tsx
<BarcodePrompt />  // src/components/pos/barcode-prompt.tsx
```

Behavior:
- Input has `autoComplete="off"` and a hidden style that captures any keypress when no other input is focused (`document.activeElement === document.body`)
- USB scanners send digits + Enter, so on Enter:
  - Trim and validate (digits only, length 8–14)
  - Look up in cached catalog: `findCachedProductByBarcode(barcode)`
  - If found: add to cart, flash the row, beep (Audio API short tone)
  - If not found: shake animation + flash red, no audio cue
  - Clear input ready for next scan
- Visible UI: SCAN icon left, monospace input, hint text right "Auto-ajout au panier · Entrée"

The prompt is a thin black bar (≈40px tall) pinned with `position: sticky; bottom: 0` inside the main panel container — not absolutely positioned over the cart.

---

## 7. Cart panel

`src/components/pos/cart.tsx`. 380px wide, `bg-pos-surface`, left and right borders.

### Header (44px)

- Left: "Panier" + `<span class="ct">3 articles · S-20260506-0042</span>` (article count + receipt number)
- Right: "Vider" button with `<kbd>⌘⌫</kbd>` hint

The receipt number is computed on-the-fly while the cart is in DRAFT status — show the next-expected number for today, fetched once on cart-init from `/api/pos/sales/preview-receipt-number`. Update only when a sale is finalized.

### Booking strip (conditional)

Renders only when `state.attachedBookingId` is non-null. Background `var(--pos-highlight)` (yellow), top border `1px solid #F0E2A0`, 36px tall:

```
[RDV] 15:00 · Yasmine T.    → services pré-remplis     [×]
```

Click `[×]` → detach booking, prompt confirmation if cart has been modified since attaching ("Détacher le RDV ? Les services pré-remplis seront retirés du panier."). On confirm, remove only the items that came from the booking — keep any user-added retail products.

### Cart items

Each item is a 11×16px-padded row, bordered bottom:

**Line 1**: kind tag (mono SVC/PRD, colored bg) + item name + price right-aligned

**Line 2** (smaller, secondary): qty stepper (3 buttons, mono-font qty value) + stylist dropdown ("par Yasmine") + per-line discount tag if applied ("−10%")

**Stylist dropdown** is a native `<select>` styled to look like a dotted underline link. Defaults:
- Service line → current employee
- Product line → none (display "—" instead of dropdown)

**Quantity stepper**: `−` / `value` / `+`. Min 1 (clicking − below 1 removes the line with a confirmation toast "Retirer cet article ?").

**Per-line discount**: not shown in the row directly; clicking the price opens an inline editor (popover) with percent/fixed toggle. After applying, the line shows the discount tag inline on line 2. Gated by `pos.discount` permission — if missing, the price is read-only.

### Action row (between items and summary)

3-column grid of small action buttons, each with label and shortcut:

- **Remise** — `<kbd>⌘D</kbd>` — opens sale-level discount popover
- **Pourboire** — `<kbd>⌘T</kbd>` — opens tip popover
- **Note** — `<kbd>⌘N</kbd>` — opens note popover

Disabled state when cart is empty.

### Summary block

`bg-pos-bg`, top border 2px solid `var(--pos-ink)`, padding 14×16, font-family mono throughout.

```
Sous-total HT       139,081
TVA 19%              26,419
Remise               −9,500
─────────────────────────────────
À régler            156,000 DT
```

The "À régler" row is 18px bold ink, dashed top border, highlighted.

### Charge button

Full-width, `bg-pos-ink`, white text, 14px tall.

Layout: "Encaisser" left, total + `<kbd>⌘P</kbd>` right.

Hover: `bg-pos-accent` (subtle reward for the most-pressed button).

Disabled when cart total = 0.

---

## 8. Side panel

`src/components/pos/side-panel.tsx`. 320px wide, `bg-pos-surface`, scrollable. Three stacked blocks separated by 1px borders.

### Block 1 — Customer

Permission: `customers.view`.

- Header: "Client" + `<kbd>⌘F</kbd>`
- Phone search input with left `⌕` icon. On submit (or after 300ms debounce) calls `/api/customers/lookup?phone=...`
- Below: customer card if found, "Vente sans client" + "Nouveau client" buttons if not
- Customer card shows: name, formatted phone, 3-stat grid (Visites / Total DT / Ticket moy.)
- If REWARDS module active and customer has a wallet: black loyalty row at the bottom of the card with `★ <pts> pts` and `≈ <DT> DT solde fidélité` — informational only in Phase 2; redemption modal is Phase 4

When the customer is identified AND has a booking today (per the bookings query in block 2), highlight the booking row in block 2 with the accent color.

### Block 2 — RDV aujourd'hui

Permission: `bookings.view`.

- Header: "RDV aujourd'hui" + `<kbd>B</kbd>`
- List of today's bookings for this provider, sorted by start time
- Each row shows: time (mono, bold), customer name, service summary, action affordance

Booking states (visual):
- **Past** (`endTime < now`) → muted text, no action
- **Now / In progress** (`startTime ≤ now ≤ endTime`) → `border-l-pos-accent`, `bg-pos-accent-soft`, badge "en cours"
- **Upcoming today** (`startTime > now`, same day) → default surface, `+` icon as action affordance

Click any row:
- Loads the booking's customer into block 1 (if not already loaded)
- Sets `state.attachedBookingId` → triggers booking strip in cart
- Pre-fills cart with the booking's services (snapshot prices via Phase 2's snapshot logic)
- Visually highlights the row and adds "→ chargé" badge

API: `GET /api/pos/bookings/today` (new in Phase 2 — replaces the calendar query that Phase 3 will provide). Returns:

```jsonc
{
  "bookings": [
    {
      "id": "bk_xxx",
      "startTime": "...",
      "endTime": "...",
      "customer": { "id", "phone", "firstName", "lastName" },
      "items": [{ "offerId", "name", "duration", "price", "taxRate" }],
      "status": "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED",
      "saleId": null | "..."
    }
  ]
}
```

Refresh every 60 seconds (when tab is visible).

### Block 3 — Dernières ventes

Permission: `pos.sell`.

- Header: "Dernières ventes" (no shortcut)
- Latest 5 sales for this provider, today only
- Per row: time + receipt number short (`14:18 · S-...0041`) on left, total in mono on right
- Click a row → navigate to `/pos/sales/[id]`

API: `GET /api/pos/sales?providerId=&date=today&limit=5&sort=desc` — already exists in original Phase 2 prompt; pass these params.

### Block 4 — Caisse (placeholder)

**Render as a disabled placeholder card in Phase 2.** Cash drawer is Phase 3.

```
Caisse
─────────────────────
Caisse fermée
Ouverture en Phase 3
```

Muted style. No interactivity. Once Phase 3 ships, this block becomes the live cash drawer mini-status.

---

## 9. Keyboard shortcuts

A first-class feature, not an afterthought. Every shortcut shown in UI as `<kbd>` matches an actual hotkey.

### Global registry

`src/lib/pos-shortcuts.ts`:

```ts
export const POS_SHORTCUTS = {
  "search.focus": { key: "k", meta: true, label: "⌘K", action: "Focus search" },
  "rail.caisse":  { key: "1", label: "1", action: "Aller à la caisse" },
  "rail.bookings":{ key: "b", label: "B", action: "Aller aux RDV du jour" },
  "rail.clients": { key: "c", label: "C", action: "Liste clients" },
  "rail.products":{ key: "p", label: "P", action: "Catalogue produits" },
  "rail.sales":   { key: "v", label: "V", action: "Historique ventes" },
  "cart.discount":{ key: "d", meta: true, label: "⌘D", action: "Remise globale" },
  "cart.tip":     { key: "t", meta: true, label: "⌘T", action: "Pourboire" },
  "cart.note":    { key: "n", meta: true, label: "⌘N", action: "Ajouter une note" },
  "cart.charge":  { key: "p", meta: true, label: "⌘P", action: "Encaisser" },
  "cart.clear":   { key: "Backspace", meta: true, label: "⌘⌫", action: "Vider le panier" },
  "customer.search": { key: "f", meta: true, label: "⌘F", action: "Rechercher client" },
  "results.sort": { key: "s", shift: true, label: "⇧S", action: "Changer le tri" },
  "modal.close":  { key: "Escape", label: "Esc", action: "Fermer" },
} as const;
```

`meta` translates to `Cmd` on Mac, `Ctrl` on Windows/Linux. Detect platform on mount and update `<kbd>` labels accordingly (Mac shows `⌘`, others show `Ctrl`). Use `navigator.platform` or the modern `navigator.userAgentData.platform`.

### Hook

`src/lib/use-pos-shortcuts.ts`:

```ts
export function usePOSShortcut(
  shortcutId: keyof typeof POS_SHORTCUTS,
  handler: (e: KeyboardEvent) => void,
  enabled = true
): void;
```

Implements with a single global keydown listener attached to `document`. Filters out keystrokes when:
- Focus is in an `<input>`, `<textarea>`, or `[contenteditable]` element AND the key isn't in a small whitelist (Esc always works; ⌘K always works since it's the search-focus shortcut)
- A modal is open (other than the modal's own shortcuts like Esc)

### `?` key opens shortcut help

Pressing `?` (no modifier) opens a help overlay listing all shortcuts grouped by section. Esc closes it. Useful for cashier training.

`src/components/pos/shortcut-help-overlay.tsx`.

---

## 10. Charge modal (Phase 2 unchanged, layout note only)

The original Phase 2 prompt fully specifies the charge modal flow: split tender, tip allocation, receipt options, confirm. **No changes in this prompt** — render it identically per the original spec.

The only stylistic note: the charge modal must adopt POS theme tokens (`bg-pos-surface`, `text-pos-ink`, accent colors) rather than the marketplace `brand-*` tokens it would inherit by default.

---

## 11. Past sales / sale detail / refunds (Phase 2 unchanged, theme only)

Same logic as original Phase 2. Theme with POS tokens. Match the dense, monospace-numerals aesthetic of the main POS — sale detail page should feel like an extension of the cash register, not a marketplace receipt.

---

## 12. Product CRUD (Phase 2 unchanged, theme only)

`/pos/products` and friends from the original Phase 2 prompt. Re-themed with POS tokens. The "Nouveau produit" button uses `bg-pos-ink text-pos-bg`, primary action style.

---

## 13. Empty states

Three empty states deserve specific French copy and visual treatment:

### Cart empty

```
─────────────────────────────────────────
              ⌘K
   Cherchez ou scannez un article
   pour démarrer une vente.
─────────────────────────────────────────
```

`text-pos-ink-3`, centered vertically in cart panel above the always-rendered footer.

### No customer selected

(in side panel, block 1 below the search input)

```
Aucun client sélectionné.
Cherchez par téléphone ou créez un nouveau client.

[Vente sans client]   [Nouveau client]
```

### No bookings today

```
Aucun RDV aujourd'hui.
Les nouvelles réservations s'affichent ici.
```

### No recent sales today

```
Première vente du jour ?
Bonne journée, Sarra ✦
```

(Personalize with the employee's first name. Use `✦` as a small accent.)

---

## 14. Animations & motion

Restrained. The design is dense and busy — heavy motion fights it.

- Page-load reveal: 0.3s opacity fade-in only, no slide
- Result row added to cart: 250ms `bg-pos-accent-soft` → transparent fade
- Booking strip appears: 200ms slide-down + fade
- Charge modal: backdrop fade 200ms, modal scale 0.96→1 + fade 200ms
- Hover: 80ms ease (snappy, no lag)
- No spring physics; use `cubic-bezier(0.4, 0, 0.2, 1)` (Tailwind's `ease-out`)

Use Motion (formerly Framer Motion) for the booking strip and charge modal. Static CSS transitions for everything else. Keep the bundle small.

---

## 15. Accessibility

- All keyboard shortcuts must work without mouse
- All interactive elements reachable via Tab in logical order: search → result rows → cart items → cart actions → charge → side panel
- `aria-live="polite"` region on the cart for screen-reader announcements when items are added: "Coupe femme ajouté au panier, total 165,500 dinars"
- Focus rings: 2px `var(--pos-yellow)` outline, offset 2px, on `:focus-visible` only
- Color contrast: verify all text-on-background pairs meet WCAG AA (the warm off-white background can sneak below 4.5:1 with `--pos-ink-3` text — bump to `--pos-ink-2` if needed)
- The barcode prompt input has `aria-label="Champ de scan code-barres"`

---

## 16. What changes in the original Phase 2 deliverables

### Files no longer needed (delete from the original deliverables list)

- `src/components/pos/customer-panel.tsx` (replaced by side-panel block)
- `src/components/pos/cart-panel.tsx` (replaced by `cart.tsx`)
- `src/components/pos/catalog-panel.tsx` (replaced by `results.tsx`)
- `src/components/pos/barcode-input.tsx` (renamed to `barcode-prompt.tsx`, now pinned to main panel bottom)

### New files specific to Design 2

```
src/components/pos/topbar.tsx
src/components/pos/rail.tsx
src/components/pos/universal-search.tsx
src/components/pos/results.tsx
src/components/pos/cart.tsx                  (replaces cart-panel)
src/components/pos/side-panel.tsx
src/components/pos/side-panel/customer-block.tsx
src/components/pos/side-panel/bookings-today-block.tsx
src/components/pos/side-panel/recent-sales-block.tsx
src/components/pos/side-panel/cash-drawer-placeholder.tsx
src/components/pos/booking-strip.tsx
src/components/pos/barcode-prompt.tsx        (replaces barcode-input)
src/components/pos/shortcut-help-overlay.tsx
src/lib/pos-shortcuts.ts
src/lib/use-pos-shortcuts.ts
src/lib/pos-search.ts                        (server-side ranking helpers)

src/app/api/pos/search/route.ts
src/app/api/pos/bookings/today/route.ts
src/app/api/pos/sales/preview-receipt-number/route.ts
```

### Updated files (over and above the original Phase 2 list)

- `src/app/(pos)/layout.tsx` — adds `data-pos-theme`, mounts the four-panel grid, sets up `next/font` for IBM Plex Sans/Mono and Newsreader, wires the `usePOSShortcut` global handlers
- `src/app/(pos)/pos/page.tsx` — wires the four panels together with shared state (Zustand store at `src/lib/pos-store.ts`)
- `src/app/globals.css` — POS theme block scoped under `[data-pos-theme]`
- Tailwind config — POS color tokens
- `src/lib/pos-offline-db.ts` — adds `searchCachedCatalog(q, limit)` matching the server ranking algorithm
- Migration: add `CREATE EXTENSION IF NOT EXISTS unaccent;` (separate migration file `phase2_unaccent_extension`)

### State management

A single Zustand store (`src/lib/pos-store.ts`) holds:

```ts
{
  // Search
  query: string,
  results: SearchResult[],
  selectedIndex: number,
  resultsLoading: boolean,

  // Cart
  cartLines: CartLine[],
  saleDiscount: { value: string, isPercent: boolean } | null,
  tipTotal: string,
  cartNote: string,

  // Customer
  customer: Customer | null,
  customerScope: "own" | "external" | null,

  // Booking
  attachedBookingId: string | null,

  // UI
  filterTab: "ALL" | "SERVICE" | "PRODUCT" | "GIFT_CARD",
  sortBy: "relevance" | "price_asc" | "price_desc" | "name_asc",

  // Actions
  setQuery, addLine, removeLine, updateQty, attachBooking, detachBooking, clearCart, ...
}
```

Why Zustand over Context: keyboard shortcuts dispatch from anywhere; props-drilling 3 levels deep through the panel tree gets ugly; performance matters because the search input fires on every keystroke.

```bash
npm install zustand
```

---

## 17. Verification checklist (Design 2-specific additions)

In addition to the original Phase 2 checklist:

1. **Universal search**:
   - Type "ker" → results include both Kérastase products and Kératine service mixed in one list, sorted by relevance score
   - Paste a product barcode → that exact product is the top result with score 1000
   - Empty query → "frequently used" results render (top 20 from last 30 days)
   - Type French accented term ("Mèches") and unaccented ("Meches") — both return the same results

2. **Keyboard flow** (no mouse):
   - Press `⌘K` → search input gains focus
   - Type "coupe", press Down twice, press Enter → "Coupe femme" appears in cart
   - Press `⌘D` → discount popover opens
   - Press Esc → popover closes
   - Press `⌘P` → charge modal opens
   - Press Esc → modal closes
   - Press `?` → shortcut help overlay appears

3. **Booking attach**:
   - Click a row in "RDV aujourd'hui" with a 15:00 booking → cart shows yellow booking strip, customer block shows that booking's customer, cart has the booking's services pre-filled
   - Click `[×]` on the booking strip with no extra items added → cart clears, no confirmation
   - Add an extra retail product, then click `[×]` → confirmation appears, on confirm only booking services are removed, retail product stays

4. **Barcode prompt**:
   - With cart focused, type a known barcode + Enter → product added, audio beep
   - With search input focused, type the same → search input handles it (barcode prompt does not double-handle)
   - Type unknown barcode + Enter → red flash on prompt, no audio cue

5. **Theme isolation**:
   - Visit `/pos` → POS theme applied (warm off-white, IBM Plex fonts)
   - Visit `/` (marketplace) → original brand theme intact (cream/gold, Cormorant)
   - Visit `/prestataire/profil` → original brand theme intact

6. **Cash drawer placeholder**:
   - Side panel block 4 shows "Caisse fermée — Ouverture en Phase 3" with muted style
   - Rail "Caisse-fond" button shows reduced opacity, tooltip "Disponible bientôt"
   - Rail "Analytique" button: same

7. **Responsive**:
   - At 1440px: full 4-panel layout
   - At 1100px: side panel narrows to 280px
   - At 900px: side panel hidden, toggleable via "S" rail button (or whatever you add for this); banner suggests larger screen

8. **Online ↔ Offline**:
   - Take Chrome offline → search bar still works (cached catalog fallback)
   - Add cached service to cart → works
   - Add cached product via barcode → works
   - Card payment tile → disabled with hover hint
   - Reconnect → queue syncs, receipt number replaces the temp ID

9. **Performance**:
   - Search response time on a salon with 500 products: < 200ms p95 (Postgres `ILIKE` + `unaccent` is fine at that scale; if it slows, add a GIN trigram index on `unaccent(lower(name))`)
   - First Contentful Paint on `/pos` after PIN auth: < 2s on the Lightsail target
   - Bundle size delta from Phase 1: < 250KB gzipped (Zustand small, IBM Plex fonts hosted by `next/font` as preloaded WOFF2)

---

## 18. CONTEXT.md update

Replace the Phase 2 section in `CONTEXT.md` (already-merged Phase 2) with this revised version:

````md
## Phase 2 (revised) — POS Core with Design 2 layout

POS lives at `/pos` (separate top-level route, scoped theme via `[data-pos-theme]`). Four-panel layout: 60px rail | universal search results | 380px cart | 320px side panel. POS uses IBM Plex Sans/Mono + Newsreader italic; warm off-white background; emerald + yellow accents. Marketplace pages keep their `brand-*` tokens unchanged.

- New models: `Product`, `StockMovement`, `Sale`, `SaleItem`, `Payment`, `TipAllocation`, `Refund`, `RefundItem`, `SaleSequence`.
- Receipt numbers `S-YYYYMMDD-NNNN` (daily counter per salon). Offline sales temp ID `OFF-<uuid>` swapped on sync.
- Prices stored TTC (Tunisian convention). HT/TVA derived for receipts.
- Per-line + sale-level discounts (percent or fixed). Per-line refunds. Split tender. Tips with per-employee allocation.
- **Universal search** (`/api/pos/search`) — single endpoint returning services + products mixed with relevance ranking. Empty query returns "frequently used" (top 20 by 30-day sales volume, cached 60s in-memory). Postgres `unaccent` extension required.
- Tier B PWA offline: cached catalog (offers + products + own-scope customers), IndexedDB sync queue for pending sales, Background Sync where available, in-app polling fallback. Cash sales work offline; card and reservation creation are blocked offline.
- Offline indicator + sync queue badge in topbar.
- Conflicts (deleted entities, price drift, stock negative) flagged on `Sale.syncConflicts` and surfaced at `/pos/sync-issues`.
- Provider profile gained `matriculeFiscal` and `receiptFooter` fields.
- **Keyboard shortcuts**: `⌘K` (search), `⌘D` (discount), `⌘T` (tip), `⌘P` (charge), `⌘⌫` (clear), `B C P V 1` (rail), `?` (help overlay). Shortcut registry in `src/lib/pos-shortcuts.ts`. Mac/Win labels detected dynamically.
- **State**: Zustand store at `src/lib/pos-store.ts`.
- Cash drawer side-panel block + rail icon are **placeholder/disabled** in Phase 2; activated in Phase 3. Same for Analytique.

Helpers: `computeTotals()`, `nextReceiptNumber()`, `ttcToHt()`, `htToTtc()`, `taxFromTtc()`, `formatDT()`, `pos-offline-db` IndexedDB layer, `searchCachedCatalog()`, `usePOSShortcut()`.
````

---

## 19. PR description template (revised)

Title: **Phase 2 — POS Core (Design 2: Comptoir Pro)**

```
## What
- POS at /pos with 4-panel command-palette layout (rail | results | cart | side)
- Universal search /api/pos/search — services + products mixed with relevance ranking, accent-insensitive
- Keyboard-first interactions: ⌘K ⌘D ⌘T ⌘P ⌘⌫, rail letters 1 B C P V, help overlay (?)
- POS-scoped theme tokens [data-pos-theme] — does not affect marketplace pages
- IBM Plex Sans/Mono + Newsreader italic for POS only
- All Phase 2 spec: Sale/SaleItem/Payment/TipAllocation/Refund/Product/StockMovement/SaleSequence
- Tier B offline: cached catalog, IndexedDB sync queue, Background Sync, conflict resolution
- Booking attach via side-panel "RDV aujourd'hui" — services pre-fill on click
- Cash drawer + Analytique placeholders (Phase 3)

## Migration
1. `prisma migrate deploy` (auto via deploy.sh) — includes phase2_pos_core and phase2_unaccent_extension
2. No additional one-time scripts

## Verification
[paste screenshots: full POS at 1440px, search with mixed results, cart with booking strip, charge modal, offline state, shortcut help overlay (?), Lighthouse PWA score still passing]

## Out of scope (next phases)
- Phase 3: Cash drawer (open/close/variance), POS reservation calendar, analytics dashboard
- Phase 4: Rewards module — loyalty payment tile in charge modal
```
