"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import { formatDT } from "@/lib/money";

type Range = { from: Date; to: Date };

type Summary = {
  current: { netRevenue: string; paidCount: number; refundTotal: string; newCustomers: number; avgTicket: string | null };
  previous: { netRevenue: string; paidCount: number; refundTotal: string; newCustomers: number };
};

type RevenuePoint = { key: string; revenue: string; transactions: number };
type TopRow = { name: string; quantity: number; revenue: string };
type EmployeeRow = { employeeId: string; name: string; sales: number; revenue: string; tips: string; itemsCount: number };
type HeatmapCell = { dow: number; hour: number; count: number; revenue: string };
type LowStockRow = { id: string; name: string; sku: string; stockQuantity: number; lowStockThreshold: number; lastSoldAt: string | null };

const PRESETS = [
  { value: "today", label: "Aujourd'hui" },
  { value: "yesterday", label: "Hier" },
  { value: "7d", label: "7 derniers jours" },
  { value: "30d", label: "30 derniers jours" },
  { value: "thisMonth", label: "Ce mois" },
  { value: "lastMonth", label: "Mois dernier" },
];

function preset(value: string): Range {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);
  switch (value) {
    case "today":
      return { from: startOfToday, to: endOfToday };
    case "yesterday": {
      const f = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
      const t = new Date(startOfToday.getTime() - 1);
      return { from: f, to: t };
    }
    case "7d":
      return { from: new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000), to: endOfToday };
    case "30d":
      return { from: new Date(startOfToday.getTime() - 30 * 24 * 60 * 60 * 1000), to: endOfToday };
    case "thisMonth":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfToday };
    case "lastMonth":
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        to: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
      };
    default:
      return { from: startOfToday, to: endOfToday };
  }
}

function deltaPct(curr: number, prev: number): { pct: number; sign: "+" | "−" | "" } {
  if (prev === 0) return { pct: 0, sign: "" };
  const diff = ((curr - prev) / prev) * 100;
  return {
    pct: Math.round(Math.abs(diff)),
    sign: diff > 0 ? "+" : diff < 0 ? "−" : "",
  };
}

