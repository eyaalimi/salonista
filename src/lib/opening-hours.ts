// Types and helpers for provider opening hours and slot generation.
// openingHours JSON shape:
//   { mon: [{start:"09:00",end:"18:00"}], tue: [...], ..., sun: [] }
// Multiple ranges per day are supported (e.g. lunch break: [09-12, 14-18]).

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface TimeRange {
  start: string; // "HH:MM" 24h
  end: string;
}

export type OpeningHours = Record<DayKey, TimeRange[]>;

export const DAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export const DAY_LABELS_FR: Record<DayKey, string> = {
  mon: "Lundi",
  tue: "Mardi",
  wed: "Mercredi",
  thu: "Jeudi",
  fri: "Vendredi",
  sat: "Samedi",
  sun: "Dimanche",
};

export function emptyOpeningHours(): OpeningHours {
  return { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };
}

export function isValidOpeningHours(value: unknown): value is OpeningHours {
  if (!value || typeof value !== "object") return false;
  for (const day of DAY_KEYS) {
    const ranges = (value as Record<string, unknown>)[day];
    if (!Array.isArray(ranges)) return false;
    for (const r of ranges) {
      if (!r || typeof r !== "object") return false;
      const range = r as Record<string, unknown>;
      if (typeof range.start !== "string" || typeof range.end !== "string") return false;
      if (!/^\d{2}:\d{2}$/.test(range.start) || !/^\d{2}:\d{2}$/.test(range.end)) return false;
      if (toMinutes(range.start) >= toMinutes(range.end)) return false;
    }
  }
  return true;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function dayKeyFromDate(d: Date): DayKey {
  // JS getDay: 0=sun, 1=mon, ..., 6=sat
  return (["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as DayKey[])[d.getDay()];
}

/**
 * Generate slot start times for an offer over a date range.
 * Returns Date objects for each slot start, stepping every `durationMinutes`.
 *
 * @param hours       Provider opening hours
 * @param from        First day (inclusive) — local time
 * @param days        Number of days forward (e.g. 30)
 * @param durationMin Offer duration in minutes
 * @returns Array of {startTime, endTime} pairs
 */
export function generateSlots(
  hours: OpeningHours,
  from: Date,
  days: number,
  durationMin: number
): { startTime: Date; endTime: Date }[] {
  const slots: { startTime: Date; endTime: Date }[] = [];
  if (durationMin <= 0) return slots;

  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());

  for (let i = 0; i < days; i++) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = dayKeyFromDate(day);
    const ranges = hours[key] || [];

    for (const range of ranges) {
      const rangeStartMin = toMinutes(range.start);
      const rangeEndMin = toMinutes(range.end);

      let cursor = rangeStartMin;
      while (cursor + durationMin <= rangeEndMin) {
        const slotStart = new Date(day);
        slotStart.setHours(Math.floor(cursor / 60), cursor % 60, 0, 0);

        // Skip slots in the past
        if (slotStart.getTime() > Date.now()) {
          const slotEnd = new Date(slotStart.getTime() + durationMin * 60_000);
          slots.push({ startTime: slotStart, endTime: slotEnd });
        }

        cursor += durationMin;
      }
    }
  }

  return slots;
}

/**
 * For a list of consecutive offers (durations), find a suitable starting slot.
 * Returns true if `slot` (start time) has enough continuous capacity in the
 * generated grid for `totalDurationMin` minutes.
 */
export function isContinuousAvailable(
  slotStart: Date,
  totalDurationMin: number,
  hours: OpeningHours
): boolean {
  const key = dayKeyFromDate(slotStart);
  const ranges = hours[key] || [];
  const startMin = slotStart.getHours() * 60 + slotStart.getMinutes();
  const endMin = startMin + totalDurationMin;

  // Must fit entirely within one opening range (no spanning lunch breaks)
  return ranges.some((r) => toMinutes(r.start) <= startMin && endMin <= toMinutes(r.end));
}
