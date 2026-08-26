"use client";

/**
 * Mini-calendrier mensuel, a cote de la liste des rendez-vous.
 *
 * Sans lui, atteindre une date lointaine demandait autant de clics sur « › »
 * qu'il y avait de jours a franchir — intenable quand une cliente appelle
 * pour le mois prochain, au telephone, en attendant une reponse.
 *
 * Une pastille marque les jours qui portent des rendez-vous : sans elle, le
 * proprietaire cliquerait a l'aveugle pour trouver une journee chargee.
 *
 * Toute la logique de grille vit dans `src/lib/mois-calendrier.ts` (pur,
 * 19 tests) — Vitest tourne sans jsdom ici, aucun test de composant n'est
 * possible.
 */

import { useCallback, useEffect, useState } from "react";
import {
  JOURS_ENTETE,
  cleJour,
  grilleDuMois,
  joursOccupes,
  libelleMois,
  memeJour,
  moisDecale,
  plageDeLaGrille,
} from "@/lib/mois-calendrier";

export function MiniCalendrier({
  jourActif,
  onChoisirJour,
  /** Change a chaque creation/annulation pour reprendre les pastilles. */
  rafraichir,
}: {
  jourActif: Date;
  onChoisirJour: (d: Date) => void;
  rafraichir?: number;
}) {
  /**
   * Le mois affiche suit `jourActif` — les fleches « ‹ › » de la liste
   * doivent deplacer la grille — mais reste librement navigable : feuilleter
   * les mois ne doit pas changer le jour consulte.
   *
   * `decalage` porte ce feuilletage, en nombre de mois par rapport au mois de
   * `jourActif`. Le derivant au rendu plutot que par un `useEffect` qui
   * appelle `setState`, on evite un rendu en cascade — et la grille ne peut
   * jamais se retrouver desynchronisee de la liste.
   */
  const [decalage, setDecalage] = useState(0);
  const { annee, mois } = moisDecale(
    jourActif.getFullYear(),
    jourActif.getMonth(),
    decalage,
  );
  const [occupes, setOccupes] = useState<Set<string>>(() => new Set());

  const chargerPastilles = useCallback(async () => {
    const { debut, fin } = plageDeLaGrille(annee, mois);
    const params = new URLSearchParams({
      from: debut.toISOString(),
      to: fin.toISOString(),
    });
    const res = await fetch(`/api/pos/bookings?${params.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) return;

    type Raw = {
      status: string;
      items: Array<{ slot: { startTime: string } | null }>;
      createdAt: string;
    };
    const raw = (await res.json()) as Raw[];
    // Un rendez-vous annule ne « remplit » pas une journee : le marquer
    // enverrait le proprietaire vers un jour en realite libre.
    const dates = raw
      .filter((b) => b.status !== "CANCELLED")
      .map((b) => b.items[0]?.slot?.startTime ?? b.createdAt);
    setOccupes(joursOccupes(dates));
  }, [annee, mois]);

  useEffect(() => {
    chargerPastilles();
  }, [chargerPastilles, rafraichir]);

  const cases = grilleDuMois(annee, mois);
  const aujourdhui = new Date();

  function decaler(pas: number) {
    setDecalage((d) => d + pas);
  }

  // Choisir un jour recale la grille sur le mois de ce jour : sans cela, le
  // decalage accumule s'ajouterait au nouveau mois et la grille sauterait.
  function choisir(d: Date) {
    setDecalage(0);
    onChoisirJour(d);
  }

  return (
    <div className="rounded-2xl border border-pos-border bg-pos-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => decaler(-1)}
          aria-label="Mois précédent"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-pos-border text-pos-ink-2 hover:bg-pos-highlight"
        >
          ‹
        </button>
        <span className="text-sm font-semibold capitalize text-pos-ink">
          {libelleMois(annee, mois)}
        </span>
        <button
          type="button"
          onClick={() => decaler(1)}
          aria-label="Mois suivant"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-pos-border text-pos-ink-2 hover:bg-pos-highlight"
        >
          ›
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1">
        {JOURS_ENTETE.map((j, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="text-center text-[11px] font-medium text-pos-ink-3"
          >
            {j}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cases.map((c) => {
          const actif = memeJour(c.date, jourActif);
          const ceJour = memeJour(c.date, aujourdhui);
          const charge = occupes.has(cleJour(c.date));
          return (
            <button
              key={c.date.toISOString()}
              type="button"
              onClick={() => choisir(c.date)}
              aria-current={actif ? "date" : undefined}
              aria-label={c.date.toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              className={`relative flex h-9 w-full items-center justify-center rounded-lg text-sm transition-colors ${
                actif
                  ? "bg-pos-accent font-semibold text-white"
                  : ceJour
                    ? "border border-pos-accent text-pos-ink"
                    : c.dansLeMois
                      ? "text-pos-ink hover:bg-pos-highlight"
                      : "text-pos-ink-3/50 hover:bg-pos-highlight"
              }`}
            >
              {c.date.getDate()}
              {charge && (
                <span
                  aria-hidden="true"
                  className={`absolute bottom-1 h-1 w-1 rounded-full ${
                    actif ? "bg-white" : "bg-pos-accent"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => choisir(new Date())}
        className="mt-2 w-full rounded-lg border border-pos-border py-2 text-xs text-pos-ink-2 hover:bg-pos-highlight"
      >
        Aujourd&apos;hui
      </button>
    </div>
  );
}
