"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MARKETPLACE_PUBLIQUE } from "@/lib/flags";

const items = [
  { href: "/", label: "Accueil", emoji: "🏠" },
  { href: "/offres", label: "Explorer", emoji: "🔍" },
  { href: "/cliente", label: "Mes RDV", emoji: "📅" },
  { href: "/cliente/profil", label: "Moi", emoji: "👤" },
];

// Hide on dashboard sub-trees (provider/influencer/admin own their layouts).
// /cliente is allowed to keep showing the bottom nav so the client can hop back to /offres easily.
// /pos and /salon-pin own the full viewport (POS PWA) — no client bottom nav.
const HIDDEN_PREFIXES = ["/prestataire", "/influenceuse", "/admin", "/pos", "/salon-pin"];

export function BottomNav() {
  const pathname = usePathname() || "/";

  // Ses quatre entrees (Accueil, Explorer, Mes RDV, Moi) menent toutes a la
  // place de marche. Fermee, la barre n'irait nulle part.
  if (!MARKETPLACE_PUBLIQUE) return null;

  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return null;
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex h-[60px] items-center justify-around border-t border-hairline bg-white md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navigation principale"
    >
      {items.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.label}
            href={item.href}
            className={`ds-press flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-1 ${
              active ? "text-rose-fonce" : "text-prune-soft"
            }`}
          >
            <span className="text-xl leading-none">{item.emoji}</span>
            <span className="text-[10px] font-medium leading-none">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
