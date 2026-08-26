"use client";

import { useCallback, useState } from "react";
import { PosCalendar } from "@/components/pos/pos-calendar";
import { MiniCalendrier } from "@/components/pos/mini-calendrier";
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

  // Le jour consulte vit ICI, partage entre la liste et la grille mensuelle :
  // une seule source de verite, sinon les deux vues se contredisent.
  const [jour, setJour] = useState<Date>(() => new Date());
  const surJourChange = useCallback((d: Date) => setJour(d), []);

  return (
    <div className="h-full overflow-y-auto bg-pos-bg p-4">
      {/* La grille passe SOUS la liste en dessous de 1024 px : cote a cote,
          les deux colonnes deviendraient illisibles sur la tablette de
          comptoir. */}
      <div className="mx-auto flex max-w-6xl flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <PosCalendar
            key={reloadKey}
            // `key` remonte le composant a chaque creation ou annulation. Le
            // jour vivant ici, le proprietaire qui vient de creer un
            // rendez-vous le mois prochain n'est plus renvoye a aujourd'hui.
            jourImpose={jour}
            onJourChange={surJourChange}
            onCreateAt={(d) => setDraftStart(d)}
            onOpenBooking={(id) => setOpenBookingId(id)}
          />
        </div>
        <div className="w-full shrink-0 lg:w-[300px]">
          <MiniCalendrier
            jourActif={jour}
            onChoisirJour={setJour}
            rafraichir={reloadKey}
          />
        </div>
      </div>
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
