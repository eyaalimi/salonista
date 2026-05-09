"use client";

import { useEffect } from "react";
import { matchesShortcut, POS_SHORTCUTS, type ShortcutId } from "./pos-shortcuts";

/**
 * Register a keyboard shortcut handler scoped to the POS shell.
 *
 * - Listens on `document`.
 * - Suppresses inside <input>/<textarea>/[contenteditable] EXCEPT for an
 *   "always-active" whitelist (search.focus, modal.close, help.toggle).
 *
 * Caller is responsible for `preventDefault()` if needed (we already do it
 * for the meta-modified shortcuts so the browser's default action — like
 * Cmd+P print or Cmd+D bookmark — doesn't fire).
 */
export function usePOSShortcut(
  shortcutId: ShortcutId,
  handler: (e: KeyboardEvent) => void,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!matchesShortcut(e, shortcutId)) return;

      const target = e.target as HTMLElement | null;
      const inEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      const alwaysActive: ShortcutId[] = ["search.focus", "modal.close", "help.toggle"];
      if (inEditable && !alwaysActive.includes(shortcutId)) return;

      // Meta-shortcuts hijack default browser behavior.
      const s = POS_SHORTCUTS[shortcutId];
      if (("meta" in s && s.meta) || ("shift" in s && s.shift) || s.key === "Escape" || s.key === "?") {
        e.preventDefault();
      }
      handler(e);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [shortcutId, handler, enabled]);
}
