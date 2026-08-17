"use client";

import { useRef, useState } from "react";
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
  const boutons = useRef<Record<string, HTMLButtonElement | null>>({});

  // Fleches gauche/droite avec bouclage, pattern APG a activation automatique.
  //
  // Le `.focus()` explicite est indispensable : changer l'etat React ne deplace
  // pas le focus du DOM. Sans lui, le bouton focalise passe a tabIndex={-1}
  // apres le rendu et la navigation se desynchronise des la deuxieme fleche.
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const i = TABS.findIndex((t) => t.id === tab);
    const next = e.key === "ArrowRight" ? (i + 1) % TABS.length : (i - 1 + TABS.length) % TABS.length;
    const cible = TABS[next].id;
    setTab(cible);
    boutons.current[cible]?.focus();
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
            ref={(el) => {
              boutons.current[t.id] = el;
            }}
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

      {/* Les DEUX panneaux sont montes en permanence, l'inactif masque par
          `hidden`. Sinon l'`aria-controls` de l'onglet inactif pointerait vers
          un id absent du DOM. Effet de bord bienvenu : les formulaires ne sont
          plus demontes a chaque bascule, donc une saisie en cours survit. */}
      <div
        role="tabpanel"
        id="panneau-salon"
        aria-labelledby="onglet-salon"
        hidden={tab !== "salon"}
        className="mt-6"
      >
        <SalonForm initial={profile} />
      </div>
      <div
        role="tabpanel"
        id="panneau-horaires"
        aria-labelledby="onglet-horaires"
        hidden={tab !== "horaires"}
        className="mt-6"
      >
        <HoursForm initial={openingHours} />
      </div>
    </>
  );
}
