"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDT } from "@/lib/money";
import { ReceptionModal } from "./reception-modal";

type Product = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  salePrice: string;
  costPrice: string | null;
  taxRate: string;
  stockQuantity: number;
  lowStockThreshold: number;
  active: boolean;
  photo: string | null;
  category: string | null;
};

export function ProductsListClient({ canManage }: { canManage: boolean }) {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [receptionFor, setReceptionFor] = useState<{ id: string; name: string; costPrice: string | null } | null>(null);

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
    <div className="md:p-6 p-4 max-w-6xl mx-auto">
      <div className="flex md:items-center items-start justify-between mb-4 md:mb-6 gap-3 flex-wrap">
        <div>
          <p className="luxury-badge mb-2">Caisse</p>
          <h1 className="luxury-heading md:text-3xl text-2xl text-brand-ink">Produits</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link
            href="/pos"
            className="rounded-lg border border-brand-line bg-white px-3 py-2 md:px-4 text-xs uppercase tracking-[0.18em] text-brand-ink-soft hover:border-brand-gold"
          >
            Retour caisse
          </Link>
          {canManage && (
            <Link
              href="/pos/products/new"
              className="rounded-lg bg-brand-ink px-3 py-2 md:px-4 text-xs uppercase tracking-[0.18em] text-brand-cream hover:bg-brand-ink-soft"
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
        <>
        <div className="hidden md:block overflow-x-auto rounded-2xl border border-brand-line bg-white">
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
                    ? "text-pos-danger"
                    : p.stockQuantity <= p.lowStockThreshold
                      ? "text-pos-warn"
                      : "text-pos-accent";
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
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col items-end gap-1">
                        {formatDT(p.salePrice)}
                        {p.costPrice && Number(p.costPrice) > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded bg-pos-accent-soft text-pos-accent">
                            Marge {(Number(p.salePrice) - Number(p.costPrice)).toFixed(3)} TND
                            ({Number(p.salePrice) > 0 ? (((Number(p.salePrice) - Number(p.costPrice)) / Number(p.salePrice)) * 100).toFixed(0) : "0"}%)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={`px-4 py-3 text-right ${stockColor}`}>{p.stockQuantity}</td>
                    <td className="px-4 py-3 text-xs">
                      {p.active ? (
                        <span className="text-pos-accent">Actif</span>
                      ) : (
                        <span className="text-brand-ink-soft">Désactivé</span>
                      )}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => setReceptionFor({ id: p.id, name: p.name, costPrice: p.costPrice })}
                            className="text-xs px-2 py-0.5 rounded border border-brand-line hover:bg-brand-cream"
                          >
                            Réception
                          </button>
                          <Link
                            href={`/pos/products/${p.id}/edit`}
                            className="text-xs text-brand-gold hover:underline"
                          >
                            Modifier
                          </Link>
                          {p.active && (
                            <button
                              type="button"
                              onClick={() => deactivate(p.id)}
                              className="text-xs text-pos-danger hover:underline"
                            >
                              Désactiver
                            </button>
                          )}
                        </div>
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

        <div className="md:hidden flex flex-col gap-2">
          {filtered.map((p) => {
            const stockColor =
              p.stockQuantity <= 0
                ? "text-pos-danger"
                : p.stockQuantity <= p.lowStockThreshold
                  ? "text-pos-warn"
                  : "text-pos-accent";
            return (
              <div
                key={p.id}
                className="rounded-lg border border-brand-line bg-white p-3"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-brand-ink truncate">{p.name}</p>
                    {p.category && (
                      <p className="text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft mt-0.5">
                        {p.category}
                      </p>
                    )}
                    <p className="text-xs font-mono text-brand-ink-soft mt-1">
                      SKU {p.sku}
                      {p.barcode ? ` · ${p.barcode}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold text-brand-ink whitespace-nowrap">
                      {formatDT(p.salePrice)}
                    </p>
                    <p className={`text-xs mt-0.5 ${stockColor}`}>
                      Stock {p.stockQuantity}
                    </p>
                  </div>
                </div>
                {p.costPrice && Number(p.costPrice) > 0 && (
                  <p className="text-[11px] px-2 py-0.5 rounded bg-pos-accent-soft text-pos-accent inline-block mb-2">
                    Marge {(Number(p.salePrice) - Number(p.costPrice)).toFixed(3)} TND
                    ({Number(p.salePrice) > 0 ? (((Number(p.salePrice) - Number(p.costPrice)) / Number(p.salePrice)) * 100).toFixed(0) : "0"}%)
                  </p>
                )}
                {canManage && (
                  <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-brand-line">
                    <button
                      type="button"
                      onClick={() => setReceptionFor({ id: p.id, name: p.name, costPrice: p.costPrice })}
                      className="text-xs px-2 py-1 rounded border border-brand-line hover:bg-brand-cream"
                    >
                      Réception
                    </button>
                    <Link
                      href={`/pos/products/${p.id}/edit`}
                      className="text-xs text-brand-gold hover:underline"
                    >
                      Modifier
                    </Link>
                    {p.active ? (
                      <button
                        type="button"
                        onClick={() => deactivate(p.id)}
                        className="text-xs text-pos-danger hover:underline ml-auto"
                      >
                        Désactiver
                      </button>
                    ) : (
                      <span className="text-xs text-brand-ink-soft ml-auto">Désactivé</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-sm text-brand-ink-soft text-center py-12">
              Aucun produit.
            </p>
          )}
        </div>
        </>
      )}

      {receptionFor && (
        <ReceptionModal
          productId={receptionFor.id}
          productName={receptionFor.name}
          currentCost={receptionFor.costPrice}
          onClose={() => setReceptionFor(null)}
          onDone={() => {
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
