"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { NavAccount } from "@/components/nav-account";
import { Logo } from "@/components/logo";

export function HomeNav() {
  const { data: session } = useSession();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-brand-cream/95 backdrop-blur-md border-b border-brand-line"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12 flex items-center justify-between h-16 md:h-20">
        <Logo
          tone={scrolled ? "ink" : "light"}
          className="text-xl md:text-2xl"
        />

        <div className="hidden md:flex items-center gap-8">
          <Link
            href="/offres"
            className={`text-xs tracking-[0.18em] uppercase transition-colors duration-500 ${
              scrolled
                ? "text-brand-ink-soft hover:text-brand-gold"
                : "text-white/85 hover:text-white"
            }`}
          >
            Offres
          </Link>
          <a
            href="#salons"
            className={`text-xs tracking-[0.18em] uppercase transition-colors duration-500 ${
              scrolled
                ? "text-brand-ink-soft hover:text-brand-gold"
                : "text-white/85 hover:text-white"
            }`}
          >
            Salons
          </a>
        </div>

        <div className="flex items-center gap-3">
          <NavAccount />
          {!session?.user && (
            <Link
              href="/register"
              className={`hidden md:inline-block px-5 py-2.5 text-xs tracking-[0.18em] uppercase transition-all duration-500 ${
                scrolled
                  ? "bg-brand-ink text-white hover:bg-brand-gold"
                  : "bg-white text-brand-ink hover:bg-brand-gold hover:text-white"
              }`}
            >
              S&apos;inscrire
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
