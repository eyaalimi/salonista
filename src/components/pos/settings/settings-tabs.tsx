"use client";

import { useState } from "react";
import { SalonForm, type SalonProfile } from "@/components/pos/settings/salon-form";
import { HoursForm } from "@/components/pos/settings/hours-form";
import type { OpeningHours } from "@/lib/opening-hours";

export function SettingsTabs({
  profile,
  openingHours,
}: {
  profile: SalonProfile;
  openingHours: OpeningHours | null;
}) {
  const [tab, setTab] = useState<"salon" | "horaires">("salon");

  const onglet = (id: "salon" | "horaires", label: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      aria-selected={tab === id}
      role="tab"
      className={`px-4 py-2 text-sm font-medium ${
        tab === id
          ? "border-b-2 border-pos-ink text-pos-ink"
          : "text-pos-ink-3 hover:text-pos-ink-2"
      }`}
    >
      {label}
    </button>
  );

  return (
    <>
      <div role="tablist" className="mt-4 flex border-b border-pos-border">
        {onglet("salon", "Salon")}
        {onglet("horaires", "Horaires")}
      </div>

      <div className="mt-6">
        {tab === "salon" ? (
          <SalonForm initial={profile} />
        ) : (
          <HoursForm initial={openingHours} />
        )}
      </div>
    </>
  );
}
