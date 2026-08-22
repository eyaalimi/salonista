"use client";

import { useEffect, useRef, useState } from "react";
import { scrollToElement } from "@/lib/scroll-to";
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
  const formulaireRef = useRef<HTMLFormElement>(null);

  // « Réserver » fait descendre au formulaire : sur mobile il s'ouvre sous le
  // pli, et rien ne montre que le clic a fonctionne. Via un effet car le
  // formulaire n'est pas encore monte au moment du clic.
  useEffect(() => {
    if (showBooking) scrollToElement(formulaireRef.current);
  }, [showBooking]);
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
      setError("Choisis un créneau");
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
        if (!authName) throw new Error("Entre ton nom");
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
            : "Compte créé mais connexion impossible. Réessaie."
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
      <div className="flex min-h-screen items-center justify-center bg-creme px-6">
        <div className="w-full max-w-md rounded-[var(--radius-card)] border-2 border-hairline bg-white p-12 text-center md:p-16">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-menthe">
            <svg className="h-8 w-8 text-menthe-deep" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="ds-display mb-3 text-2xl text-prune">Réservation confirmée</h2>
          <p className="mb-8 text-base leading-relaxed text-prune-soft">
            Ton rendez-vous pour <strong className="font-semibold text-prune">{offer.title}</strong> est confirmé.
            Présente ton QR code au salon : tu règles ton soin sur place.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href={`/cliente/reservation?bookingId=${bookingId}`}
              className="ds-press ds-focus inline-flex min-h-[48px] w-full items-center justify-center rounded-[var(--radius-pill)] bg-rose px-6 text-base font-semibold text-prune hover:bg-[#F04A79]"
            >
              Voir mon QR code
            </Link>
            <Link
              href="/cliente"
              className="ds-press ds-focus inline-flex min-h-[48px] w-full items-center justify-center rounded-[var(--radius-pill)] border-2 border-hairline px-6 text-base font-semibold text-prune hover:border-rose"
            >
              Plus tard
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
              <p className="mb-8 text-base leading-relaxed text-prune-soft">{offer.description}</p>
            )}

            {/* CTA — desktop button (mobile uses the sticky bar at bottom) */}
            {!showBooking ? (
              <div className="hidden md:block">
                <Button onClick={() => setShowBooking(true)} fullWidth>
                  Réserver maintenant
                </Button>
              </div>
            ) : (
              <form ref={formulaireRef} onSubmit={handleBook} className="scroll-mt-4 space-y-6 rounded-[var(--radius-card)] border-2 border-hairline bg-white p-6">
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
                      onKeyDown={(e) => {
                        // Fleches gauche/droite : avec deux onglets, les deux
                        // touches basculent vers l'autre — c'est le bouclage.
                        //
                        // Le focus doit etre deplace explicitement : changer
                        // l'etat React ne bouge pas le focus du DOM, et le
                        // bouton focalise passerait a tabIndex={-1} apres le
                        // rendu, desynchronisant la navigation. On vise le
                        // bouton voisin dans le conteneur plutot que d'ajouter
                        // deux refs a ce fichier de 570 lignes.
                        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                        e.preventDefault();
                        const onglets = e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]');
                        const suivant = authMode === "register" ? onglets[1] : onglets[0];
                        setAuthMode(authMode === "register" ? "login" : "register");
                        suivant?.focus();
                      }}
                      className="mb-4 flex gap-1 rounded-[var(--radius-pill)] bg-rose-soft p-1"
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={authMode === "register"}
                        tabIndex={authMode === "register" ? 0 : -1}
                        onClick={() => setAuthMode("register")}
                        className={`ds-press ds-focus min-h-[44px] flex-1 rounded-[var(--radius-pill)] px-3 text-sm font-semibold ${
                          authMode === "register"
                            ? "bg-rose text-prune"
                            : "bg-transparent text-prune hover:bg-white/60"
                        }`}
                      >
                        Nouveau client
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={authMode === "login"}
                        tabIndex={authMode === "login" ? 0 : -1}
                        onClick={() => setAuthMode("login")}
                        className={`ds-press ds-focus min-h-[44px] flex-1 rounded-[var(--radius-pill)] px-3 text-sm font-semibold ${
                          authMode === "login"
                            ? "bg-rose text-prune"
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
        <div className="mt-16 rounded-[var(--radius-card)] border-2 border-hairline bg-white p-8 md:mt-24 md:p-12">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-prune-soft">Le salon</p>
          <h2 className="ds-display mb-3 text-xl text-prune">
            {offer.provider.salonName}
          </h2>
          {offer.provider.description && (
            <p className="text-base leading-relaxed text-prune-soft">{offer.provider.description}</p>
          )}
          {offer.provider.city && (
            <p className="mt-4 text-sm text-prune-soft">
              {offer.provider.city}
            </p>
          )}
          <Link
            href={`/salon/${offer.provider.id}`}
            className="ds-press ds-focus mt-6 inline-flex min-h-[48px] items-center justify-center rounded-[var(--radius-pill)] border-2 border-hairline px-6 text-base font-semibold text-prune hover:border-rose"
          >
            Voir le salon
          </Link>
        </div>

        {/* Reviews section */}
        <div className="mt-16 md:mt-24">
          <div className="mb-10 text-center">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-prune-soft">Avis clients</p>
            {reviews.length > 0 ? (
              <div className="flex items-center justify-center gap-3">
                <StarRating rating={Math.round(avgRating)} size="lg" />
                <span className="ds-display text-2xl text-prune">{avgRating.toFixed(1)}</span>
                <span className="text-base text-prune-soft">/ 5</span>
                <span className="ml-2 text-sm text-prune-soft">({reviews.length} avis)</span>
              </div>
            ) : (
              <p className="text-base text-prune-soft">Aucun avis pour le moment</p>
            )}
            <div className="mx-auto mt-6 h-px w-10 bg-hairline" />
          </div>

          <div className="mx-auto max-w-2xl space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="rounded-[var(--radius-card)] border-2 border-hairline bg-white p-6">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-soft text-sm font-bold text-prune">
                      {review.clientName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-prune">{review.clientName}</p>
                      <p className="text-xs text-prune-soft">
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
                  <p className="text-sm leading-relaxed text-prune-soft">{review.comment}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Barre fixe mobile — se pose au-dessus de BottomNav, qui occupe
          fixed bottom-0 z-50 h-[60px] avec la safe-area. Sans le calc(),
          la barre passe SOUS la navigation sur les iPhone a encoche. */}
      {!showBooking && (
        <div
          className="fixed left-0 right-0 z-40 border-t border-hairline bg-white p-4 md:hidden"
          style={{ bottom: "calc(60px + env(safe-area-inset-bottom))" }}
        >
          <Button onClick={() => setShowBooking(true)} fullWidth>
            Réserver maintenant — {offer.discountPrice.toFixed(0)} TND
          </Button>
        </div>
      )}
    </div>
  );
}
