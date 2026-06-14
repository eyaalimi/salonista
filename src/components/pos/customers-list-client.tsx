"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, UserPlus } from "lucide-react";
import { formatDT } from "@/lib/money";
import { formatPhoneDisplay } from "@/lib/phone";

type Row = {
  id: string;
  phone: string | null;
  isWalkIn: boolean;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  totalVisits: number;
  totalSpent: string;
};

export function CustomersListClient({ canEdit: _canEdit }: { canEdit: boolean }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/pos/customers");
        if (!cancelled) {
          if (res.ok) {
            const data = (await res.json()) as { customers: Row[] };
            setRows(data.customers);
          } else {
            setError("Impossible de charger la liste des clients.");
          }
        }
      } catch {
        if (!cancelled) setError("Erreur réseau.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const name = `${r.firstName ?? ""} ${r.lastName ?? ""}`.toLowerCase();
      return (
        name.includes(q) ||
        (r.phone ?? "").toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, query]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-pos-ink-4"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher par nom, téléphone ou e-mail…"
            className="w-full pl-10 pr-3 py-2.5 bg-white border border-pos-border rounded-lg text-sm focus:border-pos-accent focus:outline-none"
          />
        </div>
        <button
          type="button"
          disabled
          title="Créez une cliente depuis la caisse (panel droit)"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-pos-accent text-white rounded-lg text-sm font-medium disabled:opacity-60"
        >
          <UserPlus size={16} />
          Nouvelle cliente
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-pos-ink-3">Chargement…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-pos-ink-3 text-center py-12">
          {rows.length === 0
            ? "Aucune cliente pour le moment."
            : "Aucun résultat pour cette recherche."}
        </p>
      ) : (
        <div className="bg-white border border-pos-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-pos-bg border-b border-pos-border">
              <tr className="text-left text-xs uppercase tracking-wider text-pos-ink-3">
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Téléphone</th>
                <th className="px-4 py-3 font-medium">E-mail</th>
                <th className="px-4 py-3 font-medium text-right">Visites</th>
                <th className="px-4 py-3 font-medium text-right">Total dépensé</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => {
                const name =
                  `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "—";
                return (
                  <tr
                    key={c.id}
                    className="border-b border-pos-border last:border-0 hover:bg-pos-highlight/50"
                  >
                    <td className="px-4 py-3 font-medium text-pos-ink">
                      {name}
                      {c.isWalkIn && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-pos-ink-3">
                          passager
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-pos-ink-2 pos-mono">
                      {c.phone ? formatPhoneDisplay(c.phone) : "—"}
                    </td>
                    <td className="px-4 py-3 text-pos-ink-2">
                      {c.email ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right pos-mono">
                      {c.totalVisits}
                    </td>
                    <td className="px-4 py-3 text-right pos-mono font-medium">
                      {formatDT(c.totalSpent)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
