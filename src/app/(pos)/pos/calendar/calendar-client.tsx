"use client";

import { useState } from "react";
import { PosCalendar } from "@/components/pos/pos-calendar";
import { BookingCreateDrawer } from "@/components/pos/booking-create-drawer";
import { BookingDetailDrawer } from "@/components/pos/booking-detail-drawer";
import { useOnlineStatus } from "@/components/pos/online-status";

export function PosCalendarClient({ defaultEmployeeId }: { defaultEmployeeId: string }) {
  const { online } = useOnlineStatus();
  const [draftStart, setDraftStart] = useState<Date | null>(null);
  const [openBookingId, setOpenBookingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <div className="h-full overflow-hidden bg-pos-bg p-4">
      <PosCalendar
        key={reloadKey}
        onCreateAt={(d) => setDraftStart(d)}
        onOpenBooking={(id) => setOpenBookingId(id)}
      />
      {draftStart && (
        <BookingCreateDrawer
          initialStart={draftStart}
          online={online}
          defaultEmployeeId={defaultEmployeeId}
          onClose={() => setDraftStart(null)}
          onCreated={() => {
            setDraftStart(null);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
      {openBookingId && (
        <BookingDetailDrawer
          bookingId={openBookingId}
          canSell={true}
          canCancel={true}
          canEdit={true}
          onClose={() => setOpenBookingId(null)}
          onChanged={async () => {
            setOpenBookingId(null);
            setReloadKey((k) => k + 1);
          }}
          onEncaisser={() => {
            // Phase 3 originally pre-filled the cart from this drawer. With
            // the Design 2 layout the cart is on the home (`/pos`) page; for
            // Convert-to-Sale flow, navigate the cashier back home and let
            // them open the booking from the side panel instead.
            window.location.href = "/pos";
          }}
        />
      )}
    </div>
  );
}
