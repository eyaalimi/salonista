"use client";

import { useEffect, useState } from "react";
import { Calendar } from "lucide-react";
import { bookingClientName } from "@/lib/booking-client-name";

type Booking = {
  id: string;
  startTime: string;
  status: string;
  saleId: string | null;
  customer: { firstName: string | null; lastName: string | null } | null;
  client: { name: string | null; email: string } | null;
  items: Array<{ name: string }>;
};

function customerName(b: Booking) {
  return bookingClientName(b.customer, b.client, "Client passager");
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function minutesUntil(iso: string): number {
  return Math.round((new Date(iso).getTime() - Date.now()) / 60000);
}

export function NextBookingTicker() {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/pos/bookings/today");
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { bookings: Booking[] };
        if (!cancelled) setBookings(data.bookings);
      } catch {
        // ignore
      }
    }
    void load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Force re-render every minute so the "dans X min" countdown updates.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  if (bookings === null) return null;

  // Filter to upcoming (un-encaissé) bookings: not paid yet, start >= now-15min.
  const now = Date.now();
  const upcoming = bookings.filter(
    (b) =>
      !b.saleId &&
      b.status !== "CANCELLED" &&
      new Date(b.startTime).getTime() >= now - 15 * 60_000,
  );

  if (upcoming.length === 0) {
    // Empty state is desktop-only — no need to burn scarce mobile topbar
    // real-estate on "Aucun RDV".
    return (
      <div className="hidden md:flex items-center gap-2 text-[11px] text-pos-ink-4">
        <Calendar size={12} />
        <span>Aucun RDV aujourd&apos;hui</span>
      </div>
    );
  }

  const next = upcoming[0];
  const mins = minutesUntil(next.startTime);
  const isNow = mins <= 0 && mins > -15;
  const isSoon = mins > 0 && mins <= 30;
  const countdown = isNow
    ? "maintenant"
    : mins < 60
      ? `dans ${mins} min`
      : `à ${formatTime(next.startTime)}`;

  const pillClass = `flex items-center gap-2 rounded-full text-[11px] font-medium ${
    isNow
      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 animate-pulse"
      : isSoon
        ? "bg-amber-500/15 text-amber-300 border border-amber-400/30"
        : "bg-white/5 text-pos-ink-4 border border-white/10"
  }`;
  const title = `${formatTime(next.startTime)} — ${customerName(next)} · ${next.items.map((i) => i.name).join(", ")}`;

  return (
    <>
      {/* Desktop: full ticker with name + countdown. */}
      <div
        className={`hidden md:flex px-2.5 py-1 ${pillClass}`}
        suppressHydrationWarning
        title={title}
      >
        <Calendar size={12} />
        <span className="pos-mono font-semibold">{formatTime(next.startTime)}</span>
        <span className="truncate max-w-[140px] capitalize">{customerName(next)}</span>
        <span className="opacity-70">· {countdown}</span>
        {upcoming.length > 1 && (
          <span className="ml-1 px-1.5 rounded-full bg-white/15 text-[10px]">
            +{upcoming.length - 1}
          </span>
        )}
        <span className="sr-only">{tick}</span>
      </div>

      {/* Mobile: compact pill (icon + time + short countdown + optional +N).
          Fits between the search box and the online-status dot. */}
      <div
        className={`md:hidden px-2 py-0.5 ${pillClass}`}
        suppressHydrationWarning
        title={title}
      >
        <Calendar size={12} />
        <span className="pos-mono font-semibold">{formatTime(next.startTime)}</span>
        <span className="opacity-80 whitespace-nowrap">
          {isNow ? "now" : mins < 60 ? `${mins}m` : `à ${formatTime(next.startTime)}`}
        </span>
        {upcoming.length > 1 && (
          <span className="px-1.5 rounded-full bg-white/15 text-[10px]">
            +{upcoming.length - 1}
          </span>
        )}
        <span className="sr-only">{tick}</span>
      </div>
    </>
  );
}
