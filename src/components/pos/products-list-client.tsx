"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDT } from "@/lib/money";

type Product = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  salePrice: string;
  taxRate: string;
  stockQuantity: number;
  lowStockThreshold: number;
  active: boolean;
  photo: string | null;
  category: string | null;
};

export function ProductsListClient({ canManage }: { canManage: boolean }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/pos/products${showInactive ? "?all=1" : ""}`);
    if (res.ok) setProducts(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInactive]);

  async function deactivate(id: string) {
    if (!confirm("Désactiver ce produit ?")) return;
    await fetch(`/api/pos/products/${id}`, { method: "DELETE" });
    await load();
  }

  const filtered = products.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.barcode ?? "").includes(q)
    );
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="luxury-badge mb-2">Caisse</p>
          <h1 className="luxury-heading text-3xl text-brand-ink">Produits</h1>
        </div>
        <div className="flex gap-2">
          <Link
            href="/pos"
            className="rounded-lg border border-brand-line bg-white px-4 py-2 text-xs uppercase tracking-[0.18em] text-brand-ink-soft hover:border-brand-gold"
          >
            Retour caisse
          </Link>
          {canManage && (
            <Link
              href="/pos/products/new"
              className="rounded-lg bg-brand-ink px-4 py-2 text-xs uppercase tracking-[0.18em] text-brand-cream hover:bg-brand-ink-soft"
            >
              + Nouveau produit
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Nom, SKU ou code-barres…"
          className="flex-1 min-w-[200px] rounded border border-brand-line bg-white px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Inclure les produits désactivés
        </label>
      </div>

      {loading ? (
        <p className="text-sm text-brand-ink-soft">Chargement…</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-brand-line bg-white">
          <table className="w-full text-sm">
            <thead className="bg-brand-sand text-left text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft">
              <tr>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Code-barres</th>
                <th className="px-4 py-3 text-right">Prix</th>
                <th className="px-4 py-3 text-right">Stock</th>
                <th className="px-4 py-3">État</th>
                {canManage && <th className="px-4 py-3"></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const stockColor =
                  p.stockQuantity <= 0
                    ? "text-red-600"
                    : p.stockQuantity <= p.lowStockThreshold
                      ? "text-amber-700"
                      : "text-emerald-700";
                return (
                  <tr key={p.id} className="border-t border-brand-line">
                    <td className="px-4 py-3">
                      <p className="font-medium">{p.name}</p>
                      {p.category && (
                        <p className="text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft">
                          {p.category}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono">{p.sku}</td>
                    <td className="px-4 py-3 text-xs font-mono">{p.barcode ?? "—"}</td>
                    <td className="px-4 py-3 text-right">{formatDT(p.salePrice)}</td>
                    <td className={`px-4 py-3 text-right ${stockColor}`}>{p.stockQuantity}</td>
                    <td className="px-4 py-3 text-xs">
                      {p.active ? (
                        <span className="text-emerald-700">Actif</span>
                      ) : (
                        <span className="text-brand-ink-soft">Désactivé</span>
                      )}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/pos/products/${p.id}/edit`}
                          className="text-xs text-brand-gold hover:underline mr-3"
                        >
                          Modifier
                        </Link>
                        {p.active && (
                          <button
                            type="button"
                            onClick={() => deactivate(p.id)}
                            className="text-xs text-red-600 hover:underline"
                          >
                            Désactiver
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-brand-ink-soft">
                    Aucun produit.
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
