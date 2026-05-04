"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface VerificationData {
  valid: boolean;
  verified: boolean;
  booking: {
    id: string;
    offerTitle: string;
    salonName: string;
    clientName: string | null;
    clientEmail: string;
    totalPrice: string;
    bookedFor: string;
    paymentStatus: string;
    status: string;
    paidAt: string | null;
  };
}

export default function VerificationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-brand-cream" />}>
      <VerificationPageInner />
    </Suspense>
  );
}

function VerificationPageInner() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const [data, setData] = useState<VerificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!code) {
      setError("Aucun code fourni");
      setLoading(false);
      return;
    }
    fetch(`/api/payment/verify?code=${code}`)
      .then(async (r) => {
        if (!r.ok) {
          setError("Code invalide ou introuvable");
          setLoading(false);
          return;
        }
        setData(await r.json());
        setLoading(false);
      });
  }, [code]);

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-cream flex items-center justify-center">
        <p className="text-brand-bordeaux/40 text-xs tracking-[0.2em] uppercase">Verification...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-brand-cream flex items-center justify-center px-6">
        <div className="bg-white p-12 max-w-md w-full text-center border border-red-300">
          <div className="w-16 h-16 mx-auto mb-4 border border-red-300 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="luxury-heading text-xl text-brand-bordeaux mb-2">Code invalide</h1>
          <p className="text-sm text-brand-bordeaux/40">{error}</p>
          <Link href="/" className="inline-block mt-6 text-xs tracking-[0.2em] uppercase text-brand-gold hover:text-brand-bordeaux transition-colors">
            Retour a l&apos;accueil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-cream flex items-center justify-center px-6">
      <div className="bg-white p-10 max-w-md w-full border border-brand-gold/20">
        <div className="text-center mb-6">
          <Link href="/" className="luxury-heading text-xl text-brand-bordeaux">
            Beaute<span className="text-brand-gold">.</span>tn
          </Link>
        </div>

        <div className="text-center mb-6">
          {data.booking.paymentStatus === "PAID" ? (
            <div className="w-16 h-16 mx-auto mb-4 border-2 border-emerald-500 flex items-center justify-center">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : (
            <div className="w-16 h-16 mx-auto mb-4 border-2 border-amber-400 flex items-center justify-center">
              <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
          )}

          <h1 className="luxury-heading text-xl text-brand-bordeaux mb-1">
            {data.booking.paymentStatus === "PAID" ? "Paiement verifie" : "Non paye"}
          </h1>
          <p className={`text-[10px] tracking-[0.15em] uppercase font-medium ${
            data.booking.paymentStatus === "PAID" ? "text-emerald-600" : "text-amber-600"
          }`}>
            {data.booking.paymentStatus === "PAID"
              ? (data.verified ? "Deja scanne" : "Reservation valide")
              : "Paiement en attente"}
          </p>
        </div>

        <div className="luxury-divider my-6" />

        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-brand-bordeaux/40">Service</span>
            <span className="text-brand-bordeaux font-medium">{data.booking.offerTitle}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-brand-bordeaux/40">Salon</span>
            <span className="text-brand-bordeaux">{data.booking.salonName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-brand-bordeaux/40">Client</span>
            <span className="text-brand-bordeaux">{data.booking.clientName || data.booking.clientEmail}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-brand-bordeaux/40">Date</span>
            <span className="text-brand-bordeaux">
              {new Date(data.booking.bookedFor).toLocaleDateString("fr-TN", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-brand-bordeaux/40">Montant</span>
            <span className="luxury-heading text-xl text-brand-gold">{Number(data.booking.totalPrice).toFixed(0)} DT</span>
          </div>
        </div>
      </div>
    </div>
  );
}
