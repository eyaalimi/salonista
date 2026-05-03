"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { BookingCalendar } from "@/components/booking-calendar";

interface Slot {
  id: string;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount: number;
}

interface OfferData {
  id: string;
  title: string;
  description: string | null;
  originalPrice: number;
  discountPrice: number;
  category: string;
  photos: string[];
  provider: {
    id: string;
    salonName: string;
    city: string | null;
    category: string;
    description: string | null;
  };
  slots: Slot[];
}

interface ReviewData {
  id: string;
  rating: number;
  comment: string | null;
  clientName: string;
  createdAt: string;
}

function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "lg" }) {
  const sizeClass = size === "lg" ? "text-lg" : "text-sm";
  return (
    <span className={`${sizeClass} tracking-wider`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= rating ? "text-brand-gold" : "text-brand-gold/20"}>
          ★
        </span>
      ))}
    </span>
  );
}

export function OfferClient({
  offer,
  trackingToken,
  reviews = [],
  avgRating = 0,
}: {
  offer: OfferData;
  trackingToken: string | null;
  reviews?: ReviewData[];
  avgRating?: number;
}) {
  const { data: session } = useSession();
  const [showBooking, setShowBooking] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [bookingNotes, setBookingNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [bookingId, setBookingId] = useState("");
  const [error, setError] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState(0);

  const discount = Math.round(
    ((offer.originalPrice - offer.discountPrice) / offer.originalPrice) * 100
  );

  useEffect(() => {
    if (trackingToken) {
      localStorage.setItem("tracking_ref", trackingToken);
    }
  }, [trackingToken]);

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    if (!session) {
      window.location.href = `/login?callbackUrl=/offre/${offer.id}${trackingToken ? `?ref=${trackingToken}` : ""}`;
      return;
    }
    if (!selectedSlot) {
      setError("Veuillez choisir un créneau");
      return;
    }

    const slotObj = offer.slots.find((s) => s.id === selectedSlot);
    if (!slotObj) {
      setError("Créneau introuvable");
      return;
    }

    setLoading(true);
    setError("");

    const token = trackingToken || localStorage.getItem("tracking_ref");

    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        offerIds: [offer.id],
        startTime: slotObj.startTime,
        notes: bookingNotes || null,
        trackingToken: token,
      }),
    });

    setLoading(false);

    if (res.ok) {
      const data = await res.json();
      setBookingId(data.id);
      setSuccess(true);
    } else {
      const data = await res.json();
      setError(data.error || "Erreur lors de la réservation");
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-brand-cream flex items-center justify-center px-6">
        <div className="bg-white p-12 md:p-16 max-w-md w-full text-center border border-brand-gold/20">
          <div className="w-16 h-16 border border-brand-gold/30 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-brand-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="luxury-heading text-2xl text-brand-bordeaux mb-3">Reservation enregistree</h2>
          <p className="text-sm text-brand-bordeaux/50 mb-8 leading-relaxed">
            Votre reservation pour <strong>{offer.title}</strong> a ete enregistree.
            Procedez au paiement pour recevoir votre QR code de confirmation.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href={`/cliente/paiement?bookingId=${bookingId}`}
              className="inline-block px-8 py-4 text-xs tracking-[0.2em] uppercase bg-brand-bordeaux text-white hover:bg-brand-gold transition-colors duration-500"
            >
              Payer maintenant
            </Link>
            <Link
              href="/cliente"
              className="inline-block px-8 py-3 text-xs tracking-[0.2em] uppercase border border-brand-gold/20 text-brand-bordeaux/60 hover:border-brand-gold transition-colors duration-500"
            >
              Payer plus tard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-cream">
      {/* Nav */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-brand-gold/15 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex items-center justify-between h-16">
          <Link href="/" className="luxury-heading text-xl text-brand-bordeaux">
            Beauté<span className="text-brand-gold">.</span>tn
          </Link>
          <Link href="/offres" className="text-xs tracking-[0.2em] uppercase text-brand-bordeaux/60 hover:text-brand-gold transition-colors duration-500">
            Toutes les offres
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 md:px-12 py-12 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16">
          {/* Image */}
          <div className="space-y-3">
            <div className="relative aspect-[4/5] bg-gradient-to-br from-brand-nude to-brand-peach flex items-center justify-center overflow-hidden luxury-image-reveal">
              {offer.photos.length > 0 ? (
                <Image src={offer.photos[selectedPhoto]} alt={offer.title} fill className="object-cover" />
              ) : (
                <span className="text-8xl opacity-30">💇‍♀️</span>
              )}
            </div>
            {offer.photos.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {offer.photos.map((photo, i) => (
                  <button
                    key={photo}
                    type="button"
                    onClick={() => setSelectedPhoto(i)}
                    className={`relative aspect-square overflow-hidden border-2 transition-colors ${i === selectedPhoto ? "border-brand-gold" : "border-transparent hover:border-brand-gold/30"}`}
                  >
                    <Image src={photo} alt={`Photo ${i + 1}`} fill className="object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col justify-center">
            <p className="luxury-badge mb-6">
              {offer.category}
            </p>

            {reviews.length > 0 && (
              <div className="flex items-center gap-2 mb-4">
                <StarRating rating={Math.round(avgRating)} />
                <span className="text-sm text-brand-bordeaux/60">{avgRating.toFixed(1)}</span>
                <span className="text-xs text-brand-bordeaux/30">({reviews.length} avis)</span>
              </div>
            )}

            <h1 className="luxury-heading text-3xl md:text-4xl text-brand-bordeaux mb-3">
              {offer.title}
            </h1>

            <p className="text-xs tracking-[0.2em] uppercase text-brand-bordeaux/40 mb-6">
              {offer.provider.salonName}
              {offer.provider.city && ` — ${offer.provider.city}`}
            </p>

            {/* Price */}
            <div className="flex items-baseline gap-4 mb-6 pb-6 border-b border-brand-gold/15">
              <span className="luxury-heading text-4xl text-brand-gold">
                {offer.discountPrice.toFixed(0)} DT
              </span>
              <span className="text-brand-bordeaux/30 line-through text-lg">
                {offer.originalPrice.toFixed(0)} DT
              </span>
              <span className="text-xs tracking-[0.15em] uppercase text-brand-gold font-medium">
                -{discount}%
              </span>
            </div>

            {offer.description && (
              <p className="text-brand-bordeaux/60 leading-relaxed mb-8">{offer.description}</p>
            )}

            {/* CTA */}
            {!showBooking ? (
              <button
                onClick={() => setShowBooking(true)}
                className="w-full py-4 text-xs tracking-[0.2em] uppercase bg-brand-bordeaux text-white hover:bg-brand-gold transition-colors duration-500"
              >
                Réserver maintenant
              </button>
            ) : (
              <form onSubmit={handleBook} className="space-y-5 p-6 border border-brand-gold/20 bg-white">
                {error && (
                  <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100">{error}</div>
                )}
                <div>
                  <label className="block text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/60 mb-3">
                    Choisir un créneau *
                  </label>
                  <BookingCalendar
                    slots={offer.slots}
                    selectedSlotId={selectedSlot}
                    onSelect={setSelectedSlot}
                  />
                </div>
                <div>
                  <label className="block text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/60 mb-2">
                    Notes (optionnel)
                  </label>
                  <textarea
                    value={bookingNotes}
                    onChange={(e) => setBookingNotes(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-3 border border-brand-gold/20 text-brand-bordeaux text-sm focus:outline-none focus:border-brand-gold transition-colors bg-transparent"
                    placeholder="Précisions, préférences..."
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-3.5 text-xs tracking-[0.2em] uppercase bg-brand-bordeaux text-white hover:bg-brand-gold transition-colors duration-500 disabled:opacity-50"
                  >
                    {loading ? "Réservation..." : `Confirmer · ${offer.discountPrice.toFixed(0)} DT`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBooking(false)}
                    className="px-6 py-3.5 text-xs tracking-[0.15em] uppercase border border-brand-gold/20 text-brand-bordeaux/60 hover:border-brand-gold transition-colors duration-500"
                  >
                    Annuler
                  </button>
                </div>
                {!session && (
                  <p className="text-[10px] tracking-wider text-brand-bordeaux/40 text-center">
                    Vous serez redirigé vers la connexion pour finaliser
                  </p>
                )}
              </form>
            )}
          </div>
        </div>

        {/* Provider info */}
        <div className="mt-16 md:mt-24 p-8 md:p-12 border border-brand-gold/15 bg-white">
          <p className="luxury-badge mb-4">Le salon</p>
          <h2 className="luxury-heading text-xl text-brand-bordeaux mb-3">
            {offer.provider.salonName}
          </h2>
          {offer.provider.description && (
            <p className="text-brand-bordeaux/60 leading-relaxed">{offer.provider.description}</p>
          )}
          {offer.provider.city && (
            <p className="text-xs tracking-[0.15em] uppercase text-brand-bordeaux/40 mt-4">
              {offer.provider.city}
            </p>
          )}
          <Link
            href={`/salon/${offer.provider.id}`}
            className="inline-block mt-6 px-6 py-3 text-xs tracking-[0.2em] uppercase border border-brand-gold text-brand-bordeaux hover:bg-brand-gold hover:text-white transition-colors duration-500"
          >
            Voir le salon
          </Link>
        </div>

        {/* Reviews section */}
        <div className="mt-16 md:mt-24">
          <div className="text-center mb-10">
            <p className="luxury-badge mb-4">Avis clients</p>
            {reviews.length > 0 ? (
              <div className="flex items-center justify-center gap-3">
                <StarRating rating={Math.round(avgRating)} size="lg" />
                <span className="luxury-heading text-2xl text-brand-bordeaux">{avgRating.toFixed(1)}</span>
                <span className="text-sm text-brand-bordeaux/40">/ 5</span>
                <span className="text-xs text-brand-bordeaux/30 ml-2">({reviews.length} avis)</span>
              </div>
            ) : (
              <p className="text-sm text-brand-bordeaux/40">Aucun avis pour le moment</p>
            )}
            <div className="luxury-divider mt-6" />
          </div>

          <div className="space-y-4 max-w-2xl mx-auto">
            {reviews.map((review) => (
              <div key={review.id} className="bg-white border border-brand-gold/15 p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-brand-nude flex items-center justify-center text-xs text-brand-bordeaux/60 font-medium">
                      {review.clientName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm text-brand-bordeaux font-medium">{review.clientName}</p>
                      <p className="text-[10px] text-brand-bordeaux/30">
                        {new Date(review.createdAt).toLocaleDateString("fr-TN", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                  <StarRating rating={review.rating} />
                </div>
                {review.comment && (
                  <p className="text-sm text-brand-bordeaux/70 leading-relaxed">{review.comment}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
