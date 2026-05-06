"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDT } from "@/lib/money";

type Sale = {
  id: string;
  receiptNumber: string;
  status: string;
  total: string;
  refundedTotal: string;
  createdAt: string;
  customer: { firstName: string | null; lastName: string | null; phone: string } | null;
  employee: { displayName: string };
  _count: { items: number; refunds: number };
};

const STATUS_LABELS: Record<string, string> = {
  PAID: "Payée",
  PARTIALLY_REFUNDED: "Partiellement remboursée",
  REFUNDED: "Remboursée",
  VOIDED: "Annulée",
  PENDING_SYNC: "En attente",
  DRAFT: "Brouillon",
};

function todayISO(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 10);
}

export function SalesListClient() {
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [search, setSearch] = useState("");
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.set("from", new Date(from).toISOString());
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      params.set("to", end.toISOString());
    }
    const res = await fetch(`/api/pos/sales?${params.toString()}`);
    if (res.ok) setSales(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  const filtered = sales.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const hay = `${s.receiptNumber} ${[s.customer?.firstName, s.customer?.lastName].filter(Boolean).join(" ")} ${s.total}`.toLowerCase();
    return hay.includes(q);
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="luxury-badge mb-2">Caisse</p>
          <h1 className="luxury-heading text-3xl text-brand-ink">Ventes</h1>
        </div>
        <Link
          href="/pos"
          className="rounded-lg bg-brand-ink px-4 py-2 text-xs uppercase tracking-[0.18em] text-brand-cream hover:bg-brand-ink-soft"
        >
          Retour caisse
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
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
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="N° reçu, client, montant…"
          className="flex-1 min-w-[200px] rounded border border-brand-line bg-white px-3 py-2 text-sm"
        />
      </div>

      {loading ? (
        <p className="text-sm text-brand-ink-soft">Chargement…</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-brand-line bg-white">
          <table className="w-full text-sm">
            <thead className="bg-brand-sand text-left text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft">
              <tr>
                <th className="px-4 py-3">N° Reçu</th>
                <th className="px-4 py-3">Heure</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Caissier·ère</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Remboursé</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-t border-brand-line hover:bg-brand-sand/40">
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link href={`/pos/sales/${s.id}`} className="text-brand-ink hover:underline">
                      {s.receiptNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-brand-ink-soft text-xs">
                    {new Date(s.createdAt).toLocaleString("fr-FR")}
                  </td>
                  <td className="px-4 py-3">
                    {s.customer
                      ? [s.customer.firstName, s.customer.lastName].filter(Boolean).join(" ") ||
                        s.customer.phone
                      : "—"}
                  </td>
                  <td className="px-4 py-3">{s.employee.displayName}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatDT(s.total)}</td>
                  <td className="px-4 py-3 text-xs">{STATUS_LABELS[s.status] ?? s.status}</td>
                  <td className="px-4 py-3 text-right text-xs text-brand-ink-soft">
                    {Number(s.refundedTotal) > 0 ? `-${formatDT(s.refundedTotal)}` : "—"}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-brand-ink-soft">
                    Aucune vente sur cette période.
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
