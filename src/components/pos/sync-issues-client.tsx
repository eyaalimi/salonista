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
  phantom_booking_skipped: "Aucune réservation phantôme créée — vente absente du calendrier",
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
    <div className="md:p-6 p-4 max-w-4xl mx-auto">
      <div className="flex md:items-center items-start justify-between mb-4 md:mb-6 gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="luxury-badge mb-2">Caisse</p>
          <h1 className="luxury-heading md:text-3xl text-2xl text-brand-ink">Conflits de synchronisation</h1>
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
              <li key={s.id} className="rounded-2xl border border-pos-warn bg-pos-highlight p-4">
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
                <ul className="space-y-1 text-xs text-pos-warn">
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
