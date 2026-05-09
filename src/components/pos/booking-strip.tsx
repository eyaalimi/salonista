"use client";

import { X } from "lucide-react";
import { usePosStore } from "@/lib/pos-store";

/**
 * Yellow strip at the top of the cart panel, visible only when the cashier
 * has attached a booking. Click X to detach (removes only the booking-prefilled
 * cart lines; user-added retail items stay).
 */
export function BookingStrip() {
  const attachedBookingId = usePosStore((s) => s.attachedBookingId);
  const detachBooking = usePosStore((s) => s.detachBooking);
  const customer = usePosStore((s) => s.customer);
  const cart = usePosStore((s) => s.cart);
  const prefilled = usePosStore((s) => s.bookingPrefilledLineUids);

  if (!attachedBookingId) return null;

  function handleDetach() {
    const hasUserAdded = cart.some((l) => !prefilled.includes(l.uid));
    if (hasUserAdded && !confirm("Détacher le RDV ? Les services pré-remplis seront retirés du panier.")) {
      return;
    }
    detachBooking();
  }

  return (
    <div
      className="flex items-center gap-2 px-3 h-9 text-xs"
      style={{
        backgroundColor: "var(--color-pos-highlight)",
        borderTop: "1px solid #F0E2A0",
        borderBottom: "1px solid #F0E2A0",
      }}
    >
      <span className="px-1.5 py-0.5 bg-pos-ink text-pos-bg rounded text-[10px] font-semibold">
        RDV
      </span>
      <span className="text-pos-ink truncate flex-1">
        {customer ? `${customer.firstName ?? ""} ${customer.lastName ?? ""}` : "Réservation"} ·
        services pré-remplis
      </span>
      <button
        type="button"
        onClick={handleDetach}
        className="text-pos-ink-3 hover:text-pos-ink"
        aria-label="Détacher le RDV"
      >
        <X size={14} />
      </button>
    </div>
  );
}
