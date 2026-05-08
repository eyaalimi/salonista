"use client";

import { usePosStore } from "@/lib/pos-store";
import { POS_SHORTCUTS, getShortcutLabel, type ShortcutId } from "@/lib/pos-shortcuts";
import { usePOSShortcut } from "@/lib/use-pos-shortcuts";

const GROUPS: Array<{ title: string; ids: ShortcutId[] }> = [
  { title: "Recherche", ids: ["search.focus", "results.sort"] },
  { title: "Panier", ids: ["cart.discount", "cart.tip", "cart.note", "cart.charge", "cart.clear"] },
  { title: "Navigation", ids: ["rail.caisse", "rail.bookings", "rail.clients", "rail.products", "rail.sales"] },
  { title: "Client", ids: ["customer.search"] },
  { title: "Aide", ids: ["help.toggle", "modal.close"] },
];

export function ShortcutHelpOverlay() {
  const open = usePosStore((s) => s.helpOverlayOpen);
  const openHelp = usePosStore((s) => s.openHelp);
  const closeHelp = usePosStore((s) => s.closeHelp);

  usePOSShortcut("help.toggle", () => {
    if (open) closeHelp();
    else openHelp();
  });
  usePOSShortcut("modal.close", () => {
    if (open) closeHelp();
  });

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6"
      onClick={closeHelp}
    >
      <div
        className="bg-pos-surface text-pos-ink rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Raccourcis clavier</h2>
          <button
            type="button"
            onClick={closeHelp}
            className="text-pos-ink-3 hover:text-pos-ink text-xs"
          >
            Esc
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <h3 className="text-[10px] uppercase tracking-[0.18em] text-pos-ink-3 mb-2">
                {g.title}
              </h3>
              <ul className="space-y-1.5 text-sm">
                {g.ids.map((id) => (
                  <li key={id} className="flex items-center justify-between gap-3">
                    <span className="text-pos-ink-2">{POS_SHORTCUTS[id].action}</span>
                    <kbd>{getShortcutLabel(id)}</kbd>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
