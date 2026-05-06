"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

type OnlineStatus = {
  online: boolean;
  pendingCount: number;
  lastSyncAt: Date | null;
  syncing: boolean;
  setPendingCount: (n: number) => void;
  setSyncing: (s: boolean) => void;
  triggerSync: () => Promise<void>;
};

const Ctx = createContext<OnlineStatus | null>(null);

const HEALTH_INTERVAL_MS = 30_000;

async function probeHealth(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch("/api/health", {
      method: "HEAD",
      cache: "no-store",
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

export function OnlineStatusProvider({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);
  const triggerSyncRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    function onOnline() {
      setOnline(true);
      triggerSyncRef.current().catch(() => {});
    }
    function onOffline() {
      setOnline(false);
    }
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      const ok = await probeHealth();
      if (cancelled) return;
      setOnline(ok);
    }
    tick();
    const interval = setInterval(tick, HEALTH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Refresh pending count on mount + when online flips.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { listPendingSales } = await import("@/lib/pos-offline-db");
      const list = await listPendingSales();
      if (!cancelled) setPendingCount(list.length);
    })();
    return () => {
      cancelled = true;
    };
  }, [online]);

  const triggerSync = async () => {
    if (syncing) return;
    const { attemptSync } = await import("@/lib/pos-offline-db");
    setSyncing(true);
    try {
      await attemptSync();
      setLastSyncAt(new Date());
      const { listPendingSales } = await import("@/lib/pos-offline-db");
      const list = await listPendingSales();
      setPendingCount(list.length);
    } finally {
      setSyncing(false);
    }
  };
  triggerSyncRef.current = triggerSync;

  const value: OnlineStatus = {
    online,
    pendingCount,
    lastSyncAt,
    syncing,
    setPendingCount,
    setSyncing,
    triggerSync,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOnlineStatus(): OnlineStatus {
  const v = useContext(Ctx);
  if (!v) throw new Error("useOnlineStatus must be used within OnlineStatusProvider");
  return v;
}
