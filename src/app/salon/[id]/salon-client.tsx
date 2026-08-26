"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { UploadedImage } from "@/components/uploaded-image";
import { useSession } from "next-auth/react";
import { MultiServiceCalendar, type SimpleSlot } from "@/components/multi-service-calendar";
import { DAY_KEYS, DAY_LABELS_FR, type OpeningHours } from "@/lib/opening-hours";
import { NavAccount } from "@/components/nav-account";
import { Logo } from "@/components/logo";
import { isValidCoords } from "@/lib/coords";
import { scrollToElement } from "@/lib/scroll-to";
import dynamic from "next/dynamic";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateHeure } from "@/lib/datetime";

// Leaflet manipule le DOM et n'existe pas cote serveur : sans ssr:false, le
// build echoue sur « window is not defined ».
const SalonMap = dynamic(() => import("@/components/map/salon-map"), {
  ssr: false,
  loading: () => (
    <div className="h-56 w-full rounded-[var(--radius-panel)] bg-rose-soft" />
  ),
});

interface Offer {
  id: string;
  title: string;
  description: string | null;
  originalPrice: number;
  discountPrice: number;
  taxRate: number;
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
  // Le calendrier apparait sous le pli quand le panier se remplit : sans
  // defilement, la cliente ajoute un service et croit qu'il ne s'est rien
  // passe. Meme traitement que sur /offre/[id].
  const calendrierRef = useRef<HTMLElement | null>(null);
  const panierEtaitVide = useRef(true);
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

