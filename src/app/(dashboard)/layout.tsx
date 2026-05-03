"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";

const navItems: Record<string, { label: string; href: string }[]> = {
  PROVIDER: [
    { label: "Dashboard", href: "/prestataire" },
    { label: "Mes offres", href: "/prestataire/offres" },
    { label: "Réservations", href: "/prestataire/reservations" },
    { label: "Collaborations", href: "/prestataire/collaborations" },
    { label: "Mon profil", href: "/prestataire/profil" },
  ],
  INFLUENCER: [
    { label: "Dashboard", href: "/influenceuse" },
    { label: "Collaborations", href: "/influenceuse/collaborations" },
    { label: "Mes gains", href: "/influenceuse/gains" },
    { label: "Mon profil", href: "/influenceuse/profil" },
  ],
  CLIENT: [
    { label: "Mes réservations", href: "/cliente" },
    { label: "Mon profil", href: "/cliente/profil" },
  ],
  ADMIN: [
    { label: "Dashboard", href: "/admin" },
    { label: "Utilisateurs", href: "/admin/utilisateurs" },
    { label: "Offres", href: "/admin/offres" },
    { label: "Réservations", href: "/admin/reservations" },
    { label: "Commissions", href: "/admin/commissions" },
  ],
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role || "CLIENT";
  const items = navItems[role] || navItems.CLIENT;
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-brand-cream">
      {/* Sidebar */}
      <aside className="hidden md:flex md:w-64 flex-col bg-white border-r border-brand-gold/15">
        <div className="p-6 border-b border-brand-gold/10">
          <Link href="/" className="luxury-heading text-xl tracking-wide text-brand-bordeaux">
            Beauté<span className="text-brand-gold">.</span>tn
          </Link>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1">
          {items.map((item) => {
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center px-4 py-3 text-xs tracking-[0.1em] uppercase transition-all duration-300 ${
                  active
                    ? "bg-brand-bordeaux text-white"
                    : "text-brand-bordeaux/60 hover:text-brand-bordeaux hover:bg-brand-peach/50"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-brand-gold/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-full bg-brand-bordeaux flex items-center justify-center text-white text-xs font-medium tracking-wider">
              {session?.user?.name?.[0]?.toUpperCase() || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-brand-bordeaux truncate">{session?.user?.name}</p>
              <p className="text-[10px] text-brand-bordeaux/40 truncate tracking-wider">{session?.user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/40 hover:text-brand-gold transition-colors duration-300"
          >
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="flex-1 flex flex-col">
        <header className="md:hidden flex items-center justify-between p-4 bg-white border-b border-brand-gold/15">
          <Link href="/" className="luxury-heading text-lg text-brand-bordeaux">
            Beauté<span className="text-brand-gold">.</span>tn
          </Link>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 text-brand-bordeaux"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </header>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden bg-white border-b border-brand-gold/15 luxury-fade-in">
            <div className="p-4 space-y-1">
              {items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`block px-4 py-2.5 text-xs tracking-[0.1em] uppercase ${
                      active ? "bg-brand-bordeaux text-white" : "text-brand-bordeaux/60"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="block w-full text-left px-4 py-2.5 text-xs tracking-[0.1em] uppercase text-brand-bordeaux/40"
              >
                Déconnexion
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 p-6 md:p-10 bg-brand-cream/50">{children}</main>
      </div>
    </div>
  );
}
