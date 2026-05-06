"use client";

import { useOnlineStatus } from "./online-status";

export function OnlineStatusBadge() {
  const { online, pendingCount, syncing } = useOnlineStatus();

  if (online && pendingCount === 0) {
    return (
      <span className="inline-flex items-center gap-2 text-xs">
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        En ligne
      </span>
    );
  }
  if (online && pendingCount > 0) {
    return (
      <span className="inline-flex items-center gap-2 text-xs">
        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        {syncing ? `Synchronisation… ${pendingCount}` : `En ligne — ${pendingCount} en attente`}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 text-xs">
      <span className="h-2 w-2 rounded-full bg-amber-400" />
      Hors ligne — {pendingCount} vente{pendingCount > 1 ? "s" : ""} en attente
    </span>
  );
}
