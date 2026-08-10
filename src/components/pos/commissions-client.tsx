"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Coins, Calendar, CheckCircle2, RefreshCw } from "lucide-react";

type Row = {
  employeeId: string;
  displayName: string;
  role: string;
  commissionRate: string | null;
  servicesCount: number;
  baseHT: string;
  commissionPending: string;
  commissionPaid: string;
};

type ApiResponse = {
  period: { from: string; to: string };
  totals: { pending: string; paid: string };
  rows: Row[];
};

type PeriodKey = "last-month" | "this-month" | "last-30" | "custom";

/**
 * Return the [from, to] window for a canned period key. All dates local to
 * the browser, converted to ISO before sending — the server treats the
 * `closedAt` filter in UTC.
 */
function periodWindow(key: PeriodKey, custom?: { from: string; to: string }) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (key === "this-month") {
    const from = new Date(y, m, 1, 0, 0, 0);
    const to = new Date(y, m + 1, 0, 23, 59, 59);
    return { from, to };
  }
  if (key === "last-month") {
    const from = new Date(y, m - 1, 1, 0, 0, 0);
    const to = new Date(y, m, 0, 23, 59, 59);
    return { from, to };
  }
  if (key === "last-30") {
    const to = new Date();
    const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { from, to };
  }
  // custom
  const from = custom?.from ? new Date(custom.from) : new Date();
  const to = custom?.to ? new Date(`${custom.to}T23:59:59`) : new Date();
  return { from, to };
}

function fmtMoney(v: string) {
  return `${Number(v).toLocaleString("fr-FR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })} DT`;
}

export function CommissionsClient() {
  const [period, setPeriod] = useState<PeriodKey>("last-month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const range = useMemo(
    () => periodWindow(period, { from: customFrom, to: customTo }),
    [period, customFrom, customTo],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      });
      const res = await fetch(`/api/pos/commissions?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d?.error ?? "Impossible de charger les commissions.");
        return;
      }
      const json = (await res.json()) as ApiResponse;
      setData(json);
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to]);

  useEffect(() => {
    void load();
  }, [load]);

  async function markPaid(row: Row) {
    if (Number(row.commissionPending) <= 0) return;
    if (
      !confirm(
        `Marquer ${fmtMoney(row.commissionPending)} de commission comme payée à ${row.displayName} ?`,
      )
    )
      return;
    setPayingId(row.employeeId);
    try {
      const res = await fetch("/api/pos/commissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: row.employeeId,
          from: range.from.toISOString(),
          to: range.to.toISOString(),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d?.error ?? "Erreur lors du paiement.");
        return;
      }
      const d = (await res.json()) as { updated: number };
      setFlash(`${d.updated} ligne(s) marquée(s) comme payée(s).`);
      setTimeout(() => setFlash(null), 3000);
      await load();
    } finally {
      setPayingId(null);
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-pos-ink flex items-center gap-2">
            <Coins size={22} /> Commissions
          </h1>
          <p className="text-sm text-pos-ink-3 mt-1">
            Suivi des commissions dues à votre équipe sur les services vendus.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 text-sm text-pos-ink-2 hover:text-pos-ink"
        >
          <RefreshCw size={14} /> Actualiser
        </button>
      </div>

      {/* Period filter */}
      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
        <Calendar size={16} className="text-pos-ink-3" />
        {(
          [
            ["last-month", "Mois dernier"],
            ["this-month", "Ce mois"],
            ["last-30", "30 derniers jours"],
            ["custom", "Personnalisé"],
          ] as Array<[PeriodKey, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setPeriod(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
              period === key
                ? "bg-pos-ink text-white border-pos-ink"
                : "bg-white text-pos-ink-2 border-pos-border hover:border-pos-accent"
            }`}
          >
            {label}
          </button>
        ))}
        {period === "custom" && (
          <div className="flex items-center gap-2 ml-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="px-2 py-1.5 border border-pos-border rounded text-xs"
            />
            <span className="text-pos-ink-3">→</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="px-2 py-1.5 border border-pos-border rounded text-xs"
            />
          </div>
        )}
      </div>

      {flash && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-sm inline-flex items-center gap-2">
          <CheckCircle2 size={16} /> {flash}
        </div>
      )}

      {error && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>
      )}

      {/* KPI totals */}
      {data && (
        <div className="grid grid-cols-2 gap-3 mb-6 max-w-md">
          <div className="rounded-xl border border-amber-300 bg-amber-50/60 p-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-amber-800 font-semibold mb-1">
              À payer
            </div>
            <div className="text-2xl font-semibold text-pos-ink pos-mono">
              {fmtMoney(data.totals.pending)}
            </div>
          </div>
          <div className="rounded-xl border border-emerald-300 bg-emerald-50/60 p-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-800 font-semibold mb-1">
              Déjà payé
            </div>
            <div className="text-2xl font-semibold text-pos-ink pos-mono">
              {fmtMoney(data.totals.paid)}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-pos-ink-3">Chargement…</p>
      ) : !data || data.rows.length === 0 ? (
        <div className="bg-white border border-pos-border rounded-lg p-12 text-center text-sm text-pos-ink-3">
          <Coins size={28} className="mx-auto mb-3 text-pos-ink-4" />
          Aucune commission sur cette période. Configurez un taux dans la
          fiche employé pour commencer.
        </div>
      ) : (
        <div className="bg-white border border-pos-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-pos-bg border-b border-pos-border">
              <tr className="text-left text-xs uppercase tracking-wider text-pos-ink-3">
                <th className="px-4 py-3 font-medium">Employé</th>
                <th className="px-4 py-3 font-medium text-right">Taux</th>
                <th className="px-4 py-3 font-medium text-right">Services</th>
                <th className="px-4 py-3 font-medium text-right">Base HT</th>
                <th className="px-4 py-3 font-medium text-right">Payé</th>
                <th className="px-4 py-3 font-medium text-right">À payer</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.employeeId} className="border-b border-pos-border last:border-0">
                  <td className="px-4 py-3 font-medium text-pos-ink">
                    {r.displayName}
                    <span className="ml-2 text-[10px] uppercase tracking-wider text-pos-ink-3">
                      {r.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right pos-mono text-pos-ink-2">
                    {r.commissionRate ? `${Number(r.commissionRate).toFixed(2)} %` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right pos-mono">{r.servicesCount}</td>
                  <td className="px-4 py-3 text-right pos-mono text-pos-ink-2">
                    {fmtMoney(r.baseHT)}
                  </td>
                  <td className="px-4 py-3 text-right pos-mono text-emerald-700">
                    {fmtMoney(r.commissionPaid)}
                  </td>
                  <td className="px-4 py-3 text-right pos-mono font-semibold text-amber-800">
                    {fmtMoney(r.commissionPending)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={
                        Number(r.commissionPending) <= 0 || payingId === r.employeeId
                      }
                      onClick={() => void markPaid(r)}
                      className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {payingId === r.employeeId ? "…" : "Marquer payée"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
