"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Delete, Wallet, Lock, Plus, History } from "lucide-react";
import { formatDT } from "@/lib/money";
import { ExpenseModal } from "@/components/pos/expense-modal";

type Session = {
  id: string;
  status: string;
  openedAt: string;
  closedAt: string | null;
  openingFloat: string;
  closingCount: string | null;
  variance: string | null;
  employee: { id: string; displayName: string; role: string };
};

type CurrentSession = {
  id: string;
  openedAt: string;
  openingFloat: string;
  employee: { displayName: string };
};

type Summary = {
  cashSalesCount: number;
  cashSalesTotal: string;
  cardSalesCount?: number;
  cardSalesTotal?: string;
  tipsTotal?: string;
  expensesTotal?: string;
  expectedCash: string;
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Ouverte",
  CLOSED: "Fermée",
  RECONCILED: "Rapprochée",
};

export function CashDrawerListClient() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [current, setCurrent] = useState<CurrentSession | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [closeModal, setCloseModal] = useState(false);
  const [expenseModal, setExpenseModal] = useState(false);

  async function loadAll() {
    setLoading(true);
    const [histRes, curRes] = await Promise.all([
      fetch("/api/pos/cash-drawer"),
      fetch("/api/pos/cash-drawer/current"),
    ]);
    if (histRes.ok) setSessions(await histRes.json());
    if (curRes.ok) {
      const data = await curRes.json();
      setCurrent(data.session ?? null);
      setSummary(data.summary ?? null);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadAll();
  }, []);

  return (
    <div className="md:p-6 p-4 max-w-5xl mx-auto">
      <div className="flex md:items-center items-start justify-between mb-4 md:mb-6 gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="md:text-2xl text-xl font-semibold text-brand-ink flex items-center gap-2">
            <Wallet size={22} /> Tiroir-caisse
          </h1>
          <p className="text-xs md:text-sm text-brand-ink-soft mt-1 hidden md:block">
            Ouverture, dépenses et clôture du tiroir.
          </p>
        </div>
        <Link
          href="/pos"
          className="text-xs uppercase tracking-[0.18em] text-brand-ink-soft hover:text-brand-ink shrink-0"
        >
          ← Caisse
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-brand-ink-soft">Chargement…</p>
      ) : current ? (
        <ActiveSessionCard
          current={current}
          summary={summary}
          onClose={() => setCloseModal(true)}
          onExpense={() => setExpenseModal(true)}
        />
      ) : (
        <OpenDrawerHero onOpen={() => setOpenModal(true)} />
      )}

      {/* Historique */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-3">
          <History size={16} className="text-brand-ink-soft" />
          <h2 className="text-sm font-semibold text-brand-ink">
            Historique des sessions
          </h2>
        </div>

        {sessions.length === 0 ? (
          <p className="text-sm text-brand-ink-soft px-4 py-12 text-center bg-white border border-brand-line rounded-2xl">
            Aucune session.
          </p>
        ) : (
          <div className="space-y-2">
            {sessions
              .filter((s) => s.status !== "OPEN")
              .map((s) => {
                const v = s.variance === null ? null : Number(s.variance);
                const color =
                  v === null
                    ? ""
                    : v === 0
                      ? "text-pos-accent"
                      : Math.abs(v) < 5
                        ? "text-pos-warn"
                        : "text-pos-danger";
                return (
                  <Link
                    key={s.id}
                    href={`/pos/cash-drawer/${s.id}`}
                    className="flex items-center justify-between gap-3 bg-white border border-brand-line rounded-xl px-4 py-3 hover:bg-brand-sand/40"
                  >
                    <div className="text-sm">
                      <div className="font-medium text-brand-ink">
                        {new Date(s.openedAt).toLocaleString("fr-FR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                        {s.closedAt && (
                          <>
                            <span className="text-brand-ink-soft mx-1">→</span>
                            {new Date(s.closedAt).toLocaleString("fr-FR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </>
                        )}
                      </div>
                      <div className="text-xs text-brand-ink-soft mt-0.5">
                        Fond {formatDT(s.openingFloat)} ·{" "}
                        {s.closingCount !== null && (
                          <>Compté {formatDT(s.closingCount)}</>
                        )}{" "}
                        · {STATUS_LABELS[s.status] ?? s.status}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`text-sm font-semibold ${color}`}>
                        Écart{" "}
                        {s.variance === null
                          ? "—"
                          : `${Number(s.variance) > 0 ? "+" : ""}${formatDT(s.variance)}`}
                      </div>
                      <span className="text-xs px-3 py-1 rounded border border-brand-line text-brand-ink hover:bg-brand-sand">
                        Voir Z
                      </span>
                    </div>
                  </Link>
                );
              })}
          </div>
        )}
      </div>

      {openModal && (
        <KeypadModal
          title="Fonds de caisse"
          confirmLabel="Confirmer l'ouverture"
          onCancel={() => setOpenModal(false)}
          onConfirm={async (amount) => {
            const r = await fetch("/api/pos/cash-drawer/open", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ openingFloat: amount }),
            });
            if (r.ok) {
              setOpenModal(false);
              await loadAll();
            }
          }}
        />
      )}

      {closeModal && current && (
        <CloseDrawerModal
          openingFloat={current.openingFloat}
          expectedCash={summary?.expectedCash ?? "0.000"}
          onCancel={() => setCloseModal(false)}
          onConfirm={async (amount) => {
            const r = await fetch(
              `/api/pos/cash-drawer/${current.id}/close`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ closingCount: amount }),
              },
            );
            if (r.ok) {
              setCloseModal(false);
              await loadAll();
            }
          }}
        />
      )}

      {expenseModal && (
        <ExpenseModal
          employeeName={current?.employee.displayName ?? ""}
          onClose={() => setExpenseModal(false)}
          onCreated={loadAll}
        />
      )}
    </div>
  );
}

