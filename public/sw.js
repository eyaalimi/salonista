// PHASE 1: registration-only service worker (no caching strategies, no precache).
// Phase 2 will add:
//   - StaleWhileRevalidate for /api/customers/lookup
//   - CacheFirst for product catalog
//   - NetworkFirst with timeout for /api/pos/sales (queued offline via Background Sync)
//   - IndexedDB-backed offline cart and sync queue
//
// Bump SW_VERSION when shipping a change that needs clients to refresh.
const SW_VERSION = "phase1-1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// No fetch handler in Phase 1: pass-through to the network for everything.
// Adding a no-op fetch handler still makes the app installable as a PWA in Chrome.
self.addEventListener("fetch", () => {});

// Surface version for diagnostics.
self.addEventListener("message", (event) => {
  if (event.data === "version") {
    event.source?.postMessage({ swVersion: SW_VERSION });
  }
});
