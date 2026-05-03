"use client";

import { DAY_KEYS, DAY_LABELS_FR, type DayKey, type OpeningHours, type TimeRange, emptyOpeningHours } from "@/lib/opening-hours";

interface Props {
  value: OpeningHours;
  onChange: (next: OpeningHours) => void;
}

export function OpeningHoursEditor({ value, onChange }: Props) {
  const hours = value || emptyOpeningHours();

  function updateRange(day: DayKey, idx: number, patch: Partial<TimeRange>) {
    const next: OpeningHours = { ...hours, [day]: hours[day].map((r, i) => (i === idx ? { ...r, ...patch } : r)) };
    onChange(next);
  }

  function addRange(day: DayKey) {
    const last = hours[day][hours[day].length - 1];
    const defaultRange: TimeRange = last
      ? { start: last.end, end: addHours(last.end, 4) }
      : { start: "09:00", end: "18:00" };
    onChange({ ...hours, [day]: [...hours[day], defaultRange] });
  }

  function removeRange(day: DayKey, idx: number) {
    onChange({ ...hours, [day]: hours[day].filter((_, i) => i !== idx) });
  }

  function copyToAll(day: DayKey) {
    const ranges = hours[day];
    const next: OpeningHours = { ...hours };
    for (const k of DAY_KEYS) {
      next[k] = ranges.map((r) => ({ ...r }));
    }
    onChange(next);
  }

  return (
    <div className="space-y-2">
      {DAY_KEYS.map((day) => (
        <div key={day} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 border border-brand-gold/15 bg-white">
          <div className="w-28 shrink-0">
            <p className="text-xs tracking-[0.15em] uppercase text-brand-bordeaux font-medium">
              {DAY_LABELS_FR[day]}
            </p>
          </div>
          <div className="flex-1 flex flex-col gap-2">
            {hours[day].length === 0 ? (
              <p className="text-xs text-brand-bordeaux/40 italic">Fermé</p>
            ) : (
              hours[day].map((range, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="time"
                    value={range.start}
                    onChange={(e) => updateRange(day, idx, { start: e.target.value })}
                    className="px-3 py-1.5 border border-brand-gold/20 bg-white text-brand-bordeaux text-sm focus:outline-none focus:border-brand-gold"
                  />
                  <span className="text-brand-bordeaux/40 text-xs">à</span>
                  <input
                    type="time"
                    value={range.end}
                    onChange={(e) => updateRange(day, idx, { end: e.target.value })}
                    className="px-3 py-1.5 border border-brand-gold/20 bg-white text-brand-bordeaux text-sm focus:outline-none focus:border-brand-gold"
                  />
                  <button
                    type="button"
                    onClick={() => removeRange(day, idx)}
                    className="px-2 py-1 text-[10px] tracking-[0.1em] uppercase border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                  >
                    Retirer
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2 sm:flex-col">
            <button
              type="button"
              onClick={() => addRange(day)}
              className="px-3 py-1.5 text-[10px] tracking-[0.15em] uppercase border border-brand-gold/30 text-brand-bordeaux hover:border-brand-gold hover:text-brand-gold transition-colors whitespace-nowrap"
            >
              + Plage
            </button>
            {hours[day].length > 0 && (
              <button
                type="button"
                onClick={() => copyToAll(day)}
                className="px-3 py-1.5 text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/50 hover:text-brand-gold transition-colors whitespace-nowrap"
                title="Copier ces horaires sur tous les jours"
              >
                Tout copier
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function addHours(hhmm: string, add: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = Math.min(23 * 60 + 59, h * 60 + m + add * 60);
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}
