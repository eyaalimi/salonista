"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDT } from "@/lib/money";

type Sale = {
  id: string;
  receiptNumber: string;
  total: string;
  syncedAt: string | null;
  syncConflicts: unknown;
  createdAt: string;
};

const CONFLICT_LABELS: Record<string, string> = {
  customer_deleted: "Client supprimé du fichier",
  product_deleted: "Produit retiré du catalogue",
  offer_deleted: "Service retiré du catalogue",
  price_drift: "Prix divergent (snapshot offline vs catalogue actuel)",
  stock_negative: "Stock négatif après synchronisation",
};

export function SyncIssuesClient() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/pos/sales?status=PAID");
    if (res.ok) {
      const all = (await res.json()) as Sale[];
      setSales(
        all.filter((s) => s.syncConflicts && Array.isArray(s.syncConflicts) && (s.syncConflicts as unknown[]).length > 0),
      );
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="luxury-badge mb-2">Caisse</p>
          <h1 className="luxury-heading text-3xl text-brand-ink">Conflits de synchronisation</h1>
          <p className="text-sm text-brand-ink-soft mt-2">
            Ventes synchronisées avec des anomalies — à vérifier.
          </p>
        </div>
        <Link
          href="/pos"
          className="text-xs uppercase tracking-[0.18em] text-brand-ink-soft hover:text-brand-ink"
        >
          ← Caisse
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-brand-ink-soft">Chargement…</p>
      ) : sales.length === 0 ? (
        <div className="rounded-2xl border border-brand-line bg-white p-10 text-center">
          <p className="text-sm text-brand-ink-soft">Aucun conflit en attente.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {sales.map((s) => {
            const conflicts = Array.isArray(s.syncConflicts) ? (s.syncConflicts as Array<{ type: string }>) : [];
            return (
              <li key={s.id} className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
                <div className="flex justify-between mb-2">
                  <Link
                    href={`/pos/sales/${s.id}`}
                    className="font-mono text-sm text-brand-ink hover:underline"
                  >
                    {s.receiptNumber}
                  </Link>
                  <span className="text-sm">{formatDT(s.total)}</span>
                </div>
                <p className="text-xs text-brand-ink-soft mb-2">
                  {new Date(s.createdAt).toLocaleString("fr-FR")} —{" "}
                  {s.syncedAt ? `Synchronisé ${new Date(s.syncedAt).toLocaleString("fr-FR")}` : "Non synchronisé"}
                </p>
                <ul className="space-y-1 text-xs text-amber-900">
                  {conflicts.map((c, i) => (
                    <li key={i}>• {CONFLICT_LABELS[c.type] ?? c.type}</li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
