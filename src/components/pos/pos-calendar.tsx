"use client";

// New dedicated calendar for the POS center panel.
//
// Why a new component instead of extending <MultiServiceCalendar>:
// the public booking calendar walks consecutive offer slots for a single
// cart, while the POS calendar shows ALL bookings of the day across all
// employees and lets the cashier click empty space to open a drawer.
// Their interaction models are different enough that one component would
// have to branch on `mode` for almost every render — hence two components.

import { useEffect, useMemo, useRef, useState, useCallback } from "react";

const HOURS_START = 8;
const HOURS_END = 22;
const ROW_MINUTES = 30;
const ROW_HEIGHT_PX = 32;

const DOW_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export type CalendarBooking = {
  id: string;
  startTime: string;
  endTime: string;
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
  walkIn: boolean;
  phantom: boolean;
  createdViaPos: boolean;
  customerName: string | null;
  serviceName: string;
  assignedEmployeeId: string | null;
  saleId: string | null;
};

type View = "day" | "week";

type Props = {
  initialDate?: Date;
  onCreateAt: (start: Date) => void;
  onOpenBooking: (id: string) => void;
};

function isoDay(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
}

function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // Monday = 1
  const dow = x.getDay() === 0 ? 6 : x.getDay() - 1;
  x.setDate(x.getDate() - dow);
  return x;
}

function blockClass(b: CalendarBooking): string {
  if (b.status === "CANCELLED")
    return "border border-gray-300 bg-gray-50 text-gray-400 line-through";
  if (b.phantom || b.walkIn)
    return "border border-dashed border-brand-gold-soft text-brand-ink";
  if (b.createdViaPos)
    return "bg-brand-ink-soft text-brand-cream border border-brand-ink-soft";
  return "bg-brand-gold text-brand-ink border border-brand-gold";
}

