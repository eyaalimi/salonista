"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { NavAccount } from "@/components/nav-account";
import { Logo } from "@/components/logo";

export function HomeNav() {
  const { data: session } = useSession();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-brand-line">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 md:px-12 min-h-[56px] md:h-20">
        <Logo className="text-xl md:text-2xl" />

        {/* Desktop-only secondary links */}
        <div className="hidden md:flex items-center gap-8">
          <Link
            href="/offres"
            className="text-sm text-brand-ink-soft hover:text-brand-gold transition-colors"
          >
            Offres
          </Link>
          <a
            href="#salons"
            className="text-sm text-brand-ink-soft hover:text-brand-gold transition-colors"
          >
            Salons
          </a>
        </div>

        {/* Account / sign-in — always visible, big tap target */}
        <div className="flex items-center gap-2">
          <NavAccount />
          {!session?.user && (
            <Link
              href="/register"
              className="hidden md:inline-flex items-center justify-center rounded-md bg-brand-ink px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-gold transition-colors min-w-[44px] min-h-[44px]"
            >
              S&apos;inscrire
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
