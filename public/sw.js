// Salonista POS service worker — Phase 2.
// Uses Workbox via importScripts (no build-time integration; static file).
// Bump SW_VERSION when shipping a change that needs clients to refresh.

const SW_VERSION = "phase2-1";

// Workbox 7.x via Google CDN. Pin the version so the file is hashed/cacheable.
importScripts("https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js");

// Skip the in-SW Workbox debug logs in production.
self.workbox.setConfig({ debug: false });

const { strategies, routing, expiration, core } = self.workbox;

core.skipWaiting();
core.clientsClaim();

// ---- POS shell (HTML for /pos and /salon-pin) ----
routing.registerRoute(
  ({ url, request }) =>
    request.mode === "navigate" &&
    (url.pathname === "/salon-pin" || url.pathname.startsWith("/pos")),
  new strategies.NetworkFirst({
    cacheName: "pos-shell",
    networkTimeoutSeconds: 3,
  }),
);

// ---- POS catalog (services + products + own-scope customers) ----
routing.registerRoute(
  ({ url }) => url.pathname === "/api/pos/catalog",
  new strategies.StaleWhileRevalidate({ cacheName: "pos-catalog" }),
);

// ---- Customer lookup ----
routing.registerRoute(
  ({ url }) => url.pathname.startsWith("/api/customers/lookup"),
  new strategies.StaleWhileRevalidate({ cacheName: "customer-lookup" }),
);

// ---- Health endpoint (small, frequent — keep cache out of the way) ----
routing.registerRoute(
  ({ url }) => url.pathname === "/api/health",
  new strategies.NetworkFirst({
    cacheName: "health",
    networkTimeoutSeconds: 4,
  }),
);

// ---- Uploads / images (cache-first) ----
routing.registerRoute(
  ({ request, url }) =>
    request.destination === "image" &&
    (url.pathname.startsWith("/uploads/") || url.pathname.startsWith("/images/")),
  new strategies.CacheFirst({
    cacheName: "uploads",
    plugins: [
      new expiration.ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 7 * 24 * 60 * 60,
      }),
    ],
  }),
);

// ---- Static Next.js assets (build-hashed; cache aggressively) ----
routing.registerRoute(
  ({ url }) => url.pathname.startsWith("/_next/static/"),
  new strategies.CacheFirst({
    cacheName: "next-static",
    plugins: [
      new expiration.ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  }),
);

// ---- Note ----
// POSTs to /api/pos/sales and /api/pos/sales/sync are NOT cached.
// They go straight to the network. The IndexedDB queue (src/lib/pos-offline-db.ts)
// re-tries them when connectivity returns.

// Surface SW_VERSION for diagnostics.
self.addEventListener("message", (event) => {
  if (event.data === "version") {
    event.source?.postMessage({ swVersion: SW_VERSION });
  }
});

// Best-effort Background Sync trigger from the page.
self.addEventListener("sync", (event) => {
  if (event.tag === "pos-sale-sync") {
    event.waitUntil(
      (async () => {
        const clients = await self.clients.matchAll({ type: "window" });
        for (const client of clients) {
          client.postMessage({ type: "trigger-sync" });
        }
      })(),
    );
  }
});