export function AnalyticsClient() {
  const router = useRouter();
  const search = useSearchParams();

  const initialRange = useMemo(() => {
    const fromStr = search.get("from");
    const toStr = search.get("to");
    if (fromStr && toStr) return { from: new Date(fromStr), to: new Date(toStr) };
    return preset("7d");
  }, [search]);

  const [range, setRange] = useState<Range>(initialRange);
  const [presetValue, setPresetValue] = useState("7d");

  const [summary, setSummary] = useState<Summary | null>(null);
  const [revenue, setRevenue] = useState<RevenuePoint[]>([]);
  const [topServices, setTopServices] = useState<TopRow[]>([]);
  const [topProducts, setTopProducts] = useState<TopRow[]>([]);
  const [byEmployee, setByEmployee] = useState<EmployeeRow[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapCell[]>([]);
  const [lowStock, setLowStock] = useState<LowStockRow[]>([]);
  const [margin, setMargin] = useState<{ total: string; excludedCount: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const setPreset = (v: string) => {
    setPresetValue(v);
    setRange(preset(v));
  };

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      from: range.from.toISOString(),
      to: range.to.toISOString(),
    });
    // Reflect in URL for shareable links.
    router.replace(`/pos/analytics?${params.toString()}`, { scroll: false });

    try {
      const [s, r, ts, tp, be, hm, ls, mg] = await Promise.all([
        fetch(`/api/pos/analytics/summary?${params}`).then((r) => r.json()),
        fetch(`/api/pos/analytics/revenue?${params}`).then((r) => r.json()),
        fetch(`/api/pos/analytics/top-services?${params}`).then((r) => r.json()),
        fetch(`/api/pos/analytics/top-products?${params}`).then((r) => r.json()),
        fetch(`/api/pos/analytics/by-employee?${params}`).then((r) => r.json()),
        fetch(`/api/pos/analytics/heatmap?${params}`).then((r) => r.json()),
        fetch(`/api/pos/analytics/low-stock`).then((r) => r.json()),
        fetch(`/api/pos/analytics/product-margin?${params}`).then((r) => r.ok ? r.json() : null).catch(() => null),
      ]);
      setSummary(s);
      setRevenue(r.points ?? []);
      setTopServices(ts.top ?? []);
      setTopProducts(tp.top ?? []);
      setByEmployee(be.rows ?? []);
      setHeatmap(hm.cells?.flat() ?? []);
      setLowStock(ls.products ?? []);
      setMargin(mg ?? null);
    } finally {
      setLoading(false);
    }
  }, [range, router]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="md:p-6 p-4 max-w-6xl mx-auto">
      <div className="flex md:items-center items-start justify-between mb-4 md:mb-6 gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="luxury-badge mb-2">Analytique</p>
          <h1 className="luxury-heading md:text-3xl text-2xl text-brand-ink">Tableau de bord</h1>
        </div>
        <Link
          href="/pos"
          className="text-xs uppercase tracking-[0.18em] text-brand-ink-soft hover:text-brand-ink shrink-0"
        >
          ← Caisse
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select
          value={presetValue}
          onChange={(e) => setPreset(e.target.value)}
          className="rounded border border-brand-line bg-white px-3 py-2 text-sm"
        >
          {PRESETS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        <a
          href={`/api/pos/analytics/export.csv?from=${range.from.toISOString()}&to=${range.to.toISOString()}&type=sales`}
          className="rounded-lg border border-brand-line bg-white px-3 py-2 text-xs uppercase tracking-[0.18em] text-brand-ink hover:border-brand-gold"
        >
          Export ventes (CSV)
        </a>
        <a
          href={`/api/pos/analytics/export.csv?from=${range.from.toISOString()}&to=${range.to.toISOString()}&type=refunds`}
          className="rounded-lg border border-brand-line bg-white px-3 py-2 text-xs uppercase tracking-[0.18em] text-brand-ink hover:border-brand-gold"
        >
          Export remboursements (CSV)
        </a>
        <a
          href={`/api/pos/analytics/export.csv?from=${range.from.toISOString()}&to=${range.to.toISOString()}&type=drawer`}
          className="rounded-lg border border-brand-line bg-white px-3 py-2 text-xs uppercase tracking-[0.18em] text-brand-ink hover:border-brand-gold"
        >
          Export caisse (CSV)
        </a>
      </div>

      {/* KPI tiles */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <KpiTile
            label="Revenu net"
            value={formatDT(summary.current.netRevenue)}
            delta={deltaPct(Number(summary.current.netRevenue), Number(summary.previous.netRevenue))}
          />
          <KpiTile
            label="Ventes payées"
            value={String(summary.current.paidCount)}
            delta={deltaPct(summary.current.paidCount, summary.previous.paidCount)}
          />
          <KpiTile
            label="Ticket moyen"
            value={summary.current.avgTicket ? formatDT(summary.current.avgTicket) : "—"}
          />
          <KpiTile
            label="Nouveaux clients"
            value={String(summary.current.newCustomers)}
            delta={deltaPct(summary.current.newCustomers, summary.previous.newCustomers)}
          />
        </div>
      )}

      {/* Product margin estimation card */}
      {margin && (
        <div className="rounded-2xl border border-brand-line bg-white p-5 mb-6">
          <p className="text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft">
            Marge produits — estimation
          </p>
          <p className="luxury-heading text-2xl text-brand-ink mt-1">
            {Number(margin.total).toFixed(3)} DT
          </p>
          {margin.excludedCount > 0 && (
            <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft">
              {margin.excludedCount} produit·s sans coût exclu·s du calcul
            </p>
          )}
        </div>
      )}

      {/* Revenue chart */}
      <div className="rounded-2xl border border-brand-line bg-white p-6 mb-6">
        <h2 className="luxury-heading text-lg text-brand-ink mb-3">Revenu</h2>
        {revenue.length === 0 ? (
          <p className="text-sm text-brand-ink-soft py-12 text-center">
            Aucune donnée pour cette période.
          </p>
        ) : (
          <div style={{ height: 240 }}>
            <ResponsiveContainer>
              <LineChart data={revenue.map((p) => ({ ...p, revenueNum: Number(p.revenue) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E2D7" />
                <XAxis dataKey="key" stroke="#4A4244" tick={{ fontSize: 11 }} />
                <YAxis stroke="#4A4244" tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value) => {
                    const n = typeof value === "number" ? value : Number(value);
                    return [`${n.toFixed(3)} DT`, "Revenu"];
                  }}
                  contentStyle={{ fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="revenueNum"
                  stroke="#D4A574"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <TopChart title="Top services" data={topServices} />
        <TopChart title="Top produits" data={topProducts} />
      </div>

      {/* Heatmap */}
      <div className="rounded-2xl border border-brand-line bg-white p-6 mb-6">
        <h2 className="luxury-heading text-lg text-brand-ink mb-3">
          Heures d&apos;affluence
        </h2>
        <Heatmap cells={heatmap} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-brand-line bg-white p-6">
          <h2 className="luxury-heading text-lg text-brand-ink mb-3">Revenu par employé</h2>
          {byEmployee.length === 0 ? (
            <p className="text-sm text-brand-ink-soft">Aucune donnée.</p>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[420px]">
              <thead className="text-left text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft">
                <tr>
                  <th className="py-2">Employé·e</th>
                  <th className="py-2 text-right">Ventes</th>
                  <th className="py-2 text-right">Revenu</th>
                  <th className="py-2 text-right">Pourboires</th>
                </tr>
              </thead>
              <tbody>
                {byEmployee.map((r) => (
                  <tr key={r.employeeId} className="border-t border-brand-line">
                    <td className="py-2">{r.name}</td>
                    <td className="py-2 text-right">{r.sales}</td>
                    <td className="py-2 text-right">{formatDT(r.revenue)}</td>
                    <td className="py-2 text-right">{formatDT(r.tips)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-brand-line bg-white p-6">
          <h2 className="luxury-heading text-lg text-brand-ink mb-3">Stock faible</h2>
          {lowStock.length === 0 ? (
            <p className="text-sm text-brand-ink-soft">Aucun produit à réapprovisionner.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {lowStock.map((p) => (
                <li
                  key={p.id}
                  className="flex justify-between border-b border-brand-line pb-2 last:border-0"
                >
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-brand-ink-soft">SKU {p.sku}</p>
                  </div>
                  <div className="text-right">
                    <p
                      className={
                        p.stockQuantity <= 0
                          ? "text-red-600"
                          : "text-amber-700"
                      }
                    >
                      {p.stockQuantity} / seuil {p.lowStockThreshold}
                    </p>
                    <Link
                      href={`/pos/products/${p.id}/edit`}
                      className="text-[10px] text-brand-gold hover:underline"
                    >
                      Réapprovisionner →
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {loading && (
        <p className="mt-4 text-center text-xs text-brand-ink-soft">Chargement…</p>
      )}
    </div>
  );
}

function KpiTile({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta?: { pct: number; sign: "+" | "−" | "" };
}) {
  return (
    <div className="rounded-2xl border border-brand-line bg-white p-5">
      <p className="text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft">{label}</p>
      <p className="luxury-heading text-2xl text-brand-ink mt-1">{value}</p>
      {delta && delta.sign && (
        <p
          className={`mt-1 text-[10px] uppercase tracking-[0.18em] ${
            delta.sign === "+" ? "text-emerald-700" : "text-red-700"
          }`}
        >
          {delta.sign}
          {delta.pct}% vs période précédente
        </p>
      )}
    </div>
  );
}

function TopChart({ title, data }: { title: string; data: TopRow[] }) {
  return (
    <div className="rounded-2xl border border-brand-line bg-white p-6">
      <h2 className="luxury-heading text-lg text-brand-ink mb-3">{title}</h2>
      {data.length === 0 ? (
        <p className="text-sm text-brand-ink-soft py-8 text-center">Aucune donnée.</p>
      ) : (
        <div style={{ height: 220 }}>
          <ResponsiveContainer>
            <BarChart
              data={data.map((d) => ({ ...d, revenueNum: Number(d.revenue) }))}
              layout="vertical"
              margin={{ left: 20 }}
            >
              <XAxis type="number" stroke="#4A4244" tick={{ fontSize: 11 }} />
              <YAxis
                dataKey="name"
                type="category"
                stroke="#4A4244"
                tick={{ fontSize: 11 }}
                width={120}
              />
              <Tooltip
                formatter={(value, _name, props) => {
                  const n = typeof value === "number" ? value : Number(value);
                  const qty = (props.payload as { quantity?: number }).quantity ?? 0;
                  return [`${n.toFixed(3)} DT (qté ${qty})`, "Revenu"];
                }}
                contentStyle={{ fontSize: 12 }}
              />
              <Bar dataKey="revenueNum" fill="#D4A574" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function Heatmap({ cells }: { cells: HeatmapCell[] }) {
  const max = Math.max(1, ...cells.map((c) => c.count));
  const days = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

  return (
    <div className="overflow-x-auto">
      <table className="text-xs">
        <thead>
          <tr>
            <th className="px-1"></th>
            {Array.from({ length: 24 }).map((_, h) => (
              <th key={h} className="px-0.5 py-1 text-[9px] text-brand-ink-soft">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((day, dow) => (
            <tr key={dow}>
              <td className="px-1 text-[9px] uppercase tracking-[0.15em] text-brand-ink-soft">
                {day}
              </td>
              {Array.from({ length: 24 }).map((_, h) => {
                const cell = cells.find((c) => c.dow === dow && c.hour === h);
                const intensity = cell ? cell.count / max : 0;
                const opacity = intensity > 0 ? 0.15 + intensity * 0.85 : 0;
                return (
                  <td
                    key={h}
                    title={cell ? `${cell.count} ventes — ${cell.revenue} DT` : "0"}
                    style={{
                      background: opacity > 0 ? `rgba(212,165,116,${opacity})` : "transparent",
                    }}
                    className="h-6 w-6 border border-brand-line/30"
                  >
                    {cell && cell.count > 0 ? (
                      <span className="block text-center text-[8px]">{cell.count}</span>
                    ) : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