function OpenDrawerHero({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="bg-white border border-brand-line rounded-2xl p-10 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-pos-accent/10 text-pos-accent mb-4">
        <Wallet size={28} />
      </div>
      <h2 className="text-xl font-semibold text-brand-ink">
        Aucune session ouverte
      </h2>
      <p className="text-sm text-brand-ink-soft mt-2 mb-6">
        Pour commencer à encaisser, ouvrez d&apos;abord le tiroir-caisse en
        renseignant le fonds de caisse de départ.
      </p>
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-pos-accent text-white text-lg font-semibold hover:bg-pos-accent/90 shadow-sm"
      >
        <Wallet size={20} />
        Ouvrir le tiroir
      </button>
    </div>
  );
}

function ActiveSessionCard({
  current,
  summary,
  onClose,
  onExpense,
}: {
  current: CurrentSession;
  summary: Summary | null;
  onClose: () => void;
  onExpense: () => void;
}) {
  return (
    <div className="bg-white border border-brand-line rounded-2xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-pos-accent font-semibold mb-1">
            ● Session ouverte
          </p>
          <div className="text-base font-semibold text-brand-ink">
            {new Date(current.openedAt).toLocaleString("fr-FR", {
              dateStyle: "short",
              timeStyle: "short",
            })}{" "}
            · par {current.employee.displayName}
          </div>
          <div className="text-xs text-brand-ink-soft mt-1">
            Fonds de caisse : {formatDT(current.openingFloat)}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onExpense}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-brand-line text-brand-ink hover:bg-brand-sand"
          >
            <Plus size={16} /> Dépense
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-pos-accent text-white font-medium hover:bg-pos-accent/90"
          >
            <Lock size={16} /> Fermer le tiroir
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi
          label="Ventes espèces"
          value={formatDT(summary?.cashSalesTotal ?? "0.000")}
        />
        <Kpi
          label="Ventes carte"
          value={formatDT(summary?.cardSalesTotal ?? "0.000")}
        />
        <Kpi
          label="Pourboires"
          value={formatDT(summary?.tipsTotal ?? "0.000")}
        />
        <Kpi
          label="Dépenses"
          value={formatDT(summary?.expensesTotal ?? "0.000")}
          highlight
        />
      </div>

      <div className="text-xs text-brand-ink-soft mt-4">
        {summary?.cashSalesCount ?? 0} vente
        {(summary?.cashSalesCount ?? 0) > 1 ? "s" : ""} · Espèces attendues :{" "}
        <strong className="text-brand-ink">
          {formatDT(summary?.expectedCash ?? "0.000")}
        </strong>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${highlight ? "border-pos-warn bg-pos-highlight/50" : "border-brand-line bg-brand-cream/40"}`}
    >
      <div className="text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft mb-1">
        {label}
      </div>
      <div className="text-lg font-semibold text-brand-ink pos-mono">
        {value}
      </div>
    </div>
  );
}

/** Reusable amount keypad with display, used for both opening and closing. */
function Keypad({
  amount,
  setAmount,
}: {
  amount: string;
  setAmount: (a: string) => void;
}) {
  function pressKey(k: string) {
    if (k === ".") {
      if (amount.includes(".")) return;
      setAmount(amount === "" ? "0." : amount + ".");
      return;
    }
    if (amount.includes(".") && amount.split(".")[1].length >= 3) return;
    if (amount === "0") {
      setAmount(k);
      return;
    }
    setAmount(amount + k);
  }
  function backspace() {
    setAmount(amount.slice(0, -1));
  }
  return (
    <>
      <div className="w-full px-4 py-3 border-2 border-pos-accent rounded-lg bg-white text-right text-2xl font-semibold pos-mono text-pos-ink">
        {amount === "" ? "0.000" : amount}
      </div>
      <div className="grid grid-cols-3 gap-2 mt-4">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => pressKey(k)}
            className="py-3 rounded-lg border border-pos-border bg-white text-lg font-medium text-pos-ink hover:bg-pos-highlight"
          >
            {k}
          </button>
        ))}
        <button
          type="button"
          onClick={() => pressKey(".")}
          className="py-3 rounded-lg border border-pos-border bg-white text-lg font-medium text-pos-ink hover:bg-pos-highlight"
        >
          .
        </button>
        <button
          type="button"
          onClick={() => pressKey("0")}
          className="py-3 rounded-lg border border-pos-border bg-white text-lg font-medium text-pos-ink hover:bg-pos-highlight"
        >
          0
        </button>
        <button
          type="button"
          onClick={backspace}
          aria-label="Effacer"
          className="py-3 rounded-lg border border-pos-border bg-white text-pos-ink hover:bg-pos-highlight flex items-center justify-center"
        >
          <Delete size={18} />
        </button>
      </div>
    </>
  );
}

function KeypadModal({
  title,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: (amount: number) => void | Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const num = Number(amount);
  const valid = Number.isFinite(num) && num >= 0 && amount !== "";

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-pos-ink">{title}</h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Fermer"
            className="text-pos-ink-3 hover:text-pos-ink"
          >
            <X size={18} />
          </button>
        </div>
        <Keypad amount={amount} setAmount={setAmount} />
        <button
          type="button"
          disabled={!valid || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm(num);
            } finally {
              setBusy(false);
            }
          }}
          className="w-full mt-5 py-3 rounded-lg bg-pos-accent text-white font-medium hover:bg-pos-accent/90 disabled:opacity-50"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}

function CloseDrawerModal({
  openingFloat,
  expectedCash,
  onCancel,
  onConfirm,
}: {
  openingFloat: string;
  expectedCash: string;
  onCancel: () => void;
  onConfirm: (amount: number) => void | Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const num = Number(amount);
  const valid = Number.isFinite(num) && num >= 0 && amount !== "";
  const variance = valid ? num - Number(expectedCash) : 0;
  const varColor =
    variance === 0
      ? "text-pos-accent"
      : Math.abs(variance) < 5
        ? "text-pos-warn"
        : "text-pos-danger";

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-pos-ink">Fermer le tiroir</h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Fermer"
            className="text-pos-ink-3 hover:text-pos-ink"
          >
            <X size={18} />
          </button>
        </div>

        <div className="rounded-lg bg-brand-cream/40 px-4 py-3 mb-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-brand-ink-soft">Fonds de caisse</span>
            <span className="pos-mono">{formatDT(openingFloat)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-brand-ink-soft">Espèces attendues</span>
            <span className="pos-mono font-semibold">{formatDT(expectedCash)}</span>
          </div>
        </div>

        <label className="block text-sm font-medium text-pos-ink mb-2">
          Espèces comptées
        </label>
        <Keypad amount={amount} setAmount={setAmount} />

        <div className="mt-4 flex items-center justify-between rounded-lg border border-brand-line px-4 py-3">
          <span className="text-sm text-brand-ink">Écart</span>
          <span className={`pos-mono font-semibold ${valid ? varColor : "text-brand-ink-soft"}`}>
            {valid
              ? `${variance > 0 ? "+" : ""}${variance.toFixed(3)} TND`
              : "—"}
          </span>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 rounded-lg border border-brand-line text-pos-ink hover:bg-brand-sand"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={!valid || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm(num);
              } finally {
                setBusy(false);
              }
            }}
            className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-lg bg-pos-accent text-white font-medium hover:bg-pos-accent/90 disabled:opacity-50"
          >
            <Lock size={16} /> Confirmer la fermeture
          </button>
        </div>
      </div>
    </div>
  );
}
