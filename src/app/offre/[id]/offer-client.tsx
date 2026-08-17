"use client";

import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import Link from "next/link";
import { BookingCalendar } from "@/components/booking-calendar";
import { Logo } from "@/components/logo";
import { UploadedImage } from "@/components/uploaded-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  taxRate: number;
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
        <span key={i} className={i <= rating ? "text-rose" : "text-hairline"}>
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
    <div className="min-h-screen bg-creme">
      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-hairline bg-creme">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 md:px-12">
          <Logo className="text-xl" />
          <Link
            href="/offres"
            className="ds-focus rounded-[var(--radius-pill)] px-2 py-1 text-base text-prune-soft hover:text-rose"
          >
            Toutes les offres
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 md:px-12 py-12 md:py-20 pb-32 md:pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16">
          {/* Image */}
          <div className="space-y-3">
            <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-[var(--radius-card)] bg-rose-soft">
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
                    aria-label={`Voir la photo ${i + 1}`}
                    aria-pressed={i === selectedPhoto}
                    className={`ds-press ds-focus relative aspect-square overflow-hidden rounded-[var(--radius-panel)] border-2 ${
                      i === selectedPhoto ? "border-rose" : "border-transparent hover:border-rose"
                    }`}
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
              <Badge tone="prune">{offer.category}</Badge>
              {reviews.length > 0 && (
                <div className="flex items-center gap-1">
                  <StarRating rating={Math.round(avgRating)} />
                  <span className="text-sm text-prune-soft">
                    {avgRating.toFixed(1)} · {reviews.length} avis
                  </span>
                </div>
              )}
            </div>

            <p className="text-base font-semibold text-prune">
              {offer.provider.salonName}
            </p>
            {offer.provider.city && (
              <p className="mt-0.5 text-sm text-prune-soft">
                📍 {offer.provider.city}
              </p>
            )}

            <h1 className="ds-display mt-4 text-2xl text-prune md:text-4xl">
              {offer.title}
            </h1>

            {/* Price */}
            <div className="mt-5 mb-6 border-b border-hairline pb-6">
              <div className="flex items-baseline gap-3">
                <span className="ds-display text-3xl text-prune sm:text-4xl">
                  {offer.discountPrice.toFixed(0)} TND
                </span>
                {offer.originalPrice > offer.discountPrice && (
                  <>
                    <span className="text-base text-prune-soft line-through sm:text-lg">
                      {offer.originalPrice.toFixed(0)} TND
                    </span>
                    <Badge tone="rose">-{discount}%</Badge>
                  </>
                )}
              </div>
              <p className="mt-2 text-sm text-prune-soft">
                TVA incluse : {Number(offer.taxRate ?? 19)}%
              </p>
            </div>

            {offer.description && (
              <p className="mb-8 leading-relaxed text-brand-ink-soft">{offer.description}</p>
            )}

            {/* CTA — desktop button (mobile uses the sticky bar at bottom) */}
            {!showBooking ? (
              <div className="hidden md:block">
                <Button onClick={() => setShowBooking(true)} fullWidth>
                  Réserver maintenant
                </Button>
              </div>
            ) : (
              <form onSubmit={handleBook} className="space-y-6 rounded-[var(--radius-card)] border-2 border-hairline bg-white p-6">
                {error && (
                  <div className="rounded-[var(--radius-panel)] border-2 border-rose bg-rose-soft p-3 text-sm font-semibold text-prune">
                    {error}
                  </div>
                )}

                {/* 1. Slot picker */}
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-prune-soft">
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
                  <div className="border-t border-hairline pt-5">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-prune-soft">
                      2. Tes coordonnées
                    </p>

                    {/* Onglets refaits a la main : RoleTabs est code en dur pour
                        les trois roles (CLIENT/PROVIDER/INFLUENCER) et ne peut
                        pas porter cet axe-ci. On reprend son apparence. */}
                    <div
                      role="tablist"
                      aria-label="Type de compte"
                      className="mb-4 flex gap-1 rounded-[var(--radius-pill)] bg-rose-soft p-1"
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={authMode === "register"}
                        onClick={() => setAuthMode("register")}
                        className={`ds-press ds-focus min-h-[44px] flex-1 rounded-[var(--radius-pill)] px-3 text-sm font-semibold ${
                          authMode === "register"
                            ? "bg-rose text-white"
                            : "bg-transparent text-prune hover:bg-white/60"
                        }`}
                      >
                        Nouveau client
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={authMode === "login"}
                        onClick={() => setAuthMode("login")}
                        className={`ds-press ds-focus min-h-[44px] flex-1 rounded-[var(--radius-pill)] px-3 text-sm font-semibold ${
                          authMode === "login"
                            ? "bg-rose text-white"
                            : "bg-transparent text-prune hover:bg-white/60"
                        }`}
                      >
                        J&apos;ai déjà un compte
                      </button>
                    </div>

                    <div className="space-y-4">
                      {authMode === "register" && (
                        <>
                          <Input
                            label="Nom complet"
                            id="auth-name"
                            type="text"
                            value={authName}
                            onChange={(e) => setAuthName(e.target.value)}
                            placeholder="Ton nom"
                            required={authMode === "register"}
                            autoComplete="name"
                          />
                          <Input
                            label="Téléphone (optionnel)"
                            id="auth-phone"
                            type="tel"
                            value={authPhone}
                            onChange={(e) => setAuthPhone(e.target.value)}
                            placeholder="00 000 000"
                            autoComplete="tel"
                          />
                        </>
                      )}
                      <Input
                        label="Email"
                        id="auth-email"
                        type="email"
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        placeholder="toi@exemple.com"
                        required
                        autoComplete="email"
                      />
                      <Input
                        label={authMode === "register" ? "Mot de passe (min. 6 caractères)" : "Mot de passe"}
                        id="auth-password"
                        type="password"
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        placeholder="••••••"
                        required
                        minLength={authMode === "register" ? 6 : undefined}
                        autoComplete={authMode === "register" ? "new-password" : "current-password"}
                      />
                      {authMode === "login" && (
                        <Link
                          href="/forgot-password"
                          className="ds-focus inline-flex min-h-[44px] items-center rounded-[var(--radius-pill)] text-sm font-semibold text-prune-soft hover:text-rose"
                        >
                          Mot de passe oublié ?
                        </Link>
                      )}
                    </div>
                  </div>
                )}

                {/* 3. Notes */}
                <div className="border-t border-hairline pt-5">
                  <label
                    htmlFor="booking-notes"
                    className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-prune-soft"
                  >
                    {session ? "2." : "3."} Notes (optionnel)
                  </label>
                  <textarea
                    id="booking-notes"
                    value={bookingNotes}
                    onChange={(e) => setBookingNotes(e.target.value)}
                    rows={2}
                    className="ds-focus w-full rounded-[var(--radius-panel)] border-2 border-hairline bg-white px-4 py-3 text-base text-prune placeholder:text-prune-soft/50"
                    placeholder="Précisions, préférences…"
                  />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="flex-1">
                    <Button type="submit" disabled={loading} fullWidth>
                      {loading
                        ? "Traitement…"
                        : `Réserver · ${offer.discountPrice.toFixed(0)} TND`}
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowBooking(false)}
                  >
                    Annuler
                  </Button>
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
