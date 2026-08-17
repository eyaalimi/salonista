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
      <div className="rounded-[var(--radius-card)] border-2 border-hairline bg-white p-5 md:p-6">
        {/* Month header */}
        <div className="mb-5 flex items-center justify-between">
          <button
            type="button"
            onClick={() => canGoPrev && setViewMonth(addMonths(viewMonth, -1))}
            disabled={!canGoPrev}
            className="ds-press ds-focus flex h-11 w-11 items-center justify-center rounded-[var(--radius-pill)] border-2 border-hairline text-prune hover:border-rose hover:text-rose"
            aria-label="Mois précédent"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="text-center">
            <p className="ds-display text-lg text-prune">
              {MONTHS[viewMonth.getMonth()]}
            </p>
            <p className="mt-0.5 text-sm text-prune-soft">
              {viewMonth.getFullYear()}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setViewMonth(addMonths(viewMonth, 1))}
            className="ds-press ds-focus flex h-11 w-11 items-center justify-center rounded-[var(--radius-pill)] border-2 border-hairline text-prune hover:border-rose hover:text-rose"
            aria-label="Mois suivant"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Weekdays */}
        <div className="mb-2 grid grid-cols-7 gap-1">
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              className="py-2 text-center text-xs font-semibold uppercase tracking-wide text-prune-soft"
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

            const base =
              "ds-press ds-focus relative flex aspect-square flex-col items-center justify-center rounded-[var(--radius-panel)] text-sm";
            let classes = "";

            if (isPast) {
              classes = "text-prune-soft/30 cursor-not-allowed";
            } else if (isSelected) {
              classes = "bg-rose text-white cursor-pointer font-semibold";
            } else if (isAvailable) {
              classes = "bg-menthe text-menthe-deep cursor-pointer font-semibold hover:bg-menthe-deep hover:text-white";
            } else {
              classes = "text-prune-soft/40 cursor-not-allowed bg-creme";
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
                {isToday && !isSelected && (
                  <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-rose" />
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-5 border-t border-hairline pt-4">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-prune-soft">
            <span className="h-3 w-3 rounded-full bg-menthe" /> Disponible
          </span>
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-prune-soft">
            <span className="h-3 w-3 rounded-full border border-hairline bg-creme" /> Indisponible
          </span>
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-prune-soft">
            <span className="h-3 w-3 rounded-full bg-rose" /> Sélectionné
          </span>
        </div>
      </div>

      {/* Time slots for selected date */}
      {selectedDate && (
        <div className="rounded-[var(--radius-card)] border-2 border-hairline bg-white p-5 md:p-6">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-prune-soft">Horaires</p>
          <h3 className="ds-display mb-4 text-lg text-prune">
            {new Date(selectedDate).toLocaleDateString("fr-TN", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </h3>
          {selectedSlots.length === 0 ? (
            <p className="py-3 text-sm text-prune-soft">Aucun horaire pour cette date</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
                    className={`ds-press ds-focus min-h-[44px] rounded-[var(--radius-panel)] border-2 px-3 py-2 text-sm ${
                      active
                        ? "border-rose bg-rose text-white"
                        : full
                        ? "cursor-not-allowed border-hairline bg-creme text-prune-soft"
                        : "border-hairline text-prune hover:border-rose"
                    }`}
                  >
                    <div className="font-semibold">
                      {start.toLocaleTimeString("fr-TN", { hour: "2-digit", minute: "2-digit" })}
                      {" — "}
                      {end.toLocaleTimeString("fr-TN", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <div className="mt-0.5 text-xs opacity-80">
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
        <p className="text-center text-sm text-prune-soft">
          Sélectionne une date en vert pour voir les horaires disponibles
        </p>
      )}

      {availableDates.size === 0 && (
        <p className="py-3 text-center text-sm text-prune-soft">
          Aucun créneau disponible pour cette offre
        </p>
      )}
    </div>
  );
}
