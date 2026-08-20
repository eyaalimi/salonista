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
      <span className="block h-9 w-9 overflow-hidden rounded-full border-2 border-hairline">
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
    <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-hairline bg-rose-soft text-sm font-semibold text-prune">
      {initials}
    </span>
  );
}

export function HomeNav() {
  const { data: session, status } = useSession();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-creme border-b border-hairline">
      {/* `max-w-6xl px-4` : la meme enveloppe que les sections de la page.
          Avec max-w-7xl et md:px-12, le logo tombait plus a gauche que les
          cartes — le decalage se voyait a chaque defilement. */}
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 min-h-[56px] md:h-20">
        <Logo className="text-xl md:text-2xl" />

        {/* Desktop-only secondary links */}
        <div className="hidden md:flex items-center gap-8">
          <Link
            href="/offres"
            className="ds-focus text-base text-prune-soft hover:text-rose rounded-[var(--radius-pill)] px-2 py-1"
          >
            Offres
          </Link>
          <a
            href="#salons"
            className="ds-focus text-base text-prune-soft hover:text-rose rounded-[var(--radius-pill)] px-2 py-1"
          >
            Salons
          </a>
        </div>

        {/* Right-side: avatar (signed-in) or Connexion button */}
        <div className="flex items-center">
          {status === "loading" ? (
            <span className="block h-9 w-9 rounded-full bg-rose-soft animate-pulse" />
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
              className="ds-press ds-focus inline-flex items-center min-h-[44px] px-4 rounded-[var(--radius-pill)] border-2 border-hairline text-base font-semibold text-prune hover:border-rose"
            >
              Connexion
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
