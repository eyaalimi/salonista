"use client";

import { useState } from "react";
import { SalonForm, type SalonProfile } from "@/components/pos/settings/salon-form";
import { HoursForm } from "@/components/pos/settings/hours-form";
import type { OpeningHours } from "@/lib/opening-hours";

type TabId = "salon" | "horaires";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "salon", label: "Salon" },
  { id: "horaires", label: "Horaires" },
];

export function SettingsTabs({
  profile,
  openingHours,
}: {
  profile: SalonProfile;
  openingHours: OpeningHours | null;
}) {
  const [tab, setTab] = useState<TabId>("salon");

  // Fleches gauche/droite avec bouclage, pattern APG a activation automatique :
  // le focus suit la selection, sans validation par Entree.
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const i = TABS.findIndex((t) => t.id === tab);
    const next = e.key === "ArrowRight" ? (i + 1) % TABS.length : (i - 1 + TABS.length) % TABS.length;
    setTab(TABS[next].id);
  }

  return (
    <>
      <div
        role="tablist"
        aria-label="Reglages du salon"
        onKeyDown={onKeyDown}
        className="mt-4 flex border-b border-pos-border"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`onglet-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panneau-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium ${
              tab === t.id
                ? "border-b-2 border-pos-ink text-pos-ink"
                : "text-pos-ink-3 hover:text-pos-ink-2"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`panneau-${tab}`}
        aria-labelledby={`onglet-${tab}`}
        className="mt-6"
      >
        {tab === "salon" ? (
          <SalonForm initial={profile} />
        ) : (
          <HoursForm initial={openingHours} />
        )}
      </div>
    </>
  );
}
