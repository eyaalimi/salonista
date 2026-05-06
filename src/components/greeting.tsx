"use client";

import { useSession } from "next-auth/react";

export function Greeting() {
  const { data: session, status } = useSession();
  const firstName =
    session?.user?.name?.trim().split(/\s+/)[0] || null;

  // Avoid flashing the wrong greeting during the initial session fetch.
  // Render the generic copy first; swap to the personalized one once known.
  const showPersonalized = status === "authenticated" && firstName;

  return (
    <section className="px-4 pt-4">
      <h1 className="text-2xl font-medium text-brand-ink">
        {showPersonalized ? (
          <>Ahla, {firstName} 👋</>
        ) : (
          <>Ahla ! Trouve ton salon 🌟</>
        )}
      </h1>
      <p className="mt-1 text-sm text-brand-ink-soft">
        Les meilleures offres beauté près de chez toi
      </p>
    </section>
  );
}
