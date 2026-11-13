"use client";

import { useOnlineStatus } from "./online-status";

export function OnlineStatusBadge() {
  const { online, pendingCount, syncing } = useOnlineStatus();

  // Tout va bien : on n'affiche RIEN. « En ligne » en permanence n'apprenait
  // rien a la caissiere et prenait de la place dans la barre. Le badge ne
  // parle que lorsqu'il y a quelque chose a savoir : hors ligne, ou des
  // ventes en attente de synchronisation.
  if (online && pendingCount === 0) return null;
  if (online && pendingCount > 0) {
    return (
      <span
        className="inline-flex items-center gap-2 text-xs shrink-0"
        title={syncing ? `Synchronisation… ${pendingCount}` : `En ligne — ${pendingCount} en attente`}
      >
        <span className="h-2 w-2 rounded-full bg-pos-accent animate-pulse" />
        <span className="hidden md:inline">
          {syncing ? `Synchronisation… ${pendingCount}` : `En ligne — ${pendingCount} en attente`}
        </span>
        <span className="md:hidden pos-mono">{pendingCount}</span>
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-2 text-xs shrink-0"
      title={`Hors ligne — ${pendingCount} vente${pendingCount > 1 ? "s" : ""} en attente`}
    >
      <span className="h-2 w-2 rounded-full bg-pos-warn" />
      <span className="hidden md:inline">
        Hors ligne — {pendingCount} vente{pendingCount > 1 ? "s" : ""} en attente
      </span>
      <span className="md:hidden pos-mono">{pendingCount}</span>
    </span>
  );
}
