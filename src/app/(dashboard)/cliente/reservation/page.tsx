"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface BookingDetail {
  qrCode: string;
  qrToken: string;
  verified: boolean;
  verifiedAt: string | null;
  booking: {
    id: string;
    offerTitle: string;
    salonName: string;
    address: string | null;
    city: string | null;
    totalPrice: string;
    bookedFor: string;
    clientName: string | null;
    clientEmail: string;
    paidAt: string;
  };
}

export default function ReservationDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-brand-cream" />}>
      <ReservationDetailPageInner />
    </Suspense>
  );
}

function ReservationDetailPageInner() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("id");
  const [data, setData] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!bookingId) return;
    fetch(`/api/payment?bookingId=${bookingId}`)
      .then(async (r) => {
        if (!r.ok) {
          const d = await r.json();
          setError(d.error || "Erreur");
          setLoading(false);
          return;
        }
        setData(await r.json());
        setLoading(false);
      });
  }, [bookingId]);

  if (!bookingId) {
    return (
      <div className="text-center py-20">
        <p className="text-brand-bordeaux/40 text-sm">Aucune reservation selectionnee</p>
        <Link href="/cliente" className="inline-block mt-4 px-6 py-3 text-xs tracking-[0.2em] uppercase bg-brand-bordeaux text-white">Retour</Link>
      </div>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-brand-bordeaux/40 text-xs tracking-[0.2em] uppercase">Chargement...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500 text-sm mb-4">{error}</p>
        <Link href="/cliente" className="inline-block px-6 py-3 text-xs tracking-[0.2em] uppercase bg-brand-bordeaux text-white">Retour</Link>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-8">
        <Link href="/cliente" className="text-[10px] tracking-[0.2em] uppercase text-brand-gold hover:text-brand-bordeaux transition-colors duration-500 mb-4 inline-block">
          Retour aux reservations
        </Link>
        <p className="luxury-badge mb-3">Ma reservation</p>
        <h1 className="luxury-heading text-2xl text-brand-bordeaux">{data.booking.offerTitle}</h1>
      </div>

      <div className="bg-white border border-brand-gold/20 p-8">
        {/* Status */}
        <div className="text-center mb-6">
          {data.verified ? (
            <div className="inline-flex items-center gap-2 px-4 py-2 border border-emerald-300">
              <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-[10px] tracking-[0.15em] uppercase text-emerald-700 font-medium">Verifie par le salon</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-4 py-2 border border-brand-gold/30">
              <span className="text-[10px] tracking-[0.15em] uppercase text-brand-gold font-medium">Paye — en attente de visite</span>
            </div>
          )}
        </div>

        {/* QR Code */}
        <div className="text-center mb-6">
          <p className="text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/40 mb-4">
            {data.verified ? "QR code utilise" : "Presentez ce code au salon"}
          </p>
          <div className={`inline-block p-4 border ${data.verified ? "border-emerald-200 opacity-60" : "border-brand-gold/20"}`}>
            <img src={data.qrCode} alt="QR Code" className="w-56 h-56" />
          </div>
          <p className="text-xs text-brand-bordeaux/30 mt-3 font-mono">{data.qrToken}</p>
          {data.verified && data.verifiedAt && (
            <p className="text-xs text-emerald-600 mt-2">
              Verifie le {new Date(data.verifiedAt).toLocaleDateString("fr-TN", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>

        <div className="luxury-divider my-6" />

        {/* Details */}
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-brand-bordeaux/40">Salon</span>
            <span className="text-brand-bordeaux font-medium">{data.booking.salonName}</span>
          </div>
          {data.booking.address && (
            <div className="flex justify-between">
              <span className="text-brand-bordeaux/40">Adresse</span>
              <span className="text-brand-bordeaux text-right">
                {data.booking.address}
                {data.booking.city && `, ${data.booking.city}`}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-brand-bordeaux/40">Date du rendez-vous</span>
            <span className="text-brand-bordeaux">
              {new Date(data.booking.bookedFor).toLocaleDateString("fr-TN", {
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
              {Number(data.booking.totalPrice).toFixed(0)} DT
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-brand-bordeaux/40">Paye le</span>
            <span className="text-brand-bordeaux">
              {new Date(data.booking.paidAt).toLocaleDateString("fr-TN", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>

        <div className="luxury-divider my-6" />

        <div className="bg-brand-cream/50 p-4 text-center">
          <p className="text-xs text-brand-bordeaux/50 leading-relaxed">
            {data.verified
              ? "Votre visite a ete confirmee. Merci de votre confiance."
              : "Montrez ce QR code au prestataire a votre arrivee au salon. Il sera scanne pour valider votre reservation."}
          </p>
        </div>
      </div>
    </div>
  );
}
