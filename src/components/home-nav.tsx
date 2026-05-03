"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { NavAccount } from "@/components/nav-account";

export function HomeNav() {
  const { data: session } = useSession();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-brand-cream/80 backdrop-blur-md border-b border-brand-gold/20">
      <div className="max-w-7xl mx-auto px-6 md:px-12 flex items-center justify-between h-16 md:h-20">
        <Link href="/" className="luxury-heading text-xl md:text-2xl tracking-wide text-brand-bordeaux">
          Beauté<span className="text-brand-gold">.</span>tn
        </Link>
        <div className="hidden md:flex items-center gap-10">
          <a href="#categories" className="text-xs tracking-[0.2em] uppercase text-brand-bordeaux/60 hover:text-brand-gold transition-colors duration-500">
            Catégories
          </a>
          <a href="#offres" className="text-xs tracking-[0.2em] uppercase text-brand-bordeaux/60 hover:text-brand-gold transition-colors duration-500">
            Offres
          </a>
          <a href="#comment" className="text-xs tracking-[0.2em] uppercase text-brand-bordeaux/60 hover:text-brand-gold transition-colors duration-500">
            Comment ça marche
          </a>
          <a href="#salons" className="text-xs tracking-[0.2em] uppercase text-brand-bordeaux/60 hover:text-brand-gold transition-colors duration-500">
            Salons
          </a>
        </div>
        <div className="flex items-center gap-4">
          <NavAccount />
          {!session?.user && (
            <Link
              href="/register"
              className="hidden md:inline-block px-6 py-2.5 text-xs tracking-[0.2em] uppercase bg-brand-bordeaux text-white hover:bg-brand-gold transition-colors duration-500"
            >
              S&apos;inscrire
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
