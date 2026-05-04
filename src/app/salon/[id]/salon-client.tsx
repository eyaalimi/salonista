"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { MultiServiceCalendar, type SimpleSlot } from "@/components/multi-service-calendar";
import { DAY_KEYS, DAY_LABELS_FR, type OpeningHours } from "@/lib/opening-hours";
import { NavAccount } from "@/components/nav-account";
import { Logo } from "@/components/logo";

interface Offer {
  id: string;
  title: string;
  description: string | null;
  originalPrice: number;
  discountPrice: number;
  category: string;
  durationMinutes: number;
  photos: string[];
  slots: SimpleSlot[];
}

interface Salon {
  id: string;
  salonName: string;
  category: string;
  description: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  photos: string[];
  verified: boolean;
  openingHours: OpeningHours | null;
  lat: number | null;
  lng: number | null;
  offers: Offer[];
}

function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h}h${String(m).padStart(2, "0")}`;
}

const DRAFT_KEY_PREFIX = "salon_draft_";
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface SalonDraft {
  cart: string[];
  selectedStart: string | null;
  notes: string;
  savedAt: number;
}

export function SalonClient({ salon }: { salon: Salon }) {
  const { data: session } = useSession();
  const [cart, setCart] = useState<string[]>([]); // ordered list of offerIds
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const hydratedRef = useRef(false);
  const draftKey = `${DRAFT_KEY_PREFIX}${salon.id}`;

  // Restore draft on mount (cart, selected start, notes)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) {
        hydratedRef.current = true;
        return;
      }
      const draft: SalonDraft = JSON.parse(raw);
      if (Date.now() - draft.savedAt > DRAFT_TTL_MS) {
        localStorage.removeItem(draftKey);
        hydratedRef.current = true;
        return;
      }
      // Filter out offers that no longer exist on this salon
      const validIds = new Set(salon.offers.map((o) => o.id));
      const validCart = draft.cart.filter((id) => validIds.has(id));
      if (validCart.length === 0) {
        localStorage.removeItem(draftKey);
        hydratedRef.current = true;
        return;
      }
      setCart(validCart);
      // Don't restore start time if it's in the past
      if (draft.selectedStart && new Date(draft.selectedStart).getTime() > Date.now()) {
        setSelectedStart(draft.selectedStart);
      }
      setNotes(draft.notes || "");
      setRestored(true);
    } catch {
      // ignore
    } finally {
      hydratedRef.current = true;
    }
  }, [draftKey, salon.offers]);

  // Persist draft whenever it changes (after hydration)
  useEffect(() => {
    if (!hydratedRef.current || typeof window === "undefined") return;
    if (cart.length === 0) {
      localStorage.removeItem(draftKey);
      return;
    }
    const draft: SalonDraft = {
      cart,
      selectedStart,
      notes,
      savedAt: Date.now(),
    };
    localStorage.setItem(draftKey, JSON.stringify(draft));
  }, [cart, selectedStart, notes, draftKey]);

  function toggleOffer(offerId: string) {
    setCart((prev) => {
      if (prev.includes(offerId)) return prev.filter((id) => id !== offerId);
      return [...prev, offerId];
    });
    setSelectedStart(null);
  }

  function moveOffer(offerId: string, dir: -1 | 1) {
    setCart((prev) => {
      const idx = prev.indexOf(offerId);
      if (idx === -1) return prev;
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      return copy;
    });
    setSelectedStart(null);
  }

  const cartOffers = useMemo(
    () => cart.map((id) => salon.offers.find((o) => o.id === id)!).filter(Boolean),
    [cart, salon.offers]
  );

  const totalPrice = cartOffers.reduce((sum, o) => sum + o.discountPrice, 0);
  const totalDuration = cartOffers.reduce((sum, o) => sum + o.durationMinutes, 0);

  async function handleBook() {
    if (!session) {
      window.location.href = `/login?callbackUrl=/salon/${salon.id}`;
      return;
    }
    if (cart.length === 0) {
      setError("Sélectionnez au moins un service");
      return;
    }
    if (!selectedStart) {
      setError("Choisissez une heure de début");
      return;
    }
    setLoading(true);
    setError("");

    const token = typeof window !== "undefined" ? localStorage.getItem("tracking_ref") : null;

    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        offerIds: cart,
        startTime: selectedStart,
        notes: notes || null,
        trackingToken: token,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      // Clear the saved draft now that the booking went through
      if (typeof window !== "undefined") {
        localStorage.removeItem(draftKey);
      }
      setSuccess(data.id);
    } else {
      const data = await res.json();
      setError(data.error || "Erreur lors de la réservation");
    }
    setLoading(false);
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
          <h2 className="luxury-heading text-2xl text-brand-bordeaux mb-3">Réservation enregistrée</h2>
          <p className="text-sm text-brand-bordeaux/50 mb-8 leading-relaxed">
            Procédez au paiement pour recevoir votre QR code.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href={`/cliente/paiement?bookingId=${success}`}
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
          <div className="flex items-center gap-6">
            <Link href="/offres" className="text-xs tracking-[0.2em] uppercase text-brand-ink-soft hover:text-brand-gold transition-colors duration-500">
              Toutes les offres
            </Link>
            <NavAccount />
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 md:px-12 py-12 md:py-16">
        {/* Salon header */}
        <div className="mb-12">
          {salon.photos.length > 0 && (
            <div className="relative aspect-[21/9] mb-8 overflow-hidden">
              <Image src={salon.photos[0]} alt={salon.salonName} fill className="object-cover" sizes="100vw" />
            </div>
          )}
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="luxury-badge mb-3">{salon.category}</p>
              <h1 className="luxury-heading text-3xl md:text-5xl text-brand-bordeaux">
                {salon.salonName}
              </h1>
              {salon.verified && (
                <span className="inline-block mt-3 px-3 py-1 border border-brand-gold text-brand-gold text-[10px] tracking-wider uppercase">
                  Salon vérifié
                </span>
              )}
            </div>
          </div>
          {salon.description && (
            <p className="text-brand-bordeaux/60 leading-relaxed mt-6 max-w-3xl">{salon.description}</p>
          )}
          {restored && cart.length > 0 && (
            <div className="mt-6 p-4 border border-brand-gold/40 bg-brand-gold/5 flex items-center justify-between gap-4 flex-wrap">
              <p className="text-xs text-brand-bordeaux">
                Votre sélection précédente a été restaurée — {cart.length} service{cart.length > 1 ? "s" : ""}.
              </p>
              <button
                type="button"
                onClick={() => {
                  setCart([]);
                  setSelectedStart(null);
                  setNotes("");
                  setRestored(false);
                }}
                className="text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/60 hover:text-brand-gold transition-colors"
              >
                Effacer
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* LEFT: services list + cart summary */}
          <div className="lg:col-span-2 space-y-8">
            {/* Services list */}
            <section>
              <h2 className="luxury-heading text-2xl text-brand-bordeaux mb-2">Services proposés</h2>
              <p className="text-xs text-brand-bordeaux/50 mb-6">
                Sélectionnez un ou plusieurs services. Vous choisirez ensuite une seule heure de début.
              </p>

              {salon.offers.length === 0 ? (
                <p className="text-sm text-brand-bordeaux/40">Aucune offre disponible pour le moment</p>
              ) : (
                <div className="space-y-3">
                  {salon.offers.map((offer) => {
                    const discount = Math.round(
                      ((offer.originalPrice - offer.discountPrice) / offer.originalPrice) * 100
                    );
                    const inCart = cart.includes(offer.id);
                    return (
                      <button
                        type="button"
                        key={offer.id}
                        onClick={() => toggleOffer(offer.id)}
                        className={`w-full text-left bg-white border transition-colors duration-300 overflow-hidden flex ${
                          inCart ? "border-brand-gold shadow-sm" : "border-brand-gold/20 hover:border-brand-gold/60"
                        }`}
                      >
                        {offer.photos.length > 0 && (
                          <div className="relative w-32 sm:w-40 aspect-square shrink-0">
                            <Image src={offer.photos[0]} alt={offer.title} fill className="object-cover" sizes="160px" />
                          </div>
                        )}
                        <div className="flex-1 p-4 sm:p-5 flex flex-col">
                          <div className="flex items-start justify-between gap-3 mb-1">
                            <h3 className="luxury-heading text-base sm:text-lg text-brand-bordeaux">{offer.title}</h3>
                            <div className="text-right shrink-0">
                              <p className="luxury-heading text-base text-brand-gold">
                                {offer.discountPrice.toFixed(0)} DT
                              </p>
                              {discount > 0 && (
                                <p className="text-[10px] tracking-wider uppercase text-brand-gold/70">-{discount}%</p>
                              )}
                            </div>
                          </div>
                          <p className="text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/40 mb-2">
                            {formatDuration(offer.durationMinutes)}
                          </p>
                          {offer.description && (
                            <p className="text-xs text-brand-bordeaux/60 line-clamp-2">{offer.description}</p>
                          )}
                          <div className="mt-auto pt-3 flex items-center gap-2">
                            <span
                              className={`inline-flex items-center justify-center w-5 h-5 border-2 transition-colors ${
                                inCart ? "border-brand-gold bg-brand-gold" : "border-brand-bordeaux/30"
                              }`}
                            >
                              {inCart && (
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </span>
                            <span className="text-[10px] tracking-[0.2em] uppercase text-brand-bordeaux/60">
                              {inCart ? "Sélectionné" : "Ajouter"}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Calendar */}
            {cartOffers.length > 0 && (
              <section>
                <h2 className="luxury-heading text-2xl text-brand-bordeaux mb-2">Choisir une date</h2>
                <p className="text-xs text-brand-bordeaux/50 mb-6">
                  Une seule heure de début. Les services s&apos;enchaînent automatiquement dans l&apos;ordre choisi.
                </p>
                <MultiServiceCalendar
                  selectedOffers={cartOffers}
                  selectedStart={selectedStart}
                  onSelect={setSelectedStart}
                />
              </section>
            )}
          </div>

          {/* RIGHT: contact + cart */}
          <aside className="lg:col-span-1 space-y-6">
            {/* Cart summary (sticky) */}
            <div className="bg-white border border-brand-gold/30 p-6 sticky top-24">
              <p className="text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/40 mb-4">Votre réservation</p>

              {cart.length === 0 ? (
                <p className="text-xs text-brand-bordeaux/40 italic py-3">
                  Aucun service sélectionné
                </p>
              ) : (
                <div className="space-y-3 mb-4">
                  {cartOffers.map((offer, idx) => (
                    <div key={offer.id} className="flex items-start gap-2 p-3 bg-brand-cream/50 border border-brand-gold/15">
                      <span className="w-5 h-5 rounded-full bg-brand-bordeaux text-white text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-brand-bordeaux font-medium truncate">{offer.title}</p>
                        <p className="text-[10px] text-brand-bordeaux/40">
                          {formatDuration(offer.durationMinutes)} · {offer.discountPrice.toFixed(0)} DT
                        </p>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => moveOffer(offer.id, -1)}
                          disabled={idx === 0}
                          className="text-brand-bordeaux/40 hover:text-brand-gold disabled:opacity-30 text-xs"
                          aria-label="Monter"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => moveOffer(offer.id, 1)}
                          disabled={idx === cartOffers.length - 1}
                          className="text-brand-bordeaux/40 hover:text-brand-gold disabled:opacity-30 text-xs"
                          aria-label="Descendre"
                        >
                          ▼
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleOffer(offer.id)}
                        className="text-red-500 hover:text-red-700 text-xs"
                        aria-label="Retirer"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {cart.length > 0 && (
                <>
                  <div className="space-y-1 pt-3 border-t border-brand-gold/15 mb-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-brand-bordeaux/50">Durée totale</span>
                      <span className="text-brand-bordeaux">{formatDuration(totalDuration)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] tracking-wider uppercase text-brand-bordeaux/40">Total</span>
                      <span className="luxury-heading text-2xl text-brand-gold">{totalPrice.toFixed(0)} DT</span>
                    </div>
                    {selectedStart && (
                      <div className="flex justify-between items-center text-xs pt-2 mt-2 border-t border-brand-gold/15">
                        <span className="text-brand-bordeaux/50">Début</span>
                        <span className="text-brand-bordeaux font-medium">
                          {new Date(selectedStart).toLocaleString("fr-TN", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    )}
                  </div>

                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notes (optionnel)"
                    rows={2}
                    className="w-full px-3 py-2 border border-brand-gold/20 bg-transparent text-brand-bordeaux text-xs placeholder:text-brand-bordeaux/30 focus:outline-none focus:border-brand-gold mb-3"
                  />
                  {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
                  <button
                    onClick={handleBook}
                    disabled={loading || !selectedStart}
                    className="w-full py-3 text-xs tracking-[0.2em] uppercase bg-brand-bordeaux text-white hover:bg-brand-gold transition-colors duration-500 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {loading ? "Réservation..." : "Confirmer la réservation"}
                  </button>
                  {!selectedStart && cart.length > 0 && (
                    <p className="text-[10px] text-brand-bordeaux/40 text-center mt-2 italic">
                      Choisissez une heure pour activer le bouton
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Contact */}
            <div className="bg-white border border-brand-gold/20 p-6">
              <p className="text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/40 mb-4">Coordonnées</p>
              {salon.address && (
                <p className="text-sm text-brand-bordeaux mb-2">{salon.address}</p>
              )}
              {salon.city && (
                <p className="text-sm text-brand-bordeaux/60 mb-3">{salon.city}</p>
              )}
              {salon.phone && (
                <a href={`tel:${salon.phone}`} className="text-sm text-brand-gold hover:underline block">
                  {salon.phone}
                </a>
              )}
              {salon.lat && salon.lng && (
                <a
                  href={`https://www.google.com/maps?q=${salon.lat},${salon.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-4 text-[10px] tracking-[0.15em] uppercase text-brand-gold hover:text-brand-bordeaux"
                >
                  Voir sur la carte →
                </a>
              )}
            </div>

            {salon.openingHours && (
              <div className="bg-white border border-brand-gold/20 p-6">
                <p className="text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/40 mb-4">Horaires</p>
                <div className="space-y-1.5 text-xs">
                  {DAY_KEYS.map((day) => {
                    const ranges = salon.openingHours![day];
                    return (
                      <div key={day} className="flex justify-between">
                        <span className="text-brand-bordeaux/60">{DAY_LABELS_FR[day]}</span>
                        <span className="text-brand-bordeaux">
                          {ranges.length === 0
                            ? "Fermé"
                            : ranges.map((r) => `${r.start}–${r.end}`).join(", ")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
