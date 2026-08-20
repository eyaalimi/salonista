"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut, Users } from "lucide-react";
import { OnlineStatusBadge } from "@/components/pos/online-status-badge";
import { CashDrawerIndicator } from "@/components/pos/cash-drawer-indicator";
import { UniversalSearch } from "@/components/pos/universal-search";
import { NextBookingTicker } from "@/components/pos/next-booking-ticker";

type Provider = { salonName: string; city: string | null };
type Employee = { id: string; displayName: string; role: string; permissions: Record<string, boolean> };

export function PosTopbar({
  provider,
  employee,
  hasPos = true,
}: {
  provider: Provider | null;
  employee: Employee;
  /**
   * Sans le module caisse, deux widgets n'ont pas lieu d'etre : la recherche
   * universelle (qui interroge produits et historique de ventes, et repondrait
   * 403) et l'indicateur de tiroir. Le ticker de prochain RDV, lui, releve du
   * metier et reste affiche.
   */
  hasPos?: boolean;
}) {
  const [now, setNow] = useState<string>("--:--");
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  async function handleLogout() {
    setLoggingOut(true);
    await signOut({ redirect: false });
    // Vers la connexion du site, pas vers l'ecran PIN : celui-ci sert a
    // choisir un employe une fois le salon connecte, pas a se connecter. Y
    // envoyer une proprietaire deconnectee lui demandait un code PIN alors
    // qu'elle voulait simplement entrer avec son email.
    window.location.href = "/login";
  }

  /** Bascule vers un autre membre de l'equipe, sans quitter le salon. */
  function handleSwitchEmployee() {
    window.location.href = "/salon-pin";
  }

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
    <header className="h-12 bg-pos-ink text-pos-bg flex items-center md:px-3 px-2 md:gap-4 gap-2">
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
        {hasPos && <UniversalSearch />}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <NextBookingTicker />
        <OnlineStatusBadge />
        <span className="pos-mono text-xs text-pos-ink-4 hidden md:inline">{now}</span>
        {hasPos && employee.permissions["pos.cash_drawer"] && <CashDrawerIndicator canOpen={true} employeeName={employee.displayName} />}

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-pos-ink text-xs font-semibold hover:opacity-90"
            style={{ backgroundColor: "var(--color-pos-yellow)" }}
            title={`${employee.displayName} (${employee.role})`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            {initials}
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-10 z-50 w-56 rounded-lg border border-pos-border bg-white text-pos-ink shadow-xl overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-pos-border">
                <div className="text-sm font-semibold truncate">{employee.displayName}</div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-pos-ink-3 mt-0.5">
                  {employee.role}
                </div>
              </div>
              {/* Changer d'employe ne deconnecte pas le salon : c'est le
                  geste courant quand une collegue prend le comptoir. La
                  deconnexion, elle, ferme la session du salon entier. */}
              <button
                type="button"
                role="menuitem"
                onClick={handleSwitchEmployee}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm hover:bg-pos-highlight text-left"
              >
                <Users size={16} className="text-pos-ink-3" />
                Basculer vers un autre membre
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full flex items-center gap-2 border-t border-pos-border px-4 py-3 text-sm hover:bg-pos-highlight text-left disabled:opacity-50"
              >
                <LogOut size={16} className="text-pos-danger" />
                {loggingOut ? "Déconnexion…" : "Déconnexion"}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
