"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";

const dashboardByRole: Record<string, { href: string; label: string }> = {
  CLIENT: { href: "/cliente", label: "Mon espace" },
  PROVIDER: { href: "/prestataire", label: "Mon espace" },
  INFLUENCER: { href: "/influenceuse", label: "Mon espace" },
  ADMIN: { href: "/admin", label: "Admin" },
};

export function NavAccount() {
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  if (status === "loading") {
    return <div className="h-9 w-24 rounded-[var(--radius-pill)] bg-rose-soft animate-pulse" />;
  }

  if (!session?.user) {
    return (
      <Link
        href="/login"
        className="ds-press ds-focus inline-flex items-center min-h-[44px] px-4 rounded-[var(--radius-pill)] border-2 border-hairline text-base font-semibold text-prune hover:border-rose"
      >
        Connexion
      </Link>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="ds-press ds-focus flex items-center gap-2 min-h-[44px] px-3 rounded-[var(--radius-pill)] border-2 border-hairline hover:border-rose"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose text-xs font-bold text-white">
          {session.user.name?.[0]?.toUpperCase() || session.user.email?.[0]?.toUpperCase() || "?"}
        </span>
        <span className="text-sm font-semibold text-prune hidden sm:inline">
          {session.user.name?.split(" ")[0] || "Compte"}
        </span>
        <svg className={`w-3 h-3 text-prune-soft transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {menuOpen && (
        <div className="absolute right-0 mt-2 w-60 overflow-hidden rounded-[var(--radius-panel)] border-2 border-hairline bg-white">
          <div className="px-4 py-3 border-b border-hairline">
            <p className="text-sm text-prune-soft truncate">{session.user.email}</p>
          </div>
          <Link
            href={dashboardByRole[session.user.role]?.href || "/"}
            onClick={() => setMenuOpen(false)}
            className="block px-4 py-3 text-base font-semibold text-prune hover:bg-creme"
          >
            {dashboardByRole[session.user.role]?.label || "Mon espace"}
          </Link>
          <button
            onClick={() => {
              setMenuOpen(false);
              signOut({ callbackUrl: "/" });
            }}
            className="w-full text-left px-4 py-3 text-base text-prune-soft hover:bg-creme border-t border-hairline"
          >
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}
