"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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

const categoryLabels: Record<string, string> = {
  COIFFURE: "Coiffure",
  ESTHETIQUE: "Esthetique",
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
    if (!confirm("Etes-vous sure de vouloir annuler cette reservation ?")) return;
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
    return <div className="flex items-center justify-center h-64 text-brand-bordeaux/40 text-xs tracking-[0.2em] uppercase">Chargement...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="luxury-badge mb-3">Mon espace</p>
          <h1 className="luxury-heading text-3xl text-brand-bordeaux">Mes reservations</h1>
        </div>
        <Link
          href="/offres"
          className="px-6 py-3 text-xs tracking-[0.2em] uppercase bg-brand-bordeaux text-white hover:bg-brand-gold transition-colors duration-500"
        >
          Decouvrir les offres
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total", value: bookings.length },
          { label: "En attente", value: bookings.filter((b) => b.status === "PENDING").length },
          { label: "Confirmees", value: bookings.filter((b) => b.status === "CONFIRMED").length },
          { label: "Terminees", value: bookings.filter((b) => b.status === "COMPLETED").length },
        ].map((s) => (
          <div key={s.label} className="bg-white p-5 border border-brand-gold/20 text-center">
            <p className="luxury-heading text-2xl text-brand-bordeaux">{s.value}</p>
            <p className="text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/40 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {[
          { key: "ALL", label: "Toutes" },
          { key: "PENDING", label: "En attente" },
          { key: "CONFIRMED", label: "Confirmees" },
          { key: "COMPLETED", label: "Terminees" },
          { key: "CANCELLED", label: "Annulees" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 text-[10px] tracking-[0.15em] uppercase font-medium whitespace-nowrap transition-colors duration-500 ${
              filter === f.key
                ? "bg-brand-bordeaux text-white"
                : "border border-brand-gold/20 text-brand-bordeaux/60 hover:border-brand-gold"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Bookings list */}
      <div className="space-y-3">
        {filtered.map((booking) => {
          const statusStyles: Record<string, string> = {
            PENDING: "border-amber-300 text-amber-700",
            CONFIRMED: "border-blue-300 text-blue-700",
            COMPLETED: "border-emerald-300 text-emerald-700",
            CANCELLED: "border-red-300 text-red-700",
          };
          const statusLabels: Record<string, string> = {
            PENDING: "En attente",
            CONFIRMED: "Confirmee",
            COMPLETED: "Terminee",
            CANCELLED: "Annulee",
          };
          return (
            <div
              key={booking.id}
              className="bg-white border border-brand-gold/20 p-5 hover:border-brand-gold transition-colors duration-500"
            >
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {booking.items[0] && (
                      <span className="luxury-badge text-[10px]">
                        {categoryLabels[booking.items[0].offer.category] || booking.items[0].offer.category}
                      </span>
                    )}
                    <span className={`px-3 py-1 border text-[10px] tracking-[0.1em] uppercase font-medium ${statusStyles[booking.status] || "border-gray-300 text-gray-600"}`}>
                      {statusLabels[booking.status] || booking.status}
                    </span>
                  </div>
                  <h3 className="luxury-heading text-lg text-brand-bordeaux">
                    {booking.items.map((i) => i.offer.title).join(", ")}
                  </h3>
                  <p className="text-xs text-brand-bordeaux/40 mt-1">
                    {booking.items[0]?.offer.provider.salonName}
                    {booking.items[0]?.offer.provider.city && ` · ${booking.items[0].offer.provider.city}`}
                  </p>
                  {booking.items[0]?.slot && (
                    <p className="text-sm text-brand-bordeaux/50 mt-2">
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
                    <p className="text-xs text-brand-bordeaux/30 mt-1">Note : {booking.notes}</p>
                  )}
                </div>

                <div className="flex items-center gap-3 flex-wrap justify-end">
                  <span className="luxury-heading text-xl text-brand-gold">
                    {Number(booking.totalPrice).toFixed(0)} TND
                  </span>

                  {/* Payment status badge */}
                  {booking.paymentStatus === "PAID" && (
                    <span className="px-3 py-1 border border-emerald-300 text-[10px] tracking-[0.1em] uppercase font-medium text-emerald-700">
                      {booking.qrVerified ? "Verifie" : "Paye"}
                    </span>
                  )}

                  {/* Pay button for unpaid confirmed/pending bookings */}
                  {booking.paymentStatus === "UNPAID" && booking.status !== "CANCELLED" && (
                    <Link
                      href={`/cliente/paiement?bookingId=${booking.id}`}
                      className="px-4 py-2 text-xs tracking-[0.15em] uppercase bg-brand-gold text-white hover:bg-brand-bordeaux transition-colors duration-500"
                    >
                      Payer
                    </Link>
                  )}

                  {/* QR code button for paid bookings */}
                  {booking.paymentStatus === "PAID" && booking.qrCode && (
                    <Link
                      href={`/cliente/reservation?id=${booking.id}`}
                      className="px-4 py-2 text-xs tracking-[0.15em] uppercase border border-brand-bordeaux text-brand-bordeaux hover:bg-brand-bordeaux hover:text-white transition-colors duration-500"
                    >
                      QR Code
                    </Link>
                  )}

                  {/* Review button for completed bookings */}
                  {booking.status === "COMPLETED" && !booking.hasReview && (
                    <button
                      onClick={() => { setReviewBooking(booking); setReviewRating(5); setReviewComment(""); }}
                      className="px-4 py-2 text-xs tracking-[0.15em] uppercase border border-brand-gold text-brand-gold hover:bg-brand-gold hover:text-white transition-colors duration-500"
                    >
                      Laisser un avis
                    </button>
                  )}
                  {booking.status === "COMPLETED" && booking.hasReview && (
                    <span className="px-3 py-1 border border-brand-gold/30 text-[10px] tracking-[0.1em] uppercase font-medium text-brand-gold">
                      Avis donne
                    </span>
                  )}

                  {/* Cancel button */}
                  {booking.status === "PENDING" && booking.paymentStatus === "UNPAID" && (
                    <button
                      onClick={() => cancelBooking(booking.id)}
                      disabled={cancelling === booking.id}
                      className="px-4 py-2 text-xs tracking-[0.15em] uppercase border border-red-300 text-red-600 hover:bg-red-50 transition-colors duration-500 disabled:opacity-50"
                    >
                      {cancelling === booking.id ? "..." : "Annuler"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <p className="text-brand-bordeaux/40 text-sm mb-6">
            {filter === "ALL" ? "Aucune reservation pour le moment." : "Aucune reservation dans cette categorie."}
          </p>
          <Link
            href="/offres"
            className="inline-block px-8 py-3 text-xs tracking-[0.2em] uppercase bg-brand-bordeaux text-white hover:bg-brand-gold transition-colors duration-500"
          >
            Decouvrir les offres
          </Link>
        </div>
      )}

      {/* Review modal */}
      {reviewBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white border border-brand-gold/20 p-8 max-w-md w-full">
            <p className="luxury-badge mb-3">Votre avis</p>
            <h3 className="luxury-heading text-xl text-brand-bordeaux mb-1">
              {reviewBooking.items.map((i) => i.offer.title).join(", ")}
            </h3>
            <p className="text-xs text-brand-bordeaux/40 mb-6">
              {reviewBooking.items[0]?.offer.provider.salonName}
            </p>

            {/* Star selector */}
            <div className="flex gap-1 mb-6 justify-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setReviewRating(star)}
                  className={`text-3xl transition-colors ${star <= reviewRating ? "text-brand-gold" : "text-brand-gold/20"} hover:text-brand-gold`}
                >
                  ★
                </button>
              ))}
            </div>

            <textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              rows={3}
              placeholder="Partagez votre experience... (optionnel)"
              className="w-full px-4 py-3 border border-brand-gold/20 text-brand-bordeaux text-sm focus:outline-none focus:border-brand-gold transition-colors bg-transparent mb-6"
            />

            <div className="flex gap-3">
              <button
                onClick={submitReview}
                disabled={reviewLoading}
                className="flex-1 py-3 text-xs tracking-[0.2em] uppercase bg-brand-bordeaux text-white hover:bg-brand-gold transition-colors duration-500 disabled:opacity-50"
              >
                {reviewLoading ? "Envoi..." : "Envoyer"}
              </button>
              <button
                onClick={() => setReviewBooking(null)}
                className="px-6 py-3 text-xs tracking-[0.15em] uppercase border border-brand-gold/20 text-brand-bordeaux/60 hover:border-brand-gold transition-colors duration-500"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
