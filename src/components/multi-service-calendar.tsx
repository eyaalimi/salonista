"use client";

import { useMemo, useState } from "react";

export interface SimpleSlot {
  id: string;
  startTime: string;
  capacity: number;
  bookedCount: number;
}

interface OfferLite {
  id: string;
  title: string;
  durationMinutes: number;
  slots: SimpleSlot[];
}

interface Props {
  /** Selected offers in the order the client wants them performed. */
  selectedOffers: OfferLite[];
  /** Currently chosen start ISO string (sole pivot for the whole cart). */
  selectedStart: string | null;
  onSelect: (startISO: string | null) => void;
}

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function MultiServiceCalendar({ selectedOffers, selectedStart, onSelect }: Props) {
  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);
  const [viewMonth, setViewMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [pickedDate, setPickedDate] = useState<string | null>(null);

  // Compute candidate start times: for each slot of the FIRST offer,
  // verify the subsequent offers have a slot starting at the cumulative offset.
  const validStartTimes = useMemo(() => {
    if (selectedOffers.length === 0) return new Map<string, Date[]>();
    const first = selectedOffers[0];
    if (!first) return new Map();

    const result = new Map<string, Date[]>();

    // Index slots by (offerId, startTime millis)
    const slotIndex = new Map<string, Map<number, SimpleSlot>>();
    for (const o of selectedOffers) {
      const m = new Map<number, SimpleSlot>();
      for (const s of o.slots) {
        m.set(new Date(s.startTime).getTime(), s);
      }
      slotIndex.set(o.id, m);
    }

    for (const slot of first.slots) {
      const startMs = new Date(slot.startTime).getTime();
      if (startMs <= Date.now()) continue;
      if (slot.bookedCount >= slot.capacity) continue;

      // Verify each subsequent offer has a free slot at the cumulative offset
      let cursor = startMs;
      let ok = true;
      for (const o of selectedOffers) {
        const idx = slotIndex.get(o.id)!;
        const candidate = idx.get(cursor);
        if (!candidate || candidate.bookedCount >= candidate.capacity) {
          ok = false;
          break;
        }
        cursor += o.durationMinutes * 60_000;
      }
      if (!ok) continue;

      const startDate = new Date(startMs);
      const key = dateKey(startDate);
      if (!result.has(key)) result.set(key, []);
      result.get(key)!.push(startDate);
    }

    for (const list of result.values()) {
      list.sort((a, b) => a.getTime() - b.getTime());
    }
    return result;
  }, [selectedOffers]);

  // Build calendar grid
  const grid = useMemo(() => {
    const first = startOfMonth(viewMonth);
    const firstWeekday = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
    const cells: { date: Date | null; key: string }[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push({ date: null, key: `empty-start-${i}` });
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d);
      cells.push({ date, key: dateKey(date) });
    }
    while (cells.length % 7 !== 0) cells.push({ date: null, key: `empty-end-${cells.length}` });
    return cells;
  }, [viewMonth]);

  const dayTimes = pickedDate ? validStartTimes.get(pickedDate) ?? [] : [];
  const canGoPrev = startOfMonth(viewMonth).getTime() > startOfMonth(today).getTime();

  const totalDuration = selectedOffers.reduce((sum, o) => sum + o.durationMinutes, 0);

  return (
    <div className="space-y-6">
      {selectedOffers.length === 0 ? (
        <div className="bg-white border border-brand-gold/20 p-8 text-center">
          <p className="text-sm text-brand-bordeaux/40">
            Sélectionnez au moins un service ci-dessous pour voir les créneaux disponibles.
          </p>
        </div>
      ) : (
        <>
          {/* Calendar */}
          <div className="bg-white border border-brand-gold/20 p-5 md:p-6">
            <div className="flex items-center justify-between mb-5">
              <button
                type="button"
                onClick={() => canGoPrev && setViewMonth(addMonths(viewMonth, -1))}
                disabled={!canGoPrev}
                className="w-9 h-9 border border-brand-gold/20 flex items-center justify-center text-brand-bordeaux/60 hover:border-brand-gold hover:text-brand-gold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Mois précédent"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="text-center">
                <p className="luxury-heading text-lg text-brand-bordeaux">{MONTHS[viewMonth.getMonth()]}</p>
                <p className="text-[10px] tracking-[0.25em] uppercase text-brand-bordeaux/40 mt-0.5">{viewMonth.getFullYear()}</p>
              </div>
              <button
                type="button"
                onClick={() => setViewMonth(addMonths(viewMonth, 1))}
                className="w-9 h-9 border border-brand-gold/20 flex items-center justify-center text-brand-bordeaux/60 hover:border-brand-gold hover:text-brand-gold transition-colors"
                aria-label="Mois suivant"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
              {WEEKDAYS.map((w) => (
                <div key={w} className="text-center text-[10px] tracking-[0.2em] uppercase text-brand-bordeaux/40 py-2">
                  {w}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {grid.map(({ date, key }) => {
                if (!date) return <div key={key} className="aspect-square" />;
                const k = dateKey(date);
                const isPast = date.getTime() < today.getTime();
                const isToday = isSameDay(date, today);
                const isAvailable = validStartTimes.has(k);
                const isPicked = pickedDate === k;

                let classes = "";
                const base = "aspect-square flex flex-col items-center justify-center text-sm transition-all duration-300 relative";
                if (isPast) {
                  classes = "text-brand-bordeaux/20 cursor-not-allowed";
                } else if (isPicked) {
                  classes = "bg-brand-bordeaux text-white cursor-pointer shadow-sm";
                } else if (isAvailable) {
                  classes = "bg-brand-gold/10 text-brand-bordeaux border border-brand-gold/40 hover:bg-brand-gold/20 hover:border-brand-gold cursor-pointer font-medium";
                } else {
                  classes = "text-brand-bordeaux/25 cursor-not-allowed bg-brand-cream/40";
                }

                return (
                  <button
                    key={key}
                    type="button"
                    disabled={isPast || !isAvailable}
                    onClick={() => {
                      setPickedDate(k);
                      onSelect(null);
                    }}
                    className={`${base} ${classes}`}
                  >
                    <span>{date.getDate()}</span>
                    {isAvailable && !isPicked && (
                      <span className="absolute bottom-1 w-1 h-1 rounded-full bg-brand-gold" />
                    )}
                    {isToday && !isPicked && (
                      <span className="absolute top-1 right-1 text-[7px] tracking-wider uppercase text-brand-gold/80">•</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-center gap-5 mt-5 pt-4 border-t border-brand-gold/15 flex-wrap">
              <span className="flex items-center gap-2 text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/50">
                <span className="w-3 h-3 bg-brand-gold/10 border border-brand-gold/40" /> Disponible
              </span>
              <span className="flex items-center gap-2 text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/50">
                <span className="w-3 h-3 bg-brand-cream/40" /> Indisponible
              </span>
              <span className="flex items-center gap-2 text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/50">
                <span className="w-3 h-3 bg-brand-bordeaux" /> Sélectionné
              </span>
            </div>
          </div>

          {/* Time slots */}
          {pickedDate && (
            <div className="bg-white border border-brand-gold/20 p-5 md:p-6">
              <p className="text-[10px] tracking-[0.2em] uppercase text-brand-bordeaux/50 mb-1">Heure de début</p>
              <h3 className="luxury-heading text-lg text-brand-bordeaux mb-1">
                {new Date(pickedDate).toLocaleDateString("fr-TN", { weekday: "long", day: "numeric", month: "long" })}
              </h3>
              <p className="text-xs text-brand-bordeaux/50 mb-4">
                Durée totale : {formatDuration(totalDuration)}
              </p>
              {dayTimes.length === 0 ? (
                <p className="text-xs text-brand-bordeaux/40 italic">Aucun horaire compatible</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {dayTimes.map((t: Date) => {
                    const iso = t.toISOString();
                    const active = selectedStart === iso;
                    return (
                      <button
                        type="button"
                        key={iso}
                        onClick={() => onSelect(iso)}
                        className={`px-3 py-3 border text-xs transition-all duration-300 ${
                          active
                            ? "border-brand-gold bg-brand-bordeaux text-white"
                            : "border-brand-gold/30 text-brand-bordeaux hover:border-brand-gold hover:bg-brand-gold/5"
                        }`}
                      >
                        {t.toLocaleTimeString("fr-TN", { hour: "2-digit", minute: "2-digit" })}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {!pickedDate && validStartTimes.size > 0 && (
            <p className="text-xs text-brand-bordeaux/50 text-center italic">
              Sélectionnez une date en doré pour voir les heures disponibles
            </p>
          )}

          {validStartTimes.size === 0 && (
            <p className="text-xs text-amber-700 italic text-center py-3">
              Aucun créneau ne peut accueillir l&apos;ensemble des services sélectionnés. Essayez d&apos;en retirer ou de réorganiser l&apos;ordre.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h}h${String(m).padStart(2, "0")}`;
}
