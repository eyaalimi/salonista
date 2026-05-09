/**
 * Phase 2 Design 2 — keyboard shortcut registry.
 *
 * Every shortcut shown in UI as `<kbd>` corresponds to one of these IDs.
 * Mac labels (⌘) vs Windows/Linux labels (Ctrl) are picked per-platform
 * at render time via `getShortcutLabel()`.
 */

export const POS_SHORTCUTS = {
  "search.focus":     { key: "k",         meta: true,  label: "K",         action: "Focus recherche" },
  "rail.caisse":      { key: "1",                       label: "1",         action: "Aller à la caisse" },
  "rail.bookings":    { key: "b",                       label: "B",         action: "RDV du jour" },
  "rail.clients":     { key: "c",                       label: "C",         action: "Clients" },
  "rail.products":    { key: "p",                       label: "P",         action: "Produits" },
  "rail.sales":       { key: "v",                       label: "V",         action: "Ventes" },
  "cart.discount":    { key: "d",         meta: true,  label: "D",         action: "Remise globale" },
  "cart.tip":         { key: "t",         meta: true,  label: "T",         action: "Pourboire" },
  "cart.note":        { key: "n",         meta: true,  label: "N",         action: "Note" },
  "cart.charge":      { key: "Enter",     meta: true,  label: "Entrée",    action: "Encaisser" },
  "cart.clear":       { key: "Backspace", meta: true,  label: "⌫",         action: "Vider le panier" },
  "customer.search":  { key: "f",         meta: true,  label: "F",         action: "Chercher client" },
  "results.sort":     { key: "s",         shift: true, label: "S",         action: "Changer le tri" },
  "modal.close":      { key: "Escape",                  label: "Esc",       action: "Fermer" },
  "help.toggle":      { key: "?",                       label: "?",         action: "Aide raccourcis" },
} as const;

export type ShortcutId = keyof typeof POS_SHORTCUTS;

/** True on macOS — show ⌘ instead of Ctrl. SSR-safe (returns false on server). */
export function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  const platform = navigator.platform || "";
  return /Mac|iPhone|iPad|iPod/.test(platform);
}

export function getShortcutLabel(id: ShortcutId): string {
  const s = POS_SHORTCUTS[id];
  const meta = "meta" in s && s.meta ? (isMac() ? "⌘" : "Ctrl+") : "";
  const shift = "shift" in s && s.shift ? "⇧" : "";
  return `${meta}${shift}${s.label}`;
}

export function matchesShortcut(e: KeyboardEvent, id: ShortcutId): boolean {
  const s = POS_SHORTCUTS[id];
  const wantMeta = "meta" in s && s.meta;
  const wantShift = "shift" in s && s.shift;
  const isMetaPressed = e.metaKey || e.ctrlKey;
  if (wantMeta && !isMetaPressed) return false;
  if (!wantMeta && isMetaPressed) return false;
  if (wantShift && !e.shiftKey) return false;
  return e.key.toLowerCase() === s.key.toLowerCase() || e.key === s.key;
}
