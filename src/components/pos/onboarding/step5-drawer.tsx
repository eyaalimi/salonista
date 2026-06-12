"use client";
import { useState } from "react";

type Provider = {
  id: string;
  salonName: string;
  _count: { cashDrawerSessions: number };
};

export function Step5Drawer({
  provider,
  employeeId: _employeeId,
  onDone,
  onBack,
}: {
  provider: Provider;
  employeeId: string;
  onDone: () => void;
  onBack: () => void;
}) {
  const [openingFloat, setOpeningFloat] = useState("100.000");
  const [drawerOpen, setDrawerOpen] = useState(provider._count.cashDrawerSessions > 0);
  const [printed, setPrinted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openDrawer() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/pos/cash-drawer/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openingFloat }),
      });
      if (res.ok) {
        setDrawerOpen(true);
      } else {
        const j = await res.json().catch(() => null);
        setError(j?.error ?? "Impossible d'ouvrir la caisse");
      }
    } finally {
      setBusy(false);
    }
  }

  function printTestTicket() {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(
          `onboarding.testTicketPrintedAt.${provider.id}`,
          String(Date.now()),
        );
      } catch {}
    }
    setPrinted(true);
    window.open("/pos/bienvenue/test-print", "_blank");
  }

  return (
    <div className="max-w-xl space-y-4">
      {error && <div className="px-3 py-2 rounded bg-red-50 text-red-800 text-sm">{error}</div>}

      <section className="p-4 rounded border border-pos-border bg-pos-card">
        <h3 className="text-base font-medium mb-2 text-pos-ink">1. Ouvrir le tiroir</h3>
        {!drawerOpen ? (
          <div className="flex gap-2 items-center">
            <input
              aria-label="Fond d'ouverture en DT"
              className="px-3 py-2 rounded border border-pos-border bg-white w-32"
              type="number"
              step="0.001"
              min="0"
              value={openingFloat}
              onChange={(e) => setOpeningFloat(e.target.value)}
            />
            <button
              type="button"
              disabled={busy}
              onClick={openDrawer}
              className="px-4 py-2 rounded bg-pos-ink text-pos-bg disabled:opacity-50"
            >
              Ouvrir avec {openingFloat} DT
            </button>
          </div>
        ) : (
          <p className="text-sm text-green-800">✅ Caisse ouverte avec {Number(openingFloat).toFixed(3)} DT</p>
        )}
      </section>

      <section className="p-4 rounded border border-pos-border bg-pos-card">
        <h3 className="text-base font-medium mb-2 text-pos-ink">2. Tester l&apos;imprimante</h3>
        {!printed ? (
          <button
            type="button"
            onClick={printTestTicket}
            disabled={!drawerOpen}
            className="px-4 py-2 rounded bg-pos-ink text-pos-bg disabled:opacity-50"
          >
            Imprimer un ticket test
          </button>
        ) : (
          <p className="text-sm text-green-800">✅ Ticket test imprimé</p>
        )}
      </section>

      <div className="flex justify-between pt-4">
        <button type="button" onClick={onBack} className="text-sm text-pos-ink-3">← Précédent</button>
        <button
          type="button"
          onClick={onDone}
          disabled={!drawerOpen || !printed}
          className="px-5 py-2 rounded bg-pos-ink text-pos-bg disabled:opacity-50"
        >
          Suivant →
        </button>
      </div>
    </div>
  );
}
