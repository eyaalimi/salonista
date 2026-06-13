"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDT } from "@/lib/money";

type Expense = {
  id: string;
  amount: string | number;
  reason: string;
  category: string;
  createdAt: string;
  employee: { displayName: string };
};

type Session = {
  id: string;
  status: string;
  openedAt: string;
  closedAt: string | null;
  reconciledAt: string | null;
  openingFloat: string;
  closingCount: string | null;
  expectedCash: string | null;
  variance: string | null;
  openingNotes: string | null;
  closingNotes: string | null;
  employee: { displayName: string; role: string };
  payments: Array<{
    id: string;
    method: string;
    amount: string;
    reference: string | null;
    createdAt: string;
    sale: { id: string; receiptNumber: string };
  }>;
};

type Summary = {
  cashSalesCount: number;
  cashSalesTotal: string;
  cashRefundsCount: number;
  cashRefundsTotal: string;
  expectedCash: string;
};

const METHOD_LABELS: Record<string, string> = {
  CASH: "Espèces",
  CARD: "Carte",
  TRANSFER: "Virement",
  OTHER: "Autre",
};

export function CashDrawerDetailClient({
  sessionId,
  canReconcile,
}: {
  sessionId: string;
  canReconcile: boolean;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expensesTotal, setExpensesTotal] = useState<string>("0.000");

  async function load() {
    setLoading(true);
    const [s, sum] = await Promise.all([
      fetch(`/api/pos/cash-drawer/${sessionId}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/pos/cash-drawer/${sessionId}/summary`).then((r) => (r.ok ? r.json() : null)),
    ]);
    setSession(s);
    setSummary(sum);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    if (!session || session.status !== "OPEN") return;
    let cancelled = false;
    (async () => {
      const r = await fetch("/api/pos/drawer/expenses", { cache: "no-store" });
      if (!r.ok || cancelled) return;
      const j = await r.json();
      setExpenses(j.expenses ?? []);
      setExpensesTotal(j.total ?? "0.000");
    })();
    return () => { cancelled = true; };
  }, [session]);

  async function removeExpense(id: string) {
    if (!confirm("Supprimer cette dépense ?")) return;
    const r = await fetch(`/api/pos/drawer/expenses/${id}`, { method: "DELETE" });
    if (r.ok) {
      setExpenses((arr) => arr.filter((x) => x.id !== id));
      const r2 = await fetch("/api/pos/drawer/expenses", { cache: "no-store" });
      if (r2.ok) {
        const j = await r2.json();
        setExpensesTotal(j.total ?? "0.000");
      }
    }
  }

  async function reconcile() {
    if (!confirm("Marquer cette session comme rapprochée ?")) return;
    setError(null);
    const res = await fetch(`/api/pos/cash-drawer/${sessionId}/reconcile`, {
      method: "POST",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erreur");
      return;
    }
    await load();
  }

  if (loading) return <p className="p-6 text-sm text-brand-ink-soft">Chargement…</p>;
  if (!session) return <p className="p-6 text-sm text-red-600">Session introuvable</p>;

  const v = session.variance === null ? null : Number(session.variance);
  const varColor =
    v === null
      ? ""
      : v === 0
        ? "text-emerald-700"
        : Math.abs(v) < 5
          ? "text-amber-700"
          : "text-red-700";

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="luxury-badge mb-2">Caisse</p>
          <h1 className="luxury-heading text-3xl text-brand-ink">Session</h1>
        </div>
        <Link
          href="/pos/cash-drawer"
          className="text-xs uppercase tracking-[0.18em] text-brand-ink-soft hover:text-brand-ink"
        >
          ← Sessions
        </Link>
      </div>

      <div className="rounded-2xl border border-brand-line bg-white p-6 mb-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <Field label="Employé·e" value={session.employee.displayName} />
          <Field label="Statut" value={session.status} />
          <Field
            label="Ouverte le"
            value={new Date(session.openedAt).toLocaleString("fr-FR")}
          />
          <Field
            label="Fermée le"
            value={
              session.closedAt
                ? new Date(session.closedAt).toLocaleString("fr-FR")
                : "—"
            }
          />
          <Field label="Fond initial" value={formatDT(session.openingFloat)} />
          {summary && (
            <>
              <Field
                label="Ventes cash"
                value={`${summary.cashSalesCount} (${formatDT(summary.cashSalesTotal)})`}
              />
              <Field
                label="Remboursements cash"
                value={`${summary.cashRefundsCount} (-${formatDT(summary.cashRefundsTotal)})`}
              />
              <Field label="Attendu" value={formatDT(summary.expectedCash)} />
            </>
          )}
          {session.closingCount && (
            <Field label="Compté" value={formatDT(session.closingCount)} />
          )}
          {session.variance !== null && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft">
                Variance
              </p>
              <p className={`text-lg font-semibold ${varColor}`}>
                {Number(session.variance) > 0 ? "+" : ""}
                {formatDT(session.variance)}
              </p>
            </div>
          )}
        </div>

        {session.openingNotes && (
          <p className="mt-4 text-xs italic text-brand-ink-soft">
            <strong>Ouverture:</strong> {session.openingNotes}
          </p>
        )}
        {session.closingNotes && (
          <p className="mt-2 text-xs italic text-brand-ink-soft">
            <strong>Fermeture:</strong> {session.closingNotes}
          </p>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {canReconcile && session.status === "CLOSED" && (
        <button
          type="button"
          onClick={reconcile}
          className="mb-6 rounded-lg bg-brand-ink px-4 py-2 text-xs uppercase tracking-[0.18em] text-brand-cream hover:bg-brand-ink-soft"
        >
          Marquer comme rapprochée
        </button>
      )}

      <div className="rounded-2xl border border-brand-line bg-white p-6">
        <h2 className="luxury-heading text-lg text-brand-ink mb-3">Paiements liés</h2>
        {session.payments.length === 0 ? (
          <p className="text-sm text-brand-ink-soft">Aucun paiement.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {session.payments.map((p) => (
              <li key={p.id} className="flex justify-between border-b border-brand-line py-2 last:border-0">
                <span>
                  <Link
                    href={`/pos/sales/${p.sale.id}`}
                    className="font-mono text-xs text-brand-ink hover:underline"
                  >
                    {p.sale.receiptNumber}
                  </Link>
                  <span className="ml-3 text-xs text-brand-ink-soft">
                    {new Date(p.createdAt).toLocaleTimeString("fr-FR")} ·{" "}
                    {METHOD_LABELS[p.method] ?? p.method}
                  </span>
                </span>
                <span>{formatDT(p.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {expenses.length > 0 && (
        <div className="rounded-2xl border border-brand-line bg-white p-6 mt-6">
          <h2 className="luxury-heading text-lg text-brand-ink mb-3">
            Dépenses ({expenses.length}) — Total {Number(expensesTotal).toFixed(3)} DT
          </h2>
          <ul className="space-y-2">
            {expenses.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between border border-brand-line rounded px-3 py-2 text-sm"
              >
                <div>
                  <p className="text-brand-ink">
                    {e.category} — {Number(e.amount).toFixed(3)} DT
                  </p>
                  <p className="text-xs text-brand-ink-soft">
                    {e.reason} · {new Date(e.createdAt).toLocaleTimeString("fr-FR")} · {e.employee.displayName}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft">{label}</p>
      <p>{value}</p>
    </div>
  );
}
