"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PaymentResult {
  success: boolean;
  qrCode: string;
  qrToken: string;
  booking: {
    id: string;
    totalPrice: string;
    bookedFor: string;
    offer: {
      title: string;
      provider: { salonName: string; address: string | null; city: string | null };
    };
  };
}

interface ClientBooking {
  id: string;
  totalPrice: string;
  paymentStatus: string;
  items: { offer: { title: string; provider: { salonName: string } }; slot: { startTime: string } }[];
}

export default function PaiementPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-creme" />}>
      <PaiementPageInner />
    </Suspense>
  );
}

function PaiementPageInner() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("bookingId");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"form" | "processing" | "success">("form");

  // Simulated card info
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [cardName, setCardName] = useState("");

  // Load booking info
  const [booking, setBooking] = useState<ClientBooking | null>(null);

  useEffect(() => {
    if (!bookingId) return;
    fetch("/api/client/bookings")
      .then((r) => r.json())
      .then((data) => {
        const found = data.find((b: { id: string }) => b.id === bookingId);
        if (found) setBooking(found);
      });
  }, [bookingId]);

  async function handlePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!bookingId) return;

    setStep("processing");
    setLoading(true);
    setError("");

    // Simulate processing delay
    await new Promise((r) => setTimeout(r, 2000));

    const res = await fetch("/api/payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId }),
    });

    try {
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur de paiement");
        setStep("form");
        setLoading(false);
        return;
      }
      setResult(data);
      setStep("success");
    } catch {
      setError("Erreur serveur, veuillez reessayer");
      setStep("form");
    }
    setLoading(false);
  }

  if (!bookingId) {
    return (
      <div className="py-20 text-center">
        <p className="text-base text-prune-soft">Aucune réservation sélectionnée</p>
        <Link
          href="/cliente"
          className="ds-press ds-focus mt-4 inline-flex min-h-[48px] items-center rounded-[var(--radius-pill)] border-2 border-hairline px-6 text-base font-semibold text-prune hover:border-rose"
        >
          Retour
        </Link>
      </div>
    );
  }

  // Success — show QR code
  if (step === "success" && result) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 border-2 border-emerald-500 flex items-center justify-center">
            <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="luxury-badge mb-3">Paiement confirme</p>
          <h1 className="luxury-heading text-2xl text-brand-bordeaux">Merci pour votre paiement</h1>
        </div>

        <div className="bg-white border border-brand-gold/20 p-8">
          {/* QR Code */}
          <div className="text-center mb-6">
            <p className="text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/40 mb-4">
              Votre code QR de confirmation
            </p>
            <div className="inline-block p-4 border border-brand-gold/20">
              <img src={result.qrCode} alt="QR Code" className="w-64 h-64" />
            </div>
            <p className="text-xs text-brand-bordeaux/40 mt-3">
              Code : {result.qrToken}
            </p>
          </div>

          <div className="luxury-divider my-6" />

          {/* Booking details */}
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-brand-bordeaux/40">Service</span>
              <span className="text-brand-bordeaux font-medium">{result.booking.offer.title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-bordeaux/40">Salon</span>
              <span className="text-brand-bordeaux">{result.booking.offer.provider.salonName}</span>
            </div>
            {result.booking.offer.provider.address && (
              <div className="flex justify-between">
                <span className="text-brand-bordeaux/40">Adresse</span>
                <span className="text-brand-bordeaux text-right">
                  {result.booking.offer.provider.address}
                  {result.booking.offer.provider.city && `, ${result.booking.offer.provider.city}`}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-brand-bordeaux/40">Date</span>
              <span className="text-brand-bordeaux">
                {new Date(result.booking.bookedFor).toLocaleDateString("fr-TN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-bordeaux/40">Montant paye</span>
              <span className="luxury-heading text-xl text-brand-gold">
                {Number(result.booking.totalPrice).toFixed(0)} TND
              </span>
            </div>
          </div>

          <div className="luxury-divider my-6" />

          <div className="bg-brand-cream/50 p-4 text-center">
            <p className="text-xs text-brand-bordeaux/60 leading-relaxed">
              Presentez ce QR code au salon lors de votre visite.
              Le prestataire le scannera pour confirmer votre reservation.
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Link
            href="/cliente"
            className="flex-1 text-center px-6 py-3 text-xs tracking-[0.2em] uppercase border border-brand-gold/20 text-brand-bordeaux hover:border-brand-gold transition-colors duration-500"
          >
            Mes reservations
          </Link>
          <Link
            href={`/cliente/reservation?id=${result.booking.id}`}
            className="flex-1 text-center px-6 py-3 text-xs tracking-[0.2em] uppercase bg-brand-bordeaux text-white hover:bg-brand-gold transition-colors duration-500"
          >
            Voir le QR code
          </Link>
        </div>
      </div>
    );
  }

  // Processing animation
  if (step === "processing") {
    return (
      <div className="mx-auto max-w-lg py-20 text-center">
        {/* `animate-pulse` est CONSERVE : le design system interdit les
            animations d'APPARITION, pas les indicateurs d'activite. Le
            paiement simule 2 secondes — sans retour visuel, la cliente croit
            que rien ne se passe, sur l'ecran le plus anxiogene du parcours. */}
        <div className="mx-auto mb-6 flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-rose-soft">
          <svg className="h-8 w-8 text-prune" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="ds-display mb-2 text-xl text-prune">Traitement en cours</p>
        <p className="text-base text-prune-soft">Un instant…</p>
      </div>
    );
  }

  // Payment form
  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-8">
        {/* Le surtitre « Paiement securise » a ete retire : le formulaire
            n'envoie aucune donnee bancaire (le POST ne transmet que
            bookingId), promettre la securite serait trompeur. */}
        <h1 className="ds-display text-2xl text-prune">Finaliser le paiement</h1>
      </div>

      {/* Booking summary */}
      {booking && (
        <div className="mb-6 rounded-[var(--radius-card)] border-2 border-hairline bg-white p-5">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-prune-soft">Résumé</p>
          <h3 className="ds-display text-lg text-prune">
            {booking.items.map((i) => i.offer.title).join(", ")}
          </h3>
          <p className="mt-1 text-sm text-prune-soft">{booking.items[0]?.offer.provider.salonName}</p>
          {booking.items[0]?.slot && (
            <p className="mt-1 text-sm text-prune-soft">
              {new Date(booking.items[0].slot.startTime).toLocaleDateString("fr-TN", {
                weekday: "long",
                day: "numeric",
                month: "long",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
          <div className="mt-4 flex items-center justify-between border-t border-hairline pt-4">
            <span className="text-sm font-semibold uppercase tracking-[0.12em] text-prune-soft">Total à payer</span>
            <span className="ds-display text-2xl text-prune">{Number(booking.totalPrice).toFixed(0)} TND</span>
          </div>

          {booking.paymentStatus === "PAID" && (
            <div className="mt-4 rounded-[var(--radius-panel)] bg-menthe p-3 text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.1em] text-menthe-deep">Déjà payée</p>
              <Link
                href={`/cliente/reservation?id=${booking.id}`}
                className="ds-press ds-focus mt-2 inline-block text-sm font-semibold text-menthe-deep underline"
              >
                Voir mon QR code
              </Link>
            </div>
          )}
        </div>
      )}

      {booking?.paymentStatus !== "PAID" && (
        <>
          {error && (
            <div className="mb-6 rounded-[var(--radius-panel)] border-2 border-rose bg-rose-soft p-4 text-sm font-semibold text-prune">
              {error}
            </div>
          )}

          <form onSubmit={handlePayment} className="space-y-5 rounded-[var(--radius-card)] border-2 border-hairline bg-white p-8">
            <Input
              label="Nom sur la carte"
              id="carte-nom"
              type="text"
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              placeholder="Comme inscrit sur la carte"
              required
            />

            <Input
              label="Numéro de carte"
              id="carte-numero"
              type="text"
              value={cardNumber}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 16);
                setCardNumber(v.replace(/(\d{4})/g, "$1 ").trim());
              }}
              placeholder="0000 0000 0000 0000"
              required
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Expiration"
                id="carte-expiration"
                type="text"
                value={expiry}
                onChange={(e) => {
                  let v = e.target.value.replace(/\D/g, "").slice(0, 4);
                  if (v.length > 2) v = v.slice(0, 2) + "/" + v.slice(2);
                  setExpiry(v);
                }}
                placeholder="MM/AA"
                required
              />
              <Input
                label="CVV"
                id="carte-cvv"
                type="text"
                value={cvv}
                onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 3))}
                placeholder="123"
                required
              />
            </div>

            <Button type="submit" disabled={loading} fullWidth>
              {loading ? "Traitement…" : `Payer ${booking ? Number(booking.totalPrice).toFixed(0) : ""} TND`}
            </Button>

            {/* Mention honnete : le POST /api/payment n'envoie que { bookingId },
                aucun de ces champs n'est transmis. Sans cette phrase, une testeuse
                pourrait croire qu'un vrai encaissement a lieu. */}
            <p className="text-center text-sm text-prune-soft">
              Paiement de démonstration — aucune donnée bancaire n&apos;est transmise.
            </p>
          </form>
        </>
      )}
    </div>
  );
}
