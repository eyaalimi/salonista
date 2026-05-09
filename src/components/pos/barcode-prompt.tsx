"use client";

import { useEffect, useRef, useState } from "react";
import { ScanLine } from "lucide-react";
import { findCachedProductByBarcode } from "@/lib/pos-offline-db";
import { usePosStore } from "@/lib/pos-store";

/**
 * Always-visible black bar pinned to the bottom of the main panel.
 *
 * Captures any keypress when no other input is focused (USB scanners are
 * keyboard-emulating). On Enter, looks up the typed string in the cached
 * catalog and pushes it to the cart.
 */
export function BarcodePrompt({ defaultEmployeeId }: { defaultEmployeeId: string }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  const addResultToCart = usePosStore((s) => s.addResultToCart);

  // Keep input focused when no other input has focus. Re-focus on document
  // clicks so the cashier never has to manually click into the input.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // Don't steal focus from controls that need it themselves.
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "BUTTON" ||
        target.tagName === "SELECT" ||
        target.tagName === "OPTION" ||
        target.closest("select") !== null
      )
        return;
      inputRef.current?.focus();
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  function flashError() {
    setError(true);
    setTimeout(() => setError(false), 600);
  }

  async function onSubmit() {
    const code = value.trim();
    setValue("");
    if (!code) return;
    if (!/^\d{6,14}$/.test(code)) {
      flashError();
      return;
    }
    const product = await findCachedProductByBarcode(code);
    if (!product) {
      flashError();
      return;
    }
    addResultToCart(
      {
        kind: "PRODUCT",
        id: product.id,
        name: product.name,
        category: product.category,
        subtitle: product.description,
        code: product.barcode ?? product.sku,
        salePrice: product.salePrice,
        taxRate: product.taxRate,
        photo: product.photo,
        stock: {
          quantity: product.stockQuantity,
          threshold: product.lowStockThreshold,
          status:
            product.stockQuantity <= 0
              ? "out"
              : product.stockQuantity <= product.lowStockThreshold
                ? "low"
                : "ok",
        },
        score: 1000,
      },
      defaultEmployeeId,
    );
  }

  return (
    <div
      className={`bg-pos-ink text-pos-bg flex items-center px-3 h-10 border-t border-pos-border-strong gap-3 sticky bottom-0 ${
        error ? "animate-pulse !bg-pos-danger" : ""
      }`}
    >
      <ScanLine size={14} className="text-pos-yellow shrink-0" />
      <input
        ref={inputRef}
        autoComplete="off"
        aria-label="Champ de scan code-barres"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void onSubmit();
          }
        }}
        className="flex-1 bg-transparent pos-mono text-sm placeholder-pos-ink-4 focus:outline-none"
        placeholder="Scanner un code-barres…"
      />
      <span className="text-[10px] text-pos-ink-4 shrink-0">
        Auto-ajout au panier · <kbd>Entrée</kbd>
      </span>
    </div>
  );
}
