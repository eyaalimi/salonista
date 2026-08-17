"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface BookingItem {
  offer: { id: string; title: string; category: string; provider: { salonName: string; city: string | null } };
  slot: { startTime: string };
}

interface Booking {
  id: string;
  status: string;
  paymentStatus: string;
  totalPrice: string;
  notes: string | null;
  qrCode: string | null;
  qrVerified: boolean;
  createdAt: string;
  hasReview: boolean;
  items: BookingItem[];
}

// Les CLES (COIFFURE, ESTHETIQUE…) sont des valeurs de base de donnees et ne
// doivent jamais etre accentuees. Seules les valeurs affichees le sont.
const categoryLabels: Record<string, string> = {
  COIFFURE: "Coiffure",
  ESTHETIQUE: "Esthétique",
  ONGLERIE: "Onglerie",
  MASSAGE: "Massage",
  PARFUMERIE: "Parfumerie",
  AUTRE: "Autre",
};

export default function ClienteReservations() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [reviewBooking, setReviewBooking] = useState<Booking | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);

  useEffect(() => {
    fetch("/api/client/bookings")
      .then((r) => r.json())
      .then((data) => {
        setBookings(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, []);

  async function submitReview() {
    if (!reviewBooking) return;
    setReviewLoading(true);
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingId: reviewBooking.id,
        rating: reviewRating,
        comment: reviewComment || null,
      }),
    });
    if (res.ok) {
      setBookings((prev) =>
        prev.map((b) => (b.id === reviewBooking.id ? { ...b, hasReview: true } : b))
      );
      setReviewBooking(null);
      setReviewRating(5);
      setReviewComment("");
    }
    setReviewLoading(false);
  }

  async function cancelBooking(id: string) {
    if (!confirm("Es-tu sûre de vouloir annuler cette réservation ?")) return;
    setCancelling(id);
    const res = await fetch(`/api/client/bookings/${id}`, { method: "DELETE" });
    if (res.ok) {
      setBookings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status: "CANCELLED" } : b))
      );
    }
    setCancelling(null);
  }

  const filtered = filter === "ALL" ? bookings : bookings.filter((b) => b.status === filter);

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-base text-prune-soft">Chargement…</div>;
  }

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-prune-soft">Mon espace</p>
          <h1 className="ds-display text-3xl text-prune">Mes réservations</h1>
        </div>
        <Link
          href="/offres"
          className="ds-press ds-focus inline-flex min-h-[48px] items-center rounded-[var(--radius-pill)] bg-rose px-6 text-base font-semibold text-prune hover:bg-[#F04A79]"
        >
          Découvrir les offres
        </Link>
      </div>

      {/* Stats cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Total", value: bookings.length },
          { label: "En attente", value: bookings.filter((b) => b.status === "PENDING").length },
          { label: "Confirmées", value: bookings.filter((b) => b.status === "CONFIRMED").length },
          { label: "Terminées", value: bookings.filter((b) => b.status === "COMPLETED").length },
        ].map((s) => (
          <div key={s.label} className="rounded-[var(--radius-card)] border-2 border-hairline bg-white p-5 text-center">
            <p className="ds-display text-2xl text-prune">{s.value}</p>
            <p className="mt-1 text-sm text-prune-soft">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {[
          { key: "ALL", label: "Toutes" },
          { key: "PENDING", label: "En attente" },
          { key: "CONFIRMED", label: "Confirmées" },
          { key: "COMPLETED", label: "Terminées" },
          { key: "CANCELLED", label: "Annulées" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`ds-press ds-focus min-h-[44px] shrink-0 whitespace-nowrap rounded-[var(--radius-pill)] px-4 text-sm font-semibold ${
              filter === f.key
                ? "bg-rose text-prune"
                : "border-2 border-hairline bg-white text-prune hover:border-rose"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Bookings list */}
      <div className="space-y-3">
        {filtered.map((booking) => {
          const statusTones: Record<string, "menthe" | "rose" | "prune"> = {
            PENDING: "prune",
            CONFIRMED: "menthe",
            COMPLETED: "menthe",
            CANCELLED: "rose",
          };
          const statusLabels: Record<string, string> = {
            PENDING: "En attente",
            CONFIRMED: "Confirmée",
            COMPLETED: "Terminée",
            CANCELLED: "Annulée",
          };
          return (
            <div
              key={booking.id}
              className="rounded-[var(--radius-card)] border-2 border-hairline bg-white p-5"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {booking.items[0] && (
                      <Badge tone="prune">
                        {categoryLabels[booking.items[0].offer.category] || booking.items[0].offer.category}
                      </Badge>
                    )}
                    <Badge tone={statusTones[booking.status] || "prune"}>
                      {statusLabels[booking.status] || booking.status}
                    </Badge>
                  </div>
                  <h3 className="ds-display text-lg text-prune">
                    {booking.items.map((i) => i.offer.title).join(", ")}
                  </h3>
                  <p className="mt-1 text-sm text-prune-soft">
                    {booking.items[0]?.offer.provider.salonName}
                    {booking.items[0]?.offer.provider.city && ` · ${booking.items[0].offer.provider.city}`}
                  </p>
                  {booking.items[0]?.slot && (
                    <p className="mt-2 text-base text-prune">
                      {new Date(booking.items[0].slot.startTime).toLocaleDateString("fr-TN", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                  {booking.notes && (
                    <p className="mt-1 text-sm text-prune-soft">Note : {booking.notes}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3">
                  <span className="ds-display text-xl text-prune">
                    {Number(booking.totalPrice).toFixed(0)} TND
                  </span>

                  {booking.paymentStatus === "PAID" && (
                    <Badge tone="menthe">{booking.qrVerified ? "Vérifié" : "Payé"}</Badge>
                  )}

                  {booking.paymentStatus === "UNPAID" && booking.status !== "CANCELLED" && (
                    <Link
                      href={`/cliente/paiement?bookingId=${booking.id}`}
                      className="ds-press ds-focus inline-flex min-h-[44px] items-center rounded-[var(--radius-pill)] bg-prune px-4 text-sm font-semibold text-white hover:bg-[#4E1832]"
                    >
                      Payer
                    </Link>
                  )}

                  {booking.paymentStatus === "PAID" && booking.qrCode && (
                    <Link
                      href={`/cliente/reservation?id=${booking.id}`}
                      className="ds-press ds-focus inline-flex min-h-[44px] items-center rounded-[var(--radius-pill)] border-2 border-hairline px-4 text-sm font-semibold text-prune hover:border-rose"
                    >
                      QR code
                    </Link>
                  )}

                  {booking.status === "COMPLETED" && !booking.hasReview && (
                    <button
                      onClick={() => { setReviewBooking(booking); setReviewRating(5); setReviewComment(""); }}
                      className="ds-press ds-focus inline-flex min-h-[44px] items-center rounded-[var(--radius-pill)] border-2 border-hairline px-4 text-sm font-semibold text-prune hover:border-rose"
                    >
                      Laisser un avis
                    </button>
                  )}
                  {booking.status === "COMPLETED" && booking.hasReview && (
                    <Badge tone="menthe">Avis donné</Badge>
                  )}

                  {/* Seule action destructrice : traitement a part, jamais rose ni prune */}
                  {booking.status === "PENDING" && booking.paymentStatus === "UNPAID" && (
                    <button
                      onClick={() => cancelBooking(booking.id)}
                      disabled={cancelling === booking.id}
                      className="ds-press ds-focus inline-flex min-h-[44px] items-center rounded-[var(--radius-pill)] border-2 border-hairline px-4 text-sm font-semibold text-prune-soft hover:border-rose hover:text-rose"
                    >
                      {cancelling === booking.id ? "…" : "Annuler"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="py-16 text-center">
          <p className="mb-6 text-base text-prune-soft">
            {filter === "ALL" ? "Aucune réservation pour le moment." : "Aucune réservation dans cette catégorie."}
          </p>
          <Link
            href="/offres"
            className="ds-press ds-focus inline-flex min-h-[48px] items-center rounded-[var(--radius-pill)] border-2 border-hairline px-8 text-base font-semibold text-prune hover:border-rose"
          >
            Découvrir les offres
          </Link>
        </div>
      )}

      {/* Review modal */}
      {reviewBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-prune/50 px-4">
          <div className="w-full max-w-md rounded-[var(--radius-card)] border-2 border-hairline bg-white p-8">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-prune-soft">Ton avis</p>
            <h3 className="ds-display mb-1 text-xl text-prune">
              {reviewBooking.items.map((i) => i.offer.title).join(", ")}
            </h3>
            <p className="mb-6 text-sm text-prune-soft">
              {reviewBooking.items[0]?.offer.provider.salonName}
            </p>

            {/* Star selector */}
            <div className="mb-6 flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setReviewRating(star)}
                  aria-label={`${star} étoile${star > 1 ? "s" : ""}`}
                  className={`ds-press ds-focus flex h-11 w-11 items-center justify-center rounded-[var(--radius-pill)] text-3xl ${
                    star <= reviewRating ? "text-rose" : "text-hairline"
                  } hover:text-rose`}
                >
                  ★
                </button>
              ))}
            </div>

            <textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              rows={3}
              placeholder="Partage ton expérience… (optionnel)"
              className="ds-focus mb-6 w-full rounded-[var(--radius-panel)] border-2 border-hairline bg-white px-4 py-3 text-base text-prune placeholder:text-prune-soft/50"
            />

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                <Button onClick={submitReview} disabled={reviewLoading} fullWidth>
                  {reviewLoading ? "Envoi…" : "Envoyer"}
                </Button>
              </div>
              <Button variant="ghost" onClick={() => setReviewBooking(null)}>
                Annuler
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
