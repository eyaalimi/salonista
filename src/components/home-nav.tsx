"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Logo } from "@/components/logo";

function ProfileAvatar({
  name,
  image,
}: {
  name: string | null | undefined;
  image: string | null | undefined;
}) {
  const initials =
    (name?.trim().split(/\s+/)[0]?.[0] || "?").toUpperCase();

  if (image) {
    return (
      <span className="block h-9 w-9 overflow-hidden rounded-full border border-brand-gold">
        {/* Plain <img> — provider avatars are remote (Google) or stable. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={name || "Profil"}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />
      </span>
    );
  }

  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-gold bg-brand-sand text-sm font-semibold text-brand-ink">
      {initials}
    </span>
  );
}

export function HomeNav() {
  const { data: session, status } = useSession();

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

        {/* Right-side: avatar (signed-in) or Connexion button */}
        <div className="flex items-center">
          {status === "loading" ? (
            <span className="block h-9 w-9 rounded-full bg-brand-sand animate-pulse" />
          ) : session?.user ? (
            <Link
              href="/cliente"
              aria-label="Mon profil"
              className="flex items-center justify-center min-h-[44px] min-w-[44px]"
            >
              <ProfileAvatar
                name={session.user.name}
                image={session.user.image}
              />
            </Link>
          ) : (
            <Link
              href="/login"
              className="rounded-full border border-brand-line px-3 py-1.5 text-sm font-medium text-brand-ink hover:border-brand-gold transition-colors"
            >
              Connexion
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
