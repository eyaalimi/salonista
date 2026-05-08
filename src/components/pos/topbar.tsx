"use client";

import { useEffect, useState } from "react";
import { OnlineStatusBadge } from "@/components/pos/online-status-badge";
import { CashDrawerIndicator } from "@/components/pos/cash-drawer-indicator";
import { UniversalSearch } from "@/components/pos/universal-search";

type Provider = { salonName: string; city: string | null };
type Employee = { id: string; displayName: string; role: string; permissions: Record<string, boolean> };

export function PosTopbar({ provider, employee }: { provider: Provider | null; employee: Employee }) {
  const [now, setNow] = useState<string>("--:--");
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNow(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    };
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, []);

  const initials = (employee.displayName || "?")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="h-12 bg-pos-ink text-pos-bg flex items-center px-3 gap-4">
      <div className="flex items-center gap-2 shrink-0">
        <span
          className="text-[18px] leading-none italic"
          style={{ fontFamily: "Georgia, serif" }}
        >
          salonista
        </span>
        <span className="text-pos-yellow text-[18px] leading-none">.</span>
      </div>

      {provider && (
        <div className="hidden sm:flex items-center gap-3 pl-4 border-l border-pos-ink-2 shrink-0">
          <div className="text-xs">
            <div className="font-medium leading-tight">{provider.salonName}</div>
            {provider.city && (
              <div className="text-[10px] text-pos-ink-4 leading-tight">{provider.city}</div>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 flex justify-center">
        <UniversalSearch />
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <OnlineStatusBadge />
        <span className="pos-mono text-xs text-pos-ink-4 hidden md:inline">{now}</span>
        {employee.permissions["pos.cash_drawer"] && <CashDrawerIndicator canOpen={true} />}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-pos-ink text-xs font-semibold"
          style={{ backgroundColor: "var(--color-pos-yellow)" }}
          title={`${employee.displayName} (${employee.role})`}
        >
          {initials}
        </div>
      </div>
    </header>
  );
}
