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
    return <div className="h-6 w-24 bg-brand-gold/10 animate-pulse" />;
  }

  if (!session?.user) {
    return (
      <Link
        href="/login"
        className="text-xs tracking-[0.2em] uppercase text-brand-ink/60 hover:text-brand-gold transition-colors duration-500"
      >
        Connexion
      </Link>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-3 px-4 py-2 border border-brand-gold/20 hover:border-brand-gold transition-colors duration-500"
      >
        <span className="w-7 h-7 bg-brand-ink text-white flex items-center justify-center text-xs font-medium">
          {session.user.name?.[0]?.toUpperCase() || session.user.email?.[0]?.toUpperCase() || "?"}
        </span>
        <span className="text-xs tracking-[0.15em] uppercase text-brand-ink hidden sm:inline">
          {session.user.name?.split(" ")[0] || "Compte"}
        </span>
        <svg className={`w-3 h-3 text-brand-ink/60 transition-transform duration-300 ${menuOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {menuOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white border border-brand-gold/20 shadow-lg">
          <div className="px-4 py-3 border-b border-brand-gold/15">
            <p className="text-xs text-brand-ink/50 truncate">{session.user.email}</p>
          </div>
          <Link
            href={dashboardByRole[session.user.role]?.href || "/"}
            onClick={() => setMenuOpen(false)}
            className="block px-4 py-3 text-xs tracking-[0.15em] uppercase text-brand-ink hover:bg-brand-cream transition-colors"
          >
            {dashboardByRole[session.user.role]?.label || "Mon espace"}
          </Link>
          <button
            onClick={() => {
              setMenuOpen(false);
              signOut({ callbackUrl: "/" });
            }}
            className="w-full text-left px-4 py-3 text-xs tracking-[0.15em] uppercase text-brand-ink/70 hover:bg-brand-cream transition-colors border-t border-brand-gold/15"
          >
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}
