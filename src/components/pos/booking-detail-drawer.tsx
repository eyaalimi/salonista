"use client";

import { useEffect, useState } from "react";
import { formatDT } from "@/lib/money";
import { bookingClientName } from "@/lib/booking-client-name";
import { formatPhoneDisplay } from "@/lib/phone";

type Booking = {
  id: string;
  status: string;
  walkIn: boolean;
  phantom: boolean;
  totalPrice: string;
  notes: string | null;
  createdAt: string;
  customer: { firstName: string | null; lastName: string | null; phone: string } | null;
  client: { name: string | null; email: string } | null;
  assignedEmployee: { displayName: string } | null;
  items: Array<{
    id: string;
    offer: {
      id: string;
      title: string;
      durationMinutes: number;
      discountPrice: string;
      taxRate: string;
    };
    slot: { startTime: string; endTime: string } | null;
  }>;
  sale: { id: string; receiptNumber: string; status: string } | null;
};

/** Les statuts en base sont en anglais ; l'ecran est lu par une caissiere. */
const STATUT_LISIBLE: Record<string, string> = {
  PENDING: "En attente",
  CONFIRMED: "Confirmé",
  COMPLETED: "Terminé",
  CANCELLED: "Annulé",
};

type Props = {
  bookingId: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onEncaisser: (booking: Booking) => void;
  canSell: boolean;
  canCancel: boolean;
  canEdit: boolean;
};

export function BookingDetailDrawer({
  bookingId,
  onClose,
  onChanged,
  onEncaisser,
  canSell,
  canCancel,
  canEdit,
}: Props) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/pos/bookings/${bookingId}`);
    if (res.ok) setBooking(await res.json());
    else setError("Réservation introuvable");
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  async function cancel() {
    if (!confirm("Annuler cette réservation ?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/pos/bookings/${bookingId}/cancel`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Erreur");
        return;
      }
      await onChanged();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function move() {
    const newStr = prompt("Nouvelle heure (YYYY-MM-DDTHH:mm):");
    if (!newStr) return;
    const newDate = new Date(newStr);
    if (Number.isNaN(newDate.getTime())) {
      setError("Date invalide");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/pos/bookings/${bookingId}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newStartTime: newDate.toISOString() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Erreur");
        return;
      }
      await load();
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    /**
     * z-[70] : au-dessus du panneau lateral de `/pos`, qui monte a z-[60] sur
     * mobile (voir `pos-shell-client.tsx`). A z-40, ce tiroir s'ouvrait
     * DERRIERE lui — invisible. Le meme piege est deja documente dans ce
     * fichier pour « Ajouter cliente ».
     *
     * Sur l'agenda, ou rien d'autre n'est empile, la valeur est sans effet.
     */
    <div className="fixed inset-0 z-[70] flex">
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="flex-1 bg-black/30"
      />
      <aside className="w-full max-w-md bg-creme p-6 shadow-xl overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-prune/70">Détails réservation</p>
          <button
            type="button"
            onClick={onClose}
            className="text-prune/70 hover:text-prune"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-prune/70">Chargement…</p>
        ) : !booking ? (
          <p className="text-sm text-rose-fonce">{error ?? "Introuvable"}</p>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="ds-display text-lg text-prune">
                {bookingClientName(booking.customer, booking.client, "Sans client")}
              </p>
              {/* Le numero est cliquable : depuis une tablette de comptoir,
                  c'est le geste le plus direct pour prevenir d'un retard. */}
              {booking.customer?.phone && (
                <a
                  href={`tel:${booking.customer.phone}`}
                  className="ds-focus text-sm text-rose-fonce underline-offset-4 hover:underline"
                >
                  {formatPhoneDisplay(booking.customer.phone)}
                </a>
              )}
              {booking.assignedEmployee && (
                <p className="text-sm text-prune/70">
                  par {booking.assignedEmployee.displayName}
                </p>
              )}
            </div>

            <ul className="space-y-2 text-sm">
              {booking.items.map((it) => (
                <li
                  key={it.id}
                  className="rounded border border-hairline bg-white p-3"
                >
                  <p className="font-medium">{it.offer.title}</p>
                  {it.slot && (
                    <p className="text-sm text-prune/70">
                      {new Date(it.slot.startTime).toLocaleString("fr-FR")} →{" "}
                      {new Date(it.slot.endTime).toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                </li>
              ))}
            </ul>

            {booking.notes && (
              <p className="text-sm italic text-prune/70">{booking.notes}</p>
            )}

            <div className="text-base">
              <p>
                <span className="text-prune/70">Total :</span>{" "}
                {formatDT(booking.totalPrice)}
              </p>
              <p className="text-sm text-prune/70">
                {/* « PENDING » ne veut rien dire pour une caissiere. */}
                {STATUT_LISIBLE[booking.status] ?? booking.status}
                {booking.walkIn && " · Sans rendez-vous"}
                {booking.phantom && " · Vente directe"}
              </p>
            </div>

            {booking.sale && (
              <a
                href={`/pos/sales/${booking.sale.id}`}
                className="text-sm text-rose-fonce hover:underline"
              >
                Vente associée: {booking.sale.receiptNumber}
              </a>
            )}

            {error && <p role="alert" className="text-sm text-rose-fonce">{error}</p>}

            {booking.status !== "CANCELLED" && booking.status !== "COMPLETED" && (
              <div className="flex flex-wrap gap-2 pt-3 border-t border-hairline">
                {canSell && !booking.sale && (
                  <button
                    type="button"
                    onClick={() => onEncaisser(booking)}
                    className="ds-press ds-focus min-h-[44px] rounded-[var(--radius-pill)] bg-rose px-4 text-sm text-prune hover:bg-rose/90"
                  >
                    Encaisser
                  </button>
                )}
                {canEdit && !booking.walkIn && !booking.phantom && (
                  <button
                    type="button"
                    onClick={move}
                    disabled={busy}
                    className="ds-press ds-focus min-h-[44px] rounded-[var(--radius-pill)] border border-hairline bg-white px-4 text-sm text-prune hover:border-rose disabled:opacity-50"
                  >
                    Déplacer
                  </button>
                )}
                {canCancel && (
                  <button
                    type="button"
                    onClick={cancel}
                    disabled={busy}
                    className="ds-press ds-focus min-h-[44px] rounded-[var(--radius-pill)] border border-rose/50 bg-white px-4 text-sm text-rose-fonce hover:bg-rose-soft disabled:opacity-50"
                  >
                    Annuler
                  </button>
                )}
              </div>
            )}

            <p className="text-[10px] text-prune/70 pt-3 border-t border-hairline">
              Créée le {new Date(booking.createdAt).toLocaleString("fr-FR")}
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