export function PosCalendar({ initialDate, onCreateAt, onOpenBooking }: Props) {
  const [view, setView] = useState<View>("day");
  const [cursor, setCursor] = useState<Date>(
    initialDate ? new Date(initialDate) : new Date(),
  );
  const [bookings, setBookings] = useState<CalendarBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const range = useMemo(() => {
    if (view === "day") {
      const start = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return { from: start, to: end };
    }
    const start = startOfWeek(cursor);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { from: start, to: end };
  }, [view, cursor]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      });
      const res = await fetch(`/api/pos/bookings?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) return;
      type Raw = {
        id: string;
        status: string;
        walkIn: boolean;
        phantom: boolean;
        createdViaPos: boolean;
        items: Array<{
          slot: { startTime: string; endTime: string } | null;
          offer: { title: string };
        }>;
        customer: { firstName: string | null; lastName: string | null } | null;
        assignedEmployeeId: string | null;
        sale: { id: string } | null;
        createdAt: string;
        totalPrice: string;
      };
      const raw = (await res.json()) as Raw[];
      const out: CalendarBooking[] = [];
      for (const b of raw) {
        const slot = b.items[0]?.slot;
        const start = slot?.startTime ?? b.createdAt;
        const end =
          slot?.endTime ??
          new Date(new Date(b.createdAt).getTime() + 30 * 60_000).toISOString();
        out.push({
          id: b.id,
          startTime: start,
          endTime: end,
          status: b.status as CalendarBooking["status"],
          walkIn: b.walkIn,
          phantom: b.phantom,
          createdViaPos: b.createdViaPos,
          customerName:
            [b.customer?.firstName, b.customer?.lastName].filter(Boolean).join(" ") || null,
          serviceName: b.items.map((it) => it.offer.title).join(" + ") || "Walk-in",
          assignedEmployeeId: b.assignedEmployeeId,
          saleId: b.sale?.id ?? null,
        });
      }
      setBookings(out);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh every 60s if visible.
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "visible") load();
    };
    const interval = setInterval(handler, 60_000);
    document.addEventListener("visibilitychange", handler);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handler);
    };
  }, [load]);

  // Keyboard navigation.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
      if (e.key === "ArrowLeft") {
        setCursor((c) => {
          const n = new Date(c);
          n.setDate(n.getDate() - (view === "day" ? 1 : 7));
          return n;
        });
      } else if (e.key === "ArrowRight") {
        setCursor((c) => {
          const n = new Date(c);
          n.setDate(n.getDate() + (view === "day" ? 1 : 7));
          return n;
        });
      } else if (e.key === "t" || e.key === "T") {
        setCursor(new Date());
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [view]);

  return (
    <div ref={containerRef} className="flex flex-col h-full">
      {/* Top bar */}
      <div className="border-b border-brand-line bg-white px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() =>
            setCursor((c) => {
              const n = new Date(c);
              n.setDate(n.getDate() - (view === "day" ? 1 : 7));
              return n;
            })
          }
          className="text-xs uppercase tracking-[0.18em] text-brand-ink-soft hover:text-brand-ink"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => setCursor(new Date())}
          className="text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft hover:text-brand-ink"
        >
          Aujourd&apos;hui
        </button>
        <button
          type="button"
          onClick={() =>
            setCursor((c) => {
              const n = new Date(c);
              n.setDate(n.getDate() + (view === "day" ? 1 : 7));
              return n;
            })
          }
          className="text-xs uppercase tracking-[0.18em] text-brand-ink-soft hover:text-brand-ink"
        >
          →
        </button>
        <span className="luxury-heading text-sm text-brand-ink ml-2">
          {view === "day"
            ? cursor.toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })
            : `Semaine du ${range.from.toLocaleDateString("fr-FR")}`}
        </span>
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={() => setView("day")}
            className={`rounded-lg px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${
              view === "day"
                ? "bg-brand-ink text-brand-cream"
                : "border border-brand-line bg-white text-brand-ink-soft"
            }`}
          >
            Jour
          </button>
          <button
            type="button"
            onClick={() => setView("week")}
            className={`rounded-lg px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${
              view === "week"
                ? "bg-brand-ink text-brand-cream"
                : "border border-brand-line bg-white text-brand-ink-soft"
            }`}
          >
            Semaine
          </button>
        </div>
        {loading && <span className="text-[10px] text-brand-ink-soft">…</span>}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        {view === "day" ? (
          <DayView
            date={cursor}
            bookings={bookings}
            onCreateAt={onCreateAt}
            onOpenBooking={onOpenBooking}
          />
        ) : (
          <WeekView
            weekStart={range.from}
            bookings={bookings}
            onCreateAt={onCreateAt}
            onOpenBooking={onOpenBooking}
          />
        )}
      </div>
    </div>
  );
}

function DayView({
  date,
  bookings,
  onCreateAt,
  onOpenBooking,
}: {
  date: Date;
  bookings: CalendarBooking[];
  onCreateAt: (d: Date) => void;
  onOpenBooking: (id: string) => void;
}) {
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), HOURS_START);
  const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), HOURS_END);
  const minutesPerView = (HOURS_END - HOURS_START) * 60;
  const heightPx = (minutesPerView / ROW_MINUTES) * ROW_HEIGHT_PX;

  const dayBookings = bookings.filter((b) => {
    const start = new Date(b.startTime);
    return (
      start.getFullYear() === date.getFullYear() &&
      start.getMonth() === date.getMonth() &&
      start.getDate() === date.getDate()
    );
  });

  const now = new Date();
  const isToday = isoDay(now) === isoDay(date);
  const nowOffsetMin =
    isToday && now.getHours() >= HOURS_START && now.getHours() < HOURS_END
      ? (now.getHours() - HOURS_START) * 60 + now.getMinutes()
      : -1;

  function rowClick(slotMinutes: number) {
    const d = new Date(dayStart);
    d.setMinutes(d.getMinutes() + slotMinutes);
    onCreateAt(d);
  }

  return (
    <div className="flex">
      {/* Time gutter */}
      <div className="w-16 shrink-0 border-r border-brand-line bg-brand-cream/50">
        {Array.from({ length: (HOURS_END - HOURS_START) * 2 }).map((_, i) => {
          const minutes = i * ROW_MINUTES;
          const showLabel = minutes % 60 === 0;
          const h = HOURS_START + Math.floor(minutes / 60);
          return (
            <div
              key={i}
              style={{ height: ROW_HEIGHT_PX }}
              className="border-b border-brand-line/30 px-2 text-right text-[10px] text-brand-ink-soft"
            >
              {showLabel ? `${String(h).padStart(2, "0")}:00` : ""}
            </div>
          );
        })}
      </div>
      {/* Tracks */}
      <div className="flex-1 relative" style={{ height: heightPx }}>
        {Array.from({ length: (HOURS_END - HOURS_START) * 2 }).map((_, i) => (
          <div
            key={i}
            onClick={() => rowClick(i * ROW_MINUTES)}
            style={{ height: ROW_HEIGHT_PX, top: i * ROW_HEIGHT_PX }}
            className="absolute inset-x-0 border-b border-brand-line/30 cursor-pointer hover:bg-brand-sand/50"
          />
        ))}
        {dayBookings.map((b) => {
          const start = new Date(b.startTime);
          const end = new Date(b.endTime);
          const startMin =
            (start.getHours() - HOURS_START) * 60 + start.getMinutes();
          if (startMin < 0) return null;
          const lengthMin = Math.max(15, (end.getTime() - start.getTime()) / 60_000);
          const top = (startMin / ROW_MINUTES) * ROW_HEIGHT_PX;
          const height = Math.max(28, (lengthMin / ROW_MINUTES) * ROW_HEIGHT_PX);
          return (
            <button
              key={b.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenBooking(b.id);
              }}
              style={{ top, height }}
              className={`absolute left-2 right-2 rounded-md px-2 py-1 text-left text-[11px] leading-tight overflow-hidden ${blockClass(b)}`}
            >
              <div className="font-medium truncate">{b.customerName ?? "Sans client"}</div>
              <div className="truncate opacity-80">{b.serviceName}</div>
              <div className="opacity-60">
                {start.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </button>
          );
        })}
        {nowOffsetMin >= 0 && (
          <div
            style={{ top: (nowOffsetMin / ROW_MINUTES) * ROW_HEIGHT_PX }}
            className="absolute inset-x-0 h-px bg-brand-gold pointer-events-none"
          >
            <span className="absolute -top-1.5 -left-1.5 h-3 w-3 rounded-full bg-brand-gold" />
          </div>
        )}
      </div>
    </div>
  );
}

function WeekView({
  weekStart,
  bookings,
  onCreateAt,
  onOpenBooking,
}: {
  weekStart: Date;
  bookings: CalendarBooking[];
  onCreateAt: (d: Date) => void;
  onOpenBooking: (id: string) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <div className="grid grid-cols-7 min-h-full">
      {days.map((d, idx) => {
        const dayBookings = bookings.filter((b) => {
          const start = new Date(b.startTime);
          return (
            start.getFullYear() === d.getFullYear() &&
            start.getMonth() === d.getMonth() &&
            start.getDate() === d.getDate()
          );
        });
        const isToday = isoDay(new Date()) === isoDay(d);
        return (
          <div key={idx} className="border-r border-brand-line last:border-r-0 min-h-[400px]">
            <div className={`px-2 py-2 border-b border-brand-line text-center ${isToday ? "bg-brand-gold/15" : "bg-brand-sand"}`}>
              <p className="text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft">
                {DOW_LABELS[idx]}
              </p>
              <p className="luxury-heading text-sm text-brand-ink">{d.getDate()}</p>
            </div>
            <button
              type="button"
              onClick={() => onCreateAt(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 10))}
              className="w-full text-left p-2 text-[10px] text-brand-ink-soft/60 hover:bg-brand-sand/50"
            >
              + Nouvelle réservation
            </button>
            <ul className="p-2 space-y-1">
              {dayBookings.map((b) => {
                const start = new Date(b.startTime);
                return (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => onOpenBooking(b.id)}
                      className={`w-full rounded-md px-2 py-1 text-left text-[10px] leading-tight ${blockClass(b)}`}
                    >
                      <div className="font-medium truncate">{b.customerName ?? "Sans client"}</div>
                      <div className="opacity-80 truncate">{b.serviceName}</div>
                      <div className="opacity-60">
                        {start.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
