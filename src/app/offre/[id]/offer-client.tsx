"use client";

import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import Link from "next/link";
import { BookingCalendar } from "@/components/booking-calendar";
import { Logo } from "@/components/logo";
import { UploadedImage } from "@/components/uploaded-image";

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
  const { data: session, update: updateSession } = useSession();
  const [showBooking, setShowBooking] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [bookingNotes, setBookingNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [bookingId, setBookingId] = useState("");
  const [error, setError] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState(0);

  // Inline auth state — used when an unauthenticated visitor lands via a tracking link
  const [authMode, setAuthMode] = useState<"register" | "login">("register");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [authPassword, setAuthPassword] = useState("");

  const discount = Math.round(
    ((offer.originalPrice - offer.discountPrice) / offer.originalPrice) * 100
  );

  useEffect(() => {
    if (trackingToken) {
      localStorage.setItem("tracking_ref", trackingToken);
    }
  }, [trackingToken]);

  async function createBooking(slotStartTime: string) {
    const token = trackingToken || localStorage.getItem("tracking_ref");
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        offerIds: [offer.id],
        startTime: slotStartTime,
        notes: bookingNotes || null,
        trackingToken: token,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Erreur lors de la réservation");
    }
    return res.json();
  }

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    setError("");

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

    try {
      // Already authenticated → straight to booking
      if (session) {
        const data = await createBooking(slotObj.startTime);
        setBookingId(data.id);
        setSuccess(true);
        return;
      }

      // Inline auth: register or login first, then book
      if (!authEmail || !authPassword) {
        throw new Error("Email et mot de passe requis");
      }

      if (authMode === "register") {
        if (!authName) throw new Error("Veuillez entrer votre nom");
        const regRes = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: authEmail,
            password: authPassword,
            name: authName,
            phone: authPhone || null,
            role: "CLIENT",
            autoVerify: true,
          }),
        });
        if (!regRes.ok) {
          const data = await regRes.json().catch(() => ({}));
          throw new Error(data.error || "Inscription impossible");
        }
      }

      const signInRes = await signIn("credentials", {
        email: authEmail,
        password: authPassword,
        redirect: false,
      });
      if (signInRes?.error) {
        throw new Error(
          authMode === "login"
            ? "Email ou mot de passe incorrect"
            : "Compte créé mais connexion impossible. Réessayez."
        );
      }

      // Refresh the session so subsequent server calls see the cookie
      await updateSession();

      const data = await createBooking(slotObj.startTime);
      setBookingId(data.id);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
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
          <Logo className="text-xl" />
          <Link href="/offres" className="text-sm font-medium text-brand-ink-soft hover:text-brand-gold transition-colors">
            Toutes les offres
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 md:px-12 py-12 md:py-20 pb-32 md:pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16">
          {/* Image */}
          <div className="space-y-3">
            <div className="relative aspect-[4/5] bg-gradient-to-br from-brand-nude to-brand-peach flex items-center justify-center overflow-hidden luxury-image-reveal">
              {offer.photos.length > 0 ? (
                <UploadedImage src={offer.photos[selectedPhoto]} alt={offer.title} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
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
                    <UploadedImage src={photo} alt={`Photo ${i + 1}`} fill sizes="100px" className="object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col justify-center">
            {/* Salon + quartier — above the fold on mobile */}
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-full bg-brand-sand px-3 py-1 text-xs font-medium text-brand-ink">
                {offer.category}
              </span>
              {reviews.length > 0 && (
                <div className="flex items-center gap-1">
                  <StarRating rating={Math.round(avgRating)} />
                  <span className="text-xs text-brand-ink-soft">
                    {avgRating.toFixed(1)} · {reviews.length} avis
                  </span>
                </div>
              )}
            </div>

            <p className="text-base font-semibold text-brand-ink">
              {offer.provider.salonName}
            </p>
            {offer.provider.city && (
              <p className="mt-0.5 text-sm text-brand-ink-soft">
                📍 {offer.provider.city}
              </p>
            )}

            <h1 className="luxury-heading mt-4 text-2xl text-brand-ink md:text-4xl">
              {offer.title}
            </h1>

            {/* Price */}
            <div className="mt-5 mb-6 flex items-baseline gap-3 border-b border-brand-line pb-6">
              <span className="luxury-heading text-3xl text-brand-gold sm:text-4xl">
                {offer.discountPrice.toFixed(0)} DT
              </span>
              {offer.originalPrice > offer.discountPrice && (
                <>
                  <span className="text-base text-gray-400 line-through sm:text-lg">
                    {offer.originalPrice.toFixed(0)} DT
                  </span>
                  <span className="rounded-full bg-brand-ink px-2.5 py-0.5 text-xs font-bold text-[#FBFAF7]">
                    -{discount}%
                  </span>
                </>
              )}
            </div>

            {offer.description && (
              <p className="mb-8 leading-relaxed text-brand-ink-soft">{offer.description}</p>
            )}

            {/* CTA — desktop button (mobile uses the sticky bar at bottom) */}
            {!showBooking ? (
              <button
                onClick={() => setShowBooking(true)}
                className="hidden w-full rounded-2xl bg-brand-ink py-4 text-base font-semibold text-white transition-colors hover:bg-brand-gold md:block"
              >
                Réserver maintenant
              </button>
            ) : (
              <form onSubmit={handleBook} className="space-y-6 p-6 border border-brand-gold/20 bg-white">
                {error && (
                  <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100">{error}</div>
                )}

                {/* 1. Slot picker */}
                <div>
                  <p className="text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/60 mb-3">
                    1. Choisir un créneau
                  </p>
                  <BookingCalendar
                    slots={offer.slots}
                    selectedSlotId={selectedSlot}
                    onSelect={setSelectedSlot}
                  />
                </div>

                {/* 2. Inline auth — only if not signed in */}
                {!session && (
                  <div className="pt-5 border-t border-brand-gold/15">
                    <p className="text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/60 mb-3">
                      2. Vos coordonnées
                    </p>

                    <div className="flex gap-2 mb-4 text-[10px] tracking-[0.15em] uppercase">
                      <button
                        type="button"
                        onClick={() => setAuthMode("register")}
                        className={`flex-1 py-2.5 transition-colors ${
                          authMode === "register"
                            ? "bg-brand-bordeaux text-white"
                            : "border border-brand-gold/20 text-brand-bordeaux/60 hover:border-brand-gold"
                        }`}
                      >
                        Nouveau client
                      </button>
                      <button
                        type="button"
                        onClick={() => setAuthMode("login")}
                        className={`flex-1 py-2.5 transition-colors ${
                          authMode === "login"
                            ? "bg-brand-bordeaux text-white"
                            : "border border-brand-gold/20 text-brand-bordeaux/60 hover:border-brand-gold"
                        }`}
                      >
                        J&apos;ai déjà un compte
                      </button>
                    </div>

                    <div className="space-y-3">
                      {authMode === "register" && (
                        <>
                          <input
                            type="text"
                            value={authName}
                            onChange={(e) => setAuthName(e.target.value)}
                            placeholder="Nom complet *"
                            required={authMode === "register"}
                            autoComplete="name"
                            className="w-full px-4 py-3 border border-brand-gold/20 text-brand-bordeaux text-sm placeholder:text-brand-bordeaux/30 focus:outline-none focus:border-brand-gold transition-colors bg-transparent"
                          />
                          <input
                            type="tel"
                            value={authPhone}
                            onChange={(e) => setAuthPhone(e.target.value)}
                            placeholder="Téléphone (optionnel)"
                            autoComplete="tel"
                            className="w-full px-4 py-3 border border-brand-gold/20 text-brand-bordeaux text-sm placeholder:text-brand-bordeaux/30 focus:outline-none focus:border-brand-gold transition-colors bg-transparent"
                          />
                        </>
                      )}
                      <input
                        type="email"
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        placeholder="Email *"
                        required
                        autoComplete="email"
                        className="w-full px-4 py-3 border border-brand-gold/20 text-brand-bordeaux text-sm placeholder:text-brand-bordeaux/30 focus:outline-none focus:border-brand-gold transition-colors bg-transparent"
                      />
                      <input
                        type="password"
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        placeholder={authMode === "register" ? "Mot de passe (min. 6 caractères) *" : "Mot de passe *"}
                        required
                        minLength={authMode === "register" ? 6 : undefined}
                        autoComplete={authMode === "register" ? "new-password" : "current-password"}
                        className="w-full px-4 py-3 border border-brand-gold/20 text-brand-bordeaux text-sm placeholder:text-brand-bordeaux/30 focus:outline-none focus:border-brand-gold transition-colors bg-transparent"
                      />
                      {authMode === "login" && (
                        <Link
                          href="/forgot-password"
                          className="block text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/50 hover:text-brand-gold transition-colors"
                        >
                          Mot de passe oublié ?
                        </Link>
                      )}
                    </div>
                  </div>
                )}

                {/* 3. Notes */}
                <div className="pt-5 border-t border-brand-gold/15">
                  <p className="text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/60 mb-2">
                    {session ? "2." : "3."} Notes (optionnel)
                  </p>
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
                    {loading
                      ? "Traitement…"
                      : `Réserver · ${offer.discountPrice.toFixed(0)} DT`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBooking(false)}
                    className="px-6 py-3.5 text-xs tracking-[0.15em] uppercase border border-brand-gold/20 text-brand-bordeaux/60 hover:border-brand-gold transition-colors duration-500"
                  >
                    Annuler
                  </button>
                </div>
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

      {/* Mobile sticky CTA — sits above the BottomNav (60px tall) */}
      {!showBooking && (
        <div className="fixed bottom-[60px] left-0 right-0 z-40 border-t border-brand-line bg-white p-4 md:hidden">
          <button
            onClick={() => setShowBooking(true)}
            className="flex w-full min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-brand-ink text-base font-semibold text-white transition-colors hover:bg-brand-gold"
          >
            Réserver maintenant — {offer.discountPrice.toFixed(0)} DT
          </button>
        </div>
      )}
    </div>
  );
}
