"use client";

import { useEffect } from "react";

export function SwRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          // Try to register Background Sync (Chrome/Android only).
          // Safari and iOS will silently no-op; the in-app polling fallback
          // in OnlineStatusProvider covers them.
          if ("sync" in reg) {
            // Use the Sync Manager API.
            (reg as ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } })
              .sync?.register("pos-sale-sync")
              .catch(() => {});
          }
        })
        .catch(() => {
          // Silently ignore registration failures — non-fatal.
        });

      // Listen for trigger-sync messages from the SW (Background Sync wakeup).
      navigator.serviceWorker.addEventListener("message", async (event) => {
        if (event.data?.type === "trigger-sync") {
          try {
            const { attemptSync } = await import("@/lib/pos-offline-db");
            await attemptSync();
          } catch {
            // ignore
          }
        }
      });
    };

    if (document.readyState === "complete") {
      onLoad();
    } else {
      window.addEventListener("load", onLoad);
      return () => window.removeEventListener("load", onLoad);
    }
  }, []);

  return null;
}
