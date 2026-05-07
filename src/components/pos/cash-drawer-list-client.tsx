"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDT } from "@/lib/money";

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

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Ouverte",
  CLOSED: "Fermée",
  RECONCILED: "Rapprochée",
};

export function CashDrawerListClient() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.set("from", new Date(from).toISOString());
    if (to) params.set("to", new Date(`${to}T23:59:59`).toISOString());
    const res = await fetch(`/api/pos/cash-drawer?${params.toString()}`);
    if (res.ok) setSessions(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="luxury-badge mb-2">Caisse</p>
          <h1 className="luxury-heading text-3xl text-brand-ink">Sessions de caisse</h1>
        </div>
        <Link
          href="/pos"
          className="text-xs uppercase tracking-[0.18em] text-brand-ink-soft hover:text-brand-ink"
        >
          ← Caisse
        </Link>
      </div>

      <div className="flex gap-3 mb-6">
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded border border-brand-line bg-white px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded border border-brand-line bg-white px-3 py-2 text-sm"
        />
      </div>

      {loading ? (
        <p className="text-sm text-brand-ink-soft">Chargement…</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-brand-line bg-white">
          <table className="w-full text-sm">
            <thead className="bg-brand-sand text-left text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft">
              <tr>
                <th className="px-4 py-3">Ouverture</th>
                <th className="px-4 py-3">Employé·e</th>
                <th className="px-4 py-3 text-right">Fond initial</th>
                <th className="px-4 py-3 text-right">Compté</th>
                <th className="px-4 py-3 text-right">Variance</th>
                <th className="px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const v = s.variance === null ? null : Number(s.variance);
                const color =
                  v === null
                    ? ""
                    : v === 0
                      ? "text-emerald-700"
                      : Math.abs(v) < 5
                        ? "text-amber-700"
                        : "text-red-700";
                return (
                  <tr key={s.id} className="border-t border-brand-line hover:bg-brand-sand/40">
                    <td className="px-4 py-3 text-xs">
                      <Link href={`/pos/cash-drawer/${s.id}`} className="hover:underline">
                        {new Date(s.openedAt).toLocaleString("fr-FR")}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{s.employee.displayName}</td>
                    <td className="px-4 py-3 text-right">{formatDT(s.openingFloat)}</td>
                    <td className="px-4 py-3 text-right">
                      {s.closingCount === null ? "—" : formatDT(s.closingCount)}
                    </td>
                    <td className={`px-4 py-3 text-right ${color}`}>
                      {s.variance === null ? "—" : `${Number(s.variance) > 0 ? "+" : ""}${formatDT(s.variance)}`}
                    </td>
                    <td className="px-4 py-3 text-xs">{STATUS_LABELS[s.status] ?? s.status}</td>
                  </tr>
                );
              })}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-brand-ink-soft">
                    Aucune session.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
