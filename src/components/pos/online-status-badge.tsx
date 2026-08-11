"use client";

import { useOnlineStatus } from "./online-status";

export function OnlineStatusBadge() {
  const { online, pendingCount, syncing } = useOnlineStatus();

  if (online && pendingCount === 0) {
    return (
      <span className="inline-flex items-center gap-2 text-xs" title="En ligne">
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        <span className="hidden md:inline">En ligne</span>
      </span>
    );
  }
  if (online && pendingCount > 0) {
    return (
      <span
        className="inline-flex items-center gap-2 text-xs"
        title={syncing ? `Synchronisation… ${pendingCount}` : `En ligne — ${pendingCount} en attente`}
      >
        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="hidden md:inline">
          {syncing ? `Synchronisation… ${pendingCount}` : `En ligne — ${pendingCount} en attente`}
        </span>
        <span className="md:hidden pos-mono">{pendingCount}</span>
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-2 text-xs"
      title={`Hors ligne — ${pendingCount} vente${pendingCount > 1 ? "s" : ""} en attente`}
    >
      <span className="h-2 w-2 rounded-full bg-amber-400" />
      <span className="hidden md:inline">
        Hors ligne — {pendingCount} vente{pendingCount > 1 ? "s" : ""} en attente
      </span>
      <span className="md:hidden pos-mono">{pendingCount}</span>
    </span>
  );
}