  // Defile vers le calendrier au PREMIER service ajoute seulement. Le faire a
  // chaque ajout arracherait la page sous les doigts d'une cliente qui
  // compose un panier de plusieurs prestations.
  useEffect(() => {
    if (cart.length > 0 && panierEtaitVide.current) {
      panierEtaitVide.current = false;
      scrollToElement(calendrierRef.current);
    } else if (cart.length === 0) {
      panierEtaitVide.current = true;
    }
  }, [cart.length]);

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
      setError("Sélectionne au moins un service");
      return;
    }
    if (!selectedStart) {
      setError("Choisis une heure de début");
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
      <div className="flex min-h-screen items-center justify-center bg-creme px-6">
        <div className="w-full max-w-md rounded-[var(--radius-card)] border-2 border-hairline bg-white p-12 text-center md:p-16">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-menthe">
            <svg className="h-8 w-8 text-menthe-deep" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="ds-display mb-3 text-2xl text-prune">Réservation confirmée</h2>
          <p className="mb-8 text-base leading-relaxed text-prune-soft">
            Présente ton QR code au salon : tu règles ton soin sur place.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href={`/cliente/reservation?bookingId=${success}`}
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
          <div className="flex items-center gap-6">
            <Link
              href="/offres"
              className="ds-focus rounded-[var(--radius-pill)] px-2 py-1 text-base text-prune-soft hover:text-rose-fonce-fonce"
            >
              Toutes les offres
            </Link>
            <NavAccount />
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-6 pt-12 pb-40 md:px-12 md:pt-16 md:pb-16">
        {/* Salon header */}
        <div className="mb-12">
          {/* Le salon peut deposer jusqu'a 5 photos ; seule la premiere
              s'affichait, les autres etaient enregistrees mais invisibles.
              La premiere reste en banniere, les suivantes en galerie. */}
          {salon.photos.length > 0 && (
            <div className="mb-8">
              <div className="relative aspect-[21/9] overflow-hidden rounded-[var(--radius-card)]">
                <UploadedImage
                  src={salon.photos[0]}
                  alt={salon.salonName}
                  fill
                  className="object-cover"
                  sizes="100vw"
                />
              </div>
              {salon.photos.length > 1 && (
                <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {salon.photos.slice(1).map((photo, i) => (
                    <li
                      key={photo}
                      className="relative aspect-square overflow-hidden rounded-[var(--radius-card)]"
                    >
                      <UploadedImage
                        src={photo}
                        alt={`${salon.salonName} — photo ${i + 2}`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, 25vw"
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-prune-soft">
                {salon.category}
              </p>
              <h1 className="ds-display text-3xl text-prune md:text-5xl">
                {salon.salonName}
              </h1>
              {salon.verified && (
                <span className="mt-3 inline-block">
                  <Badge tone="menthe">Salon vérifié</Badge>
                </span>
              )}
            </div>
          </div>
          {salon.description && (
            <p className="mt-6 max-w-3xl text-base leading-relaxed text-prune-soft">
              {salon.description}
            </p>
          )}
          {restored && cart.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-panel)] border-2 border-hairline bg-white p-4">
              <p className="text-sm text-prune">
                Ta sélection précédente a été restaurée — {cart.length} service{cart.length > 1 ? "s" : ""}.
              </p>
              <button
                type="button"
                onClick={() => {
                  setCart([]);
                  setSelectedStart(null);
                  setNotes("");
                  setRestored(false);
                }}
                className="ds-press ds-focus min-h-[44px] rounded-[var(--radius-pill)] px-4 text-sm font-semibold text-prune-soft hover:text-rose-fonce-fonce"
              >
                Effacer
              </button>
            </div>
          )}
        </div>

        {/* `items-start` est INDISPENSABLE au sticky de la colonne droite :
            une grille etire ses cellules par defaut (`stretch`), la colonne
            fait alors toute la hauteur de la ligne et n'a plus de place pour
            coller. */}
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-3">
          {/* LEFT: services list + cart summary */}
          <div className="lg:col-span-2 space-y-8">
            {/* Services list */}
            <section>
              <h2 className="ds-display mb-2 text-2xl text-prune">Services proposés</h2>
              <p className="mb-6 text-base text-prune-soft">
                Sélectionne un ou plusieurs services. Tu choisiras ensuite une seule heure de début.
              </p>

              {salon.offers.length === 0 ? (
                <p className="text-base text-prune-soft">Aucune offre disponible pour le moment</p>
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
                        aria-pressed={inCart}
                        className={`ds-press ds-focus flex w-full overflow-hidden rounded-[var(--radius-card)] border-2 text-left ${
                          inCart
                            ? "border-rose bg-rose-soft"
                            : "border-hairline bg-white hover:border-rose"
                        }`}
                      >
                        {offer.photos.length > 0 && (
                          <div className="relative aspect-square w-32 shrink-0 sm:w-40">
                            <UploadedImage src={offer.photos[0]} alt={offer.title} fill className="object-cover" sizes="160px" />
                          </div>
                        )}
                        <div className="flex flex-1 flex-col p-4 sm:p-5">
                          <div className="mb-1 flex items-start justify-between gap-3">
                            <h3 className="ds-display text-base text-prune sm:text-lg">{offer.title}</h3>
                            <div className="shrink-0 text-right">
                              <p className="ds-display text-lg text-prune">
                                {offer.discountPrice.toFixed(0)} TND
                              </p>
                              {discount > 0 && (
                                <span className="mt-1 inline-block">
                                  <Badge tone="rose">-{discount}%</Badge>
                                </span>
                              )}
                              <p className="mt-1 text-xs text-prune-soft">
                                TVA {Number(offer.taxRate ?? 19)}%
                              </p>
                            </div>
                          </div>
                          <p className="mb-2 text-sm font-semibold text-prune-soft">
                            {formatDuration(offer.durationMinutes)}
                          </p>
                          {offer.description && (
                            <p className="line-clamp-2 text-sm text-prune-soft">{offer.description}</p>
                          )}
                          <div className="mt-auto flex items-center gap-2 pt-3">
                            <span
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                                inCart ? "border-rose bg-rose" : "border-hairline"
                              }`}
                            >
                              {/* La coche est en prune, pas en blanc : c'est un
                                  indicateur d'etat, soumis au seuil de 3:1 de
                                  WCAG 1.4.11. Blanc sur rose donne 2,94:1. */}
                              {inCart && (
                                <svg className="h-4 w-4 text-prune" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </span>
                            <span className="text-sm font-semibold text-prune">
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
              <section ref={calendrierRef}>
                <h2 className="ds-display mb-2 text-2xl text-prune">Choisir une date</h2>
                <p className="mb-6 text-base text-prune-soft">
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

          {/* RIGHT: contact + cart
              Le `sticky` porte sur TOUTE la colonne, pas sur le seul panier.
              Quand il etait sur le panier, celui-ci se figeait pendant que
              « Coordonnees » et « Horaires » — ses freres dans le meme
              conteneur — continuaient de defiler DERRIERE lui : les panneaux
              se chevauchaient.
              `max-h` + `overflow-y-auto` : sur un petit ecran, une colonne
              plus haute que la fenetre deviendrait autrement inatteignable
              par le bas. */}
          <aside className="space-y-6 lg:col-span-1 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
            {/* Cart summary */}
            <div className="rounded-[var(--radius-card)] border-2 border-hairline bg-white p-6">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-prune-soft">Ta réservation</p>

              {cart.length === 0 ? (
                <p className="py-3 text-sm text-prune-soft">
                  Aucun service sélectionné
                </p>
              ) : (
                <div className="mb-4 space-y-3">
                  {cartOffers.map((offer, idx) => (
                    <div key={offer.id} className="flex items-start gap-2 rounded-[var(--radius-panel)] border border-hairline bg-creme p-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-prune text-xs font-bold text-white">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-prune">{offer.title}</p>
                        <p className="text-xs text-prune-soft">
                          {formatDuration(offer.durationMinutes)} · {offer.discountPrice.toFixed(0)} TND
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col">
                        <button
                          type="button"
                          onClick={() => moveOffer(offer.id, -1)}
                          disabled={idx === 0}
                          className="ds-press ds-focus flex h-[22px] w-11 items-center justify-center rounded-t-[var(--radius-panel)] text-prune-soft hover:text-rose-fonce-fonce"
                          aria-label={`Monter ${offer.title}`}
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => moveOffer(offer.id, 1)}
                          disabled={idx === cartOffers.length - 1}
                          className="ds-press ds-focus flex h-[22px] w-11 items-center justify-center rounded-b-[var(--radius-panel)] text-prune-soft hover:text-rose-fonce-fonce"
                          aria-label={`Descendre ${offer.title}`}
                        >
                          ▼
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleOffer(offer.id)}
                        className="ds-press ds-focus flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-pill)] text-prune-soft hover:text-rose-fonce-fonce"
                        aria-label={`Retirer ${offer.title}`}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {cart.length > 0 && (
                <>
                  <div className="mb-3 space-y-1 border-t border-hairline pt-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-prune-soft">Durée totale</span>
                      <span className="text-prune">{formatDuration(totalDuration)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-prune-soft">Total</span>
                      <span className="ds-display text-2xl text-prune">{totalPrice.toFixed(0)} TND</span>
                    </div>
                    {selectedStart && (
                      <div className="mt-2 flex items-center justify-between border-t border-hairline pt-2 text-sm">
                        <span className="text-prune-soft">Début</span>
                        <span className="font-semibold text-prune">
                          {formatDateHeure(selectedStart)}
                        </span>
                      </div>
                    )}
                  </div>

                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notes (optionnel)"
                    rows={2}
                    className="ds-focus mb-3 w-full rounded-[var(--radius-panel)] border-2 border-hairline bg-white px-4 py-3 text-base text-prune placeholder:text-prune-soft/50"
                  />
                  {error && <p className="mb-3 text-sm font-semibold text-rose-fonce">{error}</p>}
                  {/* Masque sur mobile : la barre fixe du bas porte deja l'action.
                      Deux boutons roses simultanes enfreindraient la regle
                      « une seule action primaire par vue ». Sur desktop la barre
                      fixe n'existe pas (md:hidden), donc ce bouton reste. */}
                  <div className="hidden md:block">
                    <Button
                      onClick={handleBook}
                      disabled={loading || !selectedStart}
                      fullWidth
                    >
                      {loading ? "Réservation…" : "Confirmer la réservation"}
                    </Button>
                    {!selectedStart && cart.length > 0 && (
                      <p className="mt-2 text-center text-sm text-prune-soft">
                        Choisis une heure pour activer le bouton
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Contact */}
            <div className="rounded-[var(--radius-card)] border-2 border-hairline bg-white p-6">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-prune-soft">Coordonnées</p>
              {salon.address && (
                <p className="mb-2 text-base text-prune">{salon.address}</p>
              )}
              {salon.city && (
                <p className="mb-3 text-base text-prune-soft">{salon.city}</p>
              )}
              {salon.phone && (
                <a
                  href={`tel:${salon.phone}`}
                  className="ds-press ds-focus inline-flex min-h-[44px] items-center rounded-[var(--radius-pill)] text-base font-semibold text-rose-fonce hover:underline"
                >
                  {salon.phone}
                </a>
              )}
              {salon.lat !== null && salon.lng !== null && isValidCoords(salon.lat, salon.lng) && (
                <div className="mt-4">
                  <SalonMap lat={salon.lat} lng={salon.lng} label={salon.salonName} />
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${salon.lat},${salon.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ds-press ds-focus mt-3 flex min-h-[44px] w-full items-center justify-center rounded-[var(--radius-pill)] border-2 border-hairline text-base font-semibold text-prune hover:border-rose"
                  >
                    Itinéraire →
                  </a>
                </div>
              )}
            </div>

            {salon.openingHours && (
              <div className="rounded-[var(--radius-card)] border-2 border-hairline bg-white p-6">
                <p className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-prune-soft">Horaires</p>
                <div className="space-y-1.5 text-sm">
                  {DAY_KEYS.map((day) => {
                    const ranges = salon.openingHours![day];
                    return (
                      <div key={day} className="flex justify-between">
                        <span className="text-prune-soft">{DAY_LABELS_FR[day]}</span>
                        <span className="text-prune">
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

      {/* Barre de reservation fixe — mobile uniquement.
          BottomNav occupe fixed bottom-0 z-50 h-[60px] avec la safe-area :
          on se pose exactement au-dessus, sinon les deux se superposent. */}
      {cart.length > 0 && (
        <div
          className="fixed left-0 right-0 z-40 border-t border-hairline bg-white px-6 py-3 md:hidden"
          style={{ bottom: "calc(60px + env(safe-area-inset-bottom))" }}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs text-prune-soft">
                {cart.length} service{cart.length > 1 ? "s" : ""} · {formatDuration(totalDuration)}
              </p>
              <p className="ds-display text-xl text-prune">{totalPrice.toFixed(0)} TND</p>
            </div>
            <Button
              onClick={handleBook}
              disabled={loading || !selectedStart}
              className="shrink-0"
            >
              {loading ? "Réservation…" : selectedStart ? "Confirmer" : "Choisis une heure"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
