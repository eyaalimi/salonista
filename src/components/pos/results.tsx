"use client";

import { useEffect, useRef } from "react";
import { usePosStore, type SearchResult } from "@/lib/pos-store";
import { formatDT } from "@/lib/money";
import { usePOSShortcut } from "@/lib/use-pos-shortcuts";
import { BarcodePrompt } from "@/components/pos/barcode-prompt";

export function Results({ defaultEmployeeId }: { defaultEmployeeId: string }) {
  const results = usePosStore((s) => s.results);
  const filterTab = usePosStore((s) => s.filterTab);
  const setFilterTab = usePosStore((s) => s.setFilterTab);
  const sortBy = usePosStore((s) => s.sortBy);
  const cycleSortMode = usePosStore((s) => s.cycleSortMode);
  const selectedIndex = usePosStore((s) => s.selectedIndex);
  const setSelectedIndex = usePosStore((s) => s.setSelectedIndex);
  const moveSelection = usePosStore((s) => s.moveSelection);
  const addResultToCart = usePosStore((s) => s.addResultToCart);

  // Filter + sort the visible list.
  const visible = applyFilterAndSort(results, filterTab, sortBy);

  const rowsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Enter") return;
      const target = e.target as HTMLElement | null;
      const inSearch = target?.tagName === "INPUT" && target.getAttribute("type") !== "checkbox";
      // Arrows only fire when the search input or the results panel has focus.
      if (!inSearch && document.activeElement?.tagName !== "BODY") return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        moveSelection(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        moveSelection(-1);
      } else if (e.key === "Enter") {
        // Plain Enter adds the highlighted result. ⌘Enter / Ctrl-Enter is
        // the cart-charge shortcut — let it through.
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const r = visible[selectedIndex];
        if (r) {
          e.preventDefault();
          addResultToCart(r, defaultEmployeeId);
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [visible, selectedIndex, addResultToCart, moveSelection, defaultEmployeeId]);

  usePOSShortcut("results.sort", () => cycleSortMode());

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 h-11 border-b border-pos-border bg-pos-bg">
        <div className="flex gap-1 text-xs">
          {([
            ["ALL", "Tout"],
            ["SERVICE", "Services"],
            ["PRODUCT", "Produits"],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilterTab(k)}
              className={`px-3 py-1 rounded-md ${
                filterTab === k
                  ? "bg-pos-ink text-pos-bg"
                  : "text-pos-ink-2 hover:bg-pos-border/60"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={cycleSortMode}
          className="text-xs text-pos-ink-2 hover:text-pos-ink"
        >
          Tri: {SORT_LABELS[sortBy]} <kbd>⇧S</kbd>
        </button>
      </div>

      <div ref={rowsRef} className="flex-1 overflow-y-auto p-4">
        {visible.length === 0 ? (
          <p className="p-8 text-center text-sm text-pos-ink-3">
            Aucun résultat.
          </p>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {visible.map((r, idx) => {
              const selected = idx === selectedIndex;
              return (
                <button
                  key={`${r.kind}-${r.id}`}
                  type="button"
                  onClick={() => {
                    setSelectedIndex(idx);
                    addResultToCart(r, defaultEmployeeId);
                  }}
                  className={`group text-left rounded-xl border bg-white overflow-hidden transition shadow-sm hover:shadow-md ${
                    selected
                      ? "border-pos-accent ring-2 ring-pos-accent/30"
                      : "border-pos-border hover:border-pos-accent/50"
                  }`}
                >
                  <ResultMedia r={r} />
                  <div className="p-3 flex flex-col gap-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium text-pos-ink truncate flex-1">{r.name}</div>
                      <KindBadge kind={r.kind} />
                    </div>
                    <div className="flex items-center justify-between text-xs text-pos-ink-3">
                      <span className="truncate">
                        {r.kind === "SERVICE" && r.duration ? `${r.duration} min` : r.subtitle ?? ""}
                      </span>
                      {r.stock && <StockPill stock={r.stock} />}
                    </div>
                    <div className="pos-mono text-right text-pos-accent font-semibold mt-1">
                      {formatDT(r.salePrice)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <BarcodePrompt defaultEmployeeId={defaultEmployeeId} />
    </div>
  );
}

const PLACEHOLDER_COLORS = [
  "#D4A574", "#E8D2B5", "#A88565", "#8B6F47",
  "#6F8E78", "#A6B89A", "#9C7B8C", "#7B9CA6",
];
function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return PLACEHOLDER_COLORS[Math.abs(h) % PLACEHOLDER_COLORS.length];
}

function ResultMedia({ r }: { r: SearchResult }) {
  if (r.photo) {
    // /uploads/ paths must go through <UploadedImage> (Next image optimizer
    // doesn't see runtime files). We use a plain <img> here because the
    // results grid renders many small thumbnails and we want them unoptimized.
    return (
      <div className="aspect-square w-full bg-pos-bg overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={r.photo}
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
    );
  }
  const initial = r.name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      className="aspect-square w-full flex items-center justify-center text-3xl font-semibold text-white/95"
      style={{ backgroundColor: colorFor(r.id) }}
    >
      {initial}
    </div>
  );
}

function KindBadge({ kind }: { kind: "SERVICE" | "PRODUCT" }) {
  const label = kind === "SERVICE" ? "S" : "P";
  const cls =
    kind === "SERVICE"
      ? "bg-[#EAE5DC] text-[#6B5A2E]"
      : "bg-[#DCEAE3] text-[#1F6F4E]";
  return (
    <span
      className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-semibold pos-mono ${cls}`}
    >
      {label}
    </span>
  );
}

function StockPill({ stock }: { stock: NonNullable<SearchResult["stock"]> }) {
  const map = {
    ok: "bg-pos-accent-soft text-pos-accent",
    low: "bg-[#FEF3D9] text-[#A8731F]",
    out: "bg-pos-danger-soft text-pos-danger",
  } as const;
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold pos-mono ${map[stock.status]}`}>
      {stock.quantity}
    </span>
  );
}

const SORT_LABELS: Record<string, string> = {
  relevance: "Pertinence",
  price_asc: "Prix ↑",
  price_desc: "Prix ↓",
  name_asc: "Nom A→Z",
};

function applyFilterAndSort(
  results: SearchResult[],
  filter: "ALL" | "SERVICE" | "PRODUCT",
  sort: "relevance" | "price_asc" | "price_desc" | "name_asc",
): SearchResult[] {
  let out = filter === "ALL" ? results : results.filter((r) => r.kind === filter);
  if (sort === "price_asc") out = [...out].sort((a, b) => Number(a.salePrice) - Number(b.salePrice));
  else if (sort === "price_desc") out = [...out].sort((a, b) => Number(b.salePrice) - Number(a.salePrice));
  else if (sort === "name_asc") out = [...out].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  return out;
}
