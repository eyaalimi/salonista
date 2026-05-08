"use client";

import { useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { usePosStore, type SearchResult } from "@/lib/pos-store";
import { useOnlineStatus } from "@/components/pos/online-status";
import { searchCachedCatalog } from "@/lib/pos-offline-db";
import { usePOSShortcut } from "@/lib/use-pos-shortcuts";
import { getShortcutLabel } from "@/lib/pos-shortcuts";

/**
 * The single search input pinned in the topbar. Debounces, cancels in-flight
 * requests, falls back to the cached catalog when offline.
 */
export function UniversalSearch() {
  const { online } = useOnlineStatus();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const query = usePosStore((s) => s.query);
  const setQuery = usePosStore((s) => s.setQuery);
  const setResults = usePosStore((s) => s.setResults);
  const setResultsLoading = usePosStore((s) => s.setResultsLoading);

  // ⌘K → focus input
  usePOSShortcut("search.focus", () => {
    inputRef.current?.focus();
    inputRef.current?.select();
  });

  // Esc inside input → clear
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      setQuery("");
      inputRef.current?.blur();
    }
  }

  // Debounced fetch
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runSearch();
    }, 150);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, online]);

  async function runSearch() {
    if (abortRef.current) abortRef.current.abort();
    setResultsLoading(true);

    try {
      let data: { query: string; results: SearchResult[] };
      if (online) {
        const ac = new AbortController();
        abortRef.current = ac;
        const res = await fetch(`/api/pos/search?q=${encodeURIComponent(query)}&limit=20`, {
          signal: ac.signal,
        });
        if (!res.ok) {
          setResults([]);
          return;
        }
        data = await res.json();
      } else {
        data = (await searchCachedCatalog(query, 20)) as { query: string; results: SearchResult[] };
      }
      setResults(data.results);
    } catch {
      // Aborted or network error — silently keep prior results
    } finally {
      setResultsLoading(false);
    }
  }

  return (
    <div className="flex-1 max-w-[520px] relative">
      <Search
        size={14}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-pos-ink-4 pointer-events-none"
      />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Rechercher service ou produit, scanner un code-barres…"
        className="w-full bg-[#1E1C1D] text-pos-bg placeholder-pos-ink-4/70 text-sm pl-9 pr-16 py-2 rounded-md border border-transparent focus:border-pos-yellow focus:outline-none"
      />
      <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] !bg-transparent !text-pos-ink-4 !border-pos-ink-4/40">
        {getShortcutLabel("search.focus")}
      </kbd>
    </div>
  );
}
