"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { NavAccount } from "@/components/nav-account";
import { Logo } from "@/components/logo";

export function HomeNav() {
  const { data: session } = useSession();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-brand-line">
      <div className="max-w-7xl mx-auto px-6 md:px-12 flex items-center justify-between h-16 md:h-20">
        <Logo className="text-xl md:text-2xl" />

        <div className="hidden md:flex items-center gap-8">
          <Link
            href="/offres"
            className="text-xs tracking-[0.18em] uppercase text-brand-ink-soft hover:text-brand-gold transition-colors duration-300"
          >
            Offres
          </Link>
          <a
            href="#salons"
            className="text-xs tracking-[0.18em] uppercase text-brand-ink-soft hover:text-brand-gold transition-colors duration-300"
          >
            Salons
          </a>
        </div>

        <div className="flex items-center gap-3">
          <NavAccount />
          {!session?.user && (
            <Link
              href="/register"
              className="hidden md:inline-block px-5 py-2.5 text-xs tracking-[0.18em] uppercase bg-brand-ink text-white hover:bg-brand-gold transition-colors duration-300 rounded-md"
            >
              S&apos;inscrire
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
