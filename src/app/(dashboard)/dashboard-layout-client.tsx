"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import { Logo } from "@/components/logo";
import type { SubscriptionModule } from "@/generated/prisma/enums";

type NavItem = { label: string; href: string; module?: SubscriptionModule };

const navItems: Record<string, NavItem[]> = {
  PROVIDER: [
    { label: "Dashboard", href: "/prestataire" },
    { label: "Caisse", href: "/pos", module: "POS" },
    { label: "Fidélité", href: "/prestataire/fidelite", module: "REWARDS" },
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
    { label: "Fidélité", href: "/cliente/fidelite" },
    { label: "Mon profil", href: "/cliente/profil" },
  ],
  ADMIN: [
    { label: "Dashboard", href: "/admin" },
    { label: "Utilisateurs", href: "/admin/utilisateurs" },
    { label: "Offres", href: "/admin/offres" },
    { label: "Abonnements", href: "/admin/subscriptions" },
    { label: "Réservations", href: "/admin/reservations" },
    { label: "Commissions", href: "/admin/commissions" },
  ],
};

type Props = {
  children: React.ReactNode;
  activeModules: SubscriptionModule[];
};

export default function DashboardLayoutClient({ children, activeModules }: Props) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role || "CLIENT";
  const items = (navItems[role] || navItems.CLIENT).filter(
    (item) => !item.module || activeModules.includes(item.module),
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-creme">
      {/* Sidebar */}
      {/* `sticky` + `h-screen` : la barre tient dans la hauteur de l'ecran et
          c'est la NAV qui defile, pas la page. Sans cela, un prestataire avec
          ses 7 entrees repousse le pied (avatar + Deconnexion) hors de vue sur
          un ecran court. */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-hairline bg-white md:flex md:w-64">
        <div className="shrink-0 border-b border-hairline p-6">
          <Logo className="text-xl" />
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-6">
          {items.map((item) => {
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`ds-press ds-focus flex min-h-[44px] items-center rounded-[var(--radius-pill)] px-4 text-base font-semibold ${
                  active
                    ? "bg-rose text-prune"
                    : "text-prune-soft hover:bg-creme hover:text-prune"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="shrink-0 border-t border-hairline p-4">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-soft text-sm font-bold text-prune">
              {session?.user?.name?.[0]?.toUpperCase() || "?"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-prune">{session?.user?.name}</p>
              <p className="truncate text-xs text-prune-soft">{session?.user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="ds-press ds-focus inline-flex min-h-[44px] items-center rounded-[var(--radius-pill)] px-3 text-sm font-semibold text-prune-soft hover:text-rose"
          >
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-hairline bg-white p-4 md:hidden">
          <Logo className="text-lg" />
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
            aria-expanded={mobileOpen}
            className="ds-press ds-focus flex h-11 w-11 items-center justify-center rounded-[var(--radius-pill)] text-prune"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </header>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="border-b border-hairline bg-white md:hidden">
            <div className="space-y-1 p-4">
              {items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`ds-press ds-focus flex min-h-[44px] items-center rounded-[var(--radius-pill)] px-4 text-base font-semibold ${
                      active ? "bg-rose text-prune" : "text-prune-soft"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="ds-press ds-focus flex min-h-[44px] w-full items-center rounded-[var(--radius-pill)] px-4 text-left text-base font-semibold text-prune-soft"
              >
                Déconnexion
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 bg-creme p-6 md:p-10">{children}</main>
      </div>
    </div>
  );
}
