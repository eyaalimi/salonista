"use client";

import { useMemo, useState } from "react";

interface Slot {
  id: string;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount: number;
}

interface Props {
  slots: Slot[];
  selectedSlotId: string;
  onSelect: (slotId: string) => void;
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

export function BookingCalendar({ slots, selectedSlotId, onSelect }: Props) {
  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const [viewMonth, setViewMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Group slots by day, only future slots with remaining capacity
  const slotsByDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const slot of slots) {
      const start = new Date(slot.startTime);
      if (start.getTime() <= Date.now()) continue;
      const key = dateKey(start);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(slot);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    }
    return map;
  }, [slots]);

  const availableDates = useMemo(() => {
    const set = new Set<string>();
    for (const [key, list] of slotsByDay) {
      if (list.some((s) => s.bookedCount < s.capacity)) set.add(key);
    }
    return set;
  }, [slotsByDay]);

  // Build calendar grid (6 rows x 7 cols), Monday-first
  const grid = useMemo(() => {
    const first = startOfMonth(viewMonth);
    const firstWeekday = (first.getDay() + 6) % 7; // Monday = 0
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

  const selectedSlots = selectedDate ? slotsByDay.get(selectedDate) ?? [] : [];

  const canGoPrev = startOfMonth(viewMonth).getTime() > startOfMonth(today).getTime();

  return (
    <div className="space-y-6">
      {/* Calendar */}
      <div className="bg-white border border-brand-gold/20 p-5 md:p-6">
        {/* Month header */}
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
            <p className="luxury-heading text-lg text-brand-bordeaux">
              {MONTHS[viewMonth.getMonth()]}
            </p>
            <p className="text-[10px] tracking-[0.25em] uppercase text-brand-bordeaux/40 mt-0.5">
              {viewMonth.getFullYear()}
            </p>
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

        {/* Weekdays */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              className="text-center text-[10px] tracking-[0.2em] uppercase text-brand-bordeaux/40 py-2"
            >
              {w}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {grid.map(({ date, key }) => {
            if (!date) {
              return <div key={key} className="aspect-square" />;
            }
            const k = dateKey(date);
            const isPast = date.getTime() < today.getTime();
            const isToday = isSameDay(date, today);
            const isAvailable = availableDates.has(k);
            const isSelected = selectedDate === k;

            const base = "aspect-square flex flex-col items-center justify-center text-sm transition-all duration-300 relative";
            let classes = "";

            if (isPast) {
              classes = "text-brand-bordeaux/20 cursor-not-allowed";
            } else if (isSelected) {
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
                onClick={() => setSelectedDate(k)}
                className={`${base} ${classes}`}
              >
                <span>{date.getDate()}</span>
                {isAvailable && !isSelected && (
                  <span className="absolute bottom-1 w-1 h-1 rounded-full bg-brand-gold" />
                )}
                {isToday && !isSelected && (
                  <span className="absolute top-1 right-1 text-[7px] tracking-wider uppercase text-brand-gold/80">•</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
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

      {/* Time slots for selected date */}
      {selectedDate && (
        <div className="bg-white border border-brand-gold/20 p-5 md:p-6">
          <p className="text-[10px] tracking-[0.2em] uppercase text-brand-bordeaux/50 mb-1">Horaires</p>
          <h3 className="luxury-heading text-lg text-brand-bordeaux mb-4">
            {new Date(selectedDate).toLocaleDateString("fr-TN", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </h3>
          {selectedSlots.length === 0 ? (
            <p className="text-xs text-brand-bordeaux/40 italic py-3">Aucun horaire pour cette date</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {selectedSlots.map((s) => {
                const full = s.bookedCount >= s.capacity;
                const active = selectedSlotId === s.id;
                const start = new Date(s.startTime);
                const end = new Date(s.endTime);
                return (
                  <button
                    type="button"
                    key={s.id}
                    disabled={full}
                    onClick={() => onSelect(s.id)}
                    className={`px-3 py-3 border text-xs transition-all duration-300 ${
                      active
                        ? "border-brand-gold bg-brand-bordeaux text-white"
                        : full
                        ? "border-brand-gold/10 text-brand-bordeaux/30 bg-brand-cream/30 cursor-not-allowed"
                        : "border-brand-gold/30 text-brand-bordeaux hover:border-brand-gold hover:bg-brand-gold/5"
                    }`}
                  >
                    <div className="font-medium tracking-wider">
                      {start.toLocaleTimeString("fr-TN", { hour: "2-digit", minute: "2-digit" })}
                      {" — "}
                      {end.toLocaleTimeString("fr-TN", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <div className="text-[9px] tracking-[0.15em] uppercase mt-1 opacity-70">
                      {full ? "Complet" : `${s.capacity - s.bookedCount} place${s.capacity - s.bookedCount > 1 ? "s" : ""}`}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!selectedDate && availableDates.size > 0 && (
        <p className="text-xs text-brand-bordeaux/50 text-center italic">
          Sélectionnez une date en doré pour voir les horaires disponibles
        </p>
      )}

      {availableDates.size === 0 && (
        <p className="text-xs text-brand-bordeaux/40 italic text-center py-3">
          Aucun créneau disponible pour cette offre
        </p>
      )}
    </div>
  );
}
