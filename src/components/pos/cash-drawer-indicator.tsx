"use client";

import { useEffect, useState, useCallback } from "react";
import { formatDT } from "@/lib/money";

type Summary = {
  sessionId: string;
  openingFloat: string;
  cashSalesTotal: string;
  cashRefundsTotal: string;
  expectedCash: string;
};

type Session = { id: string; status: string; openedAt: string } | null;

export function CashDrawerIndicator({ canOpen }: { canOpen: boolean }) {
  const [session, setSession] = useState<Session>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [open, setOpen] = useState(false);
  const [openingModal, setOpeningModal] = useState(false);
  const [closingModal, setClosingModal] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/pos/cash-drawer/current", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setSession(data.session);
    setSummary(data.summary ?? null);
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  const isOpen = session?.status === "OPEN";

  return (
    <>
      <button
        type="button"
        onClick={() => (isOpen ? setOpen(true) : canOpen ? setOpeningModal(true) : null)}
        disabled={!canOpen && !isOpen}
        className="inline-flex items-center gap-2 text-xs hover:text-brand-cream/100"
        title={isOpen ? "Caisse ouverte" : "Ouvrir la caisse"}
      >
        <span
          className={`h-2 w-2 rounded-full ${isOpen ? "bg-emerald-400" : "bg-red-400"}`}
        />
        {isOpen
          ? `Caisse · ${formatDT(summary?.expectedCash ?? "0.000")}`
          : "Ouvrir caisse"}
      </button>

      {open && session && summary && (
        <div className="fixed inset-0 z-40 flex">
          <button
            aria-label="Fermer"
            onClick={() => setOpen(false)}
            className="flex-1 bg-black/30"
          />
          <aside className="w-full max-w-sm bg-brand-cream p-6 shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <p className="luxury-badge">Caisse</p>
              <button
                onClick={() => setOpen(false)}
                className="text-brand-ink-soft hover:text-brand-ink"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-brand-ink-soft mb-4">
              Ouverte le {new Date(session.openedAt).toLocaleString("fr-FR")}
            </p>
            <dl className="space-y-2 text-sm mb-6">
              <Row label="Fond initial" value={formatDT(summary.openingFloat)} />
              <Row label="Ventes cash" value={formatDT(summary.cashSalesTotal)} />
              <Row label="Remboursements cash" value={`-${formatDT(summary.cashRefundsTotal)}`} />
              <Row
                label="Attendu en caisse"
                value={formatDT(summary.expectedCash)}
                emphasis
              />
            </dl>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setClosingModal(true);
              }}
              className="w-full rounded-lg bg-brand-ink py-3 text-xs uppercase tracking-[0.18em] text-brand-cream"
            >
              Fermer caisse
            </button>
          </aside>
        </div>
      )}

      {openingModal && (
        <OpenModal
          onClose={() => setOpeningModal(false)}
          onOpened={async () => {
            setOpeningModal(false);
            await refresh();
          }}
        />
      )}

      {closingModal && session && summary && (
        <CloseModal
          sessionId={session.id}
          expectedCash={summary.expectedCash}
          onClose={() => setClosingModal(false)}
          onClosed={async () => {
            setClosingModal(false);
            await refresh();
          }}
        />
      )}
    </>
  );
}

function Row({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-brand-ink-soft">{label}</dt>
      <dd className={emphasis ? "font-semibold" : ""}>{value}</dd>
    </div>
  );
}

function OpenModal({ onClose, onOpened }: { onClose: () => void; onOpened: () => void }) {
  const [openingFloat, setOpeningFloat] = useState("0.000");
  const [openingNotes, setOpeningNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/pos/cash-drawer/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openingFloat, openingNotes: openingNotes || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Erreur ${res.status}`);
        return;
      }
      onOpened();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-brand-cream p-6">
        <p className="luxury-badge mb-2">Ouvrir caisse</p>
        <h2 className="luxury-heading text-xl text-brand-ink mb-4">Fond de caisse</h2>
        <input
          type="number"
          step="0.001"
          min="0"
          value={openingFloat}
          onChange={(e) => setOpeningFloat(e.target.value)}
          className="w-full rounded border border-brand-line bg-white px-3 py-2 text-sm mb-3"
        />
        <textarea
          value={openingNotes}
          onChange={(e) => setOpeningNotes(e.target.value)}
          rows={2}
          placeholder="Notes (optionnel)"
          className="w-full rounded border border-brand-line bg-white px-3 py-2 text-sm mb-3"
        />
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="text-xs uppercase tracking-[0.18em] text-brand-ink-soft"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="rounded-lg bg-brand-ink px-6 py-2 text-xs uppercase tracking-[0.18em] text-brand-cream disabled:opacity-50"
          >
            Ouvrir
          </button>
        </div>
      </div>
    </div>
  );
}

function CloseModal({
  sessionId,
  expectedCash,
  onClose,
  onClosed,
}: {
  sessionId: string;
  expectedCash: string;
  onClose: () => void;
  onClosed: () => void;
}) {
  const [closingCount, setClosingCount] = useState("0.000");
  const [closingNotes, setClosingNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [variance, setVariance] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/pos/cash-drawer/${sessionId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closingCount, closingNotes: closingNotes || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Erreur ${res.status}`);
        return;
      }
      const data = await res.json();
      setVariance(data.summary?.variance ?? null);
    } finally {
      setSubmitting(false);
    }
  }

  if (variance !== null) {
    const v = Number(variance);
    const color = v === 0 ? "text-emerald-700" : Math.abs(v) < 5 ? "text-amber-700" : "text-red-700";
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl bg-brand-cream p-6 text-center">
          <p className="luxury-badge mb-2">Caisse fermée</p>
          <p className="text-sm text-brand-ink-soft">Attendu</p>
          <p className="text-lg">{expectedCash} DT</p>
          <p className="text-sm text-brand-ink-soft mt-3">Compté</p>
          <p className="text-lg">{closingCount} DT</p>
          <p className="text-sm text-brand-ink-soft mt-3">Variance</p>
          <p className={`text-2xl font-semibold ${color}`}>
            {v > 0 ? "+" : ""}
            {variance} DT
          </p>
          <button
            type="button"
            onClick={onClosed}
            className="mt-6 rounded-lg bg-brand-ink px-6 py-2 text-xs uppercase tracking-[0.18em] text-brand-cream"
          >
            OK
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-brand-cream p-6">
        <p className="luxury-badge mb-2">Fermer caisse</p>
        <p className="text-sm text-brand-ink-soft mb-4">Attendu: {expectedCash} DT</p>
        <label className="block text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft mb-1">
          Cash compté (DT)
        </label>
        <input
          type="number"
          step="0.001"
          min="0"
          value={closingCount}
          onChange={(e) => setClosingCount(e.target.value)}
          className="w-full rounded border border-brand-line bg-white px-3 py-2 text-sm mb-3"
        />
        <textarea
          value={closingNotes}
          onChange={(e) => setClosingNotes(e.target.value)}
          rows={2}
          placeholder="Notes (obligatoires si variance ≥ 5 DT)"
          className="w-full rounded border border-brand-line bg-white px-3 py-2 text-sm mb-3"
        />
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="text-xs uppercase tracking-[0.18em] text-brand-ink-soft"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="rounded-lg bg-brand-ink px-6 py-2 text-xs uppercase tracking-[0.18em] text-brand-cream disabled:opacity-50"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
