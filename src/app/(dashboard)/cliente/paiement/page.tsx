"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

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
      <div className="text-center py-20">
        <p className="text-brand-bordeaux/40 text-sm">Aucune reservation selectionnee</p>
        <Link href="/cliente" className="inline-block mt-4 px-6 py-3 text-xs tracking-[0.2em] uppercase bg-brand-bordeaux text-white">
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
                {Number(result.booking.totalPrice).toFixed(0)} DT
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
      <div className="max-w-lg mx-auto text-center py-20">
        <div className="w-16 h-16 mx-auto mb-6 border border-brand-gold/30 flex items-center justify-center animate-pulse">
          <svg className="w-8 h-8 text-brand-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="luxury-heading text-xl text-brand-bordeaux mb-2">Traitement en cours</p>
        <p className="text-xs text-brand-bordeaux/40 tracking-wider">Veuillez patienter...</p>
      </div>
    );
  }

  // Payment form
  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-8">
        <p className="luxury-badge mb-3">Paiement securise</p>
        <h1 className="luxury-heading text-2xl text-brand-bordeaux">Finaliser le paiement</h1>
      </div>

      {/* Booking summary */}
      {booking && (
        <div className="bg-white border border-brand-gold/20 p-5 mb-6">
          <p className="text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/40 mb-3">Resume</p>
          <h3 className="luxury-heading text-lg text-brand-bordeaux">
            {booking.items.map((i) => i.offer.title).join(", ")}
          </h3>
          <p className="text-xs text-brand-bordeaux/40 mt-1">{booking.items[0]?.offer.provider.salonName}</p>
          {booking.items[0]?.slot && (
            <p className="text-xs text-brand-bordeaux/30 mt-1">
              {new Date(booking.items[0].slot.startTime).toLocaleDateString("fr-TN", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          )}
          <div className="mt-4 pt-4 border-t border-brand-gold/10 flex justify-between items-center">
            <span className="text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/40">Total a payer</span>
            <span className="luxury-heading text-2xl text-brand-gold">{Number(booking.totalPrice).toFixed(0)} DT</span>
          </div>

          {booking.paymentStatus === "PAID" && (
            <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-center">
              <p className="text-xs text-emerald-700 tracking-wider uppercase">Deja payee</p>
              <Link
                href={`/cliente/reservation?id=${booking.id}`}
                className="inline-block mt-2 text-xs text-emerald-600 underline"
              >
                Voir mon QR code
              </Link>
            </div>
          )}
        </div>
      )}

      {booking?.paymentStatus !== "PAID" && (
        <form onSubmit={handlePayment} className="bg-white border border-brand-gold/20 p-6 space-y-5">
          <p className="text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/40 mb-2">Informations de paiement</p>

          {error && (
            <div className="p-3 border border-red-300 text-red-600 text-xs tracking-wider">{error}</div>
          )}

          <div>
            <label className="block text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/50 mb-2">
              Nom sur la carte
            </label>
            <input
              type="text"
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              required
              placeholder="ALIMI EYA"
              className="w-full px-4 py-3 border border-brand-gold/20 bg-transparent text-brand-bordeaux text-sm placeholder:text-brand-bordeaux/20 focus:outline-none focus:border-brand-gold transition-colors"
            />
          </div>

          <div>
            <label className="block text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/50 mb-2">
              Numero de carte
            </label>
            <input
              type="text"
              value={cardNumber}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 16);
                setCardNumber(v.replace(/(\d{4})/g, "$1 ").trim());
              }}
              required
              placeholder="4242 4242 4242 4242"
              className="w-full px-4 py-3 border border-brand-gold/20 bg-transparent text-brand-bordeaux text-sm placeholder:text-brand-bordeaux/20 focus:outline-none focus:border-brand-gold transition-colors font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/50 mb-2">
                Expiration
              </label>
              <input
                type="text"
                value={expiry}
                onChange={(e) => {
                  let v = e.target.value.replace(/\D/g, "").slice(0, 4);
                  if (v.length > 2) v = v.slice(0, 2) + "/" + v.slice(2);
                  setExpiry(v);
                }}
                required
                placeholder="MM/AA"
                className="w-full px-4 py-3 border border-brand-gold/20 bg-transparent text-brand-bordeaux text-sm placeholder:text-brand-bordeaux/20 focus:outline-none focus:border-brand-gold transition-colors font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/50 mb-2">
                CVV
              </label>
              <input
                type="text"
                value={cvv}
                onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 3))}
                required
                placeholder="123"
                className="w-full px-4 py-3 border border-brand-gold/20 bg-transparent text-brand-bordeaux text-sm placeholder:text-brand-bordeaux/20 focus:outline-none focus:border-brand-gold transition-colors font-mono"
              />
            </div>
          </div>

          <div className="bg-brand-cream/50 p-4 text-center">
            <p className="text-[10px] text-brand-bordeaux/40 leading-relaxed">
              Paiement simule — aucune carte reelle ne sera debitee.
              En production, integration avec Flouci ou Konnect.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 text-xs tracking-[0.2em] uppercase bg-brand-bordeaux text-white hover:bg-brand-gold transition-colors duration-500 disabled:opacity-50"
          >
            {loading ? "Traitement..." : `Payer ${booking ? Number(booking.totalPrice).toFixed(0) : ""} DT`}
          </button>
        </form>
      )}
    </div>
  );
}
