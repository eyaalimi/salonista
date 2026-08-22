"use client";

import { useState } from "react";
import { PosCalendar } from "@/components/pos/pos-calendar";
import { BookingCreateDrawer } from "@/components/pos/booking-create-drawer";
import { BookingDetailDrawer } from "@/components/pos/booking-detail-drawer";
import { useOnlineStatus } from "@/components/pos/online-status";

export function PosCalendarClient({
  defaultEmployeeId,
  peutEncaisser,
}: {
  defaultEmployeeId: string;
  peutEncaisser: boolean;
}) {
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
          canSell={peutEncaisser}
          canCancel={true}
          canEdit={true}
          onClose={() => setOpenBookingId(null)}
          onChanged={async () => {
            setOpenBookingId(null);
            setReloadKey((k) => k + 1);
          }}
          onEncaisser={(booking) => {
            // On emporte l'identifiant du rendez-vous : sans lui, la caissiere
            // arrivait sur un panier vide et devait retrouver elle-meme la
            // cliente dans la liste. Le panneau lateral de `/pos` lit ce
            // parametre et remplit le panier tout seul.
            window.location.href = `/pos?bookingId=${booking.id}`;
          }}
        />
      )}
    </div>
  );
}
