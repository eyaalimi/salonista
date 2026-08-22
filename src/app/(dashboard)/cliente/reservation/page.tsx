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
    <Suspense fallback={<div className="min-h-screen bg-creme" />}>
      <ReservationDetailPageInner />
    </Suspense>
  );
}

function ReservationDetailPageInner() {
  const searchParams = useSearchParams();
  // Les deux noms circulent : `id` dans les liens historiques, `bookingId`
  // dans ceux qui viennent de /cliente/paiement et des mails. Accepter les
  // deux evite un « Aucune reservation selectionnee » selon la provenance.
  const bookingId = searchParams.get("bookingId") ?? searchParams.get("id");
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

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-base text-prune-soft">Chargement…</div>;
  }

  if (error) {
    return (
      <div className="py-20 text-center">
        <p className="mb-4 text-base font-semibold text-rose">{error}</p>
        <Link
          href="/cliente"
          className="ds-press ds-focus inline-flex min-h-[48px] items-center rounded-[var(--radius-pill)] border-2 border-hairline px-6 text-base font-semibold text-prune hover:border-rose"
        >
          Retour
        </Link>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-8">
        <Link
          href="/cliente"
          className="ds-press ds-focus mb-4 inline-flex min-h-[44px] items-center rounded-[var(--radius-pill)] text-base font-semibold text-prune-soft hover:text-rose"
        >
          Retour aux réservations
        </Link>
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-prune-soft">Ma réservation</p>
        <h1 className="ds-display text-2xl text-prune">{data.booking.offerTitle}</h1>
      </div>

      <div className="rounded-[var(--radius-card)] border-2 border-hairline bg-white p-8">
        {/* Status */}
        <div className="mb-6 text-center">
          {data.verified ? (
            <span className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-menthe px-4 py-2">
              <svg className="h-4 w-4 text-menthe-deep" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {/* `prune` et non `menthe-deep` : sur fond menthe, menthe-deep
                  donne 3,73:1 — sous les 4,5:1 qu'exige ce texte de 14px.
                  Le prune y atteint 11,63:1. L'icone garde menthe-deep : un
                  pictogramme releve du seuil de 3:1, qu'elle depasse. */}
              <span className="text-sm font-semibold text-prune">Vérifié par le salon</span>
            </span>
          ) : (
            <span className="inline-flex items-center rounded-[var(--radius-pill)] border-2 border-hairline px-4 py-2 text-sm font-semibold text-prune">
              Confirmé — en attente de visite
            </span>
          )}
        </div>

        {/* QR Code */}
        <div className="mb-6 text-center">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-prune-soft">
            {data.verified ? "QR code utilisé" : "Présente ce code au salon"}
          </p>
          {/* Le cadre est restyle, PAS l'image : un QR altere devient illisible
              au scanner. `w-56 h-56`, le fond blanc et l'`opacity-60` d'un code
              deja utilise restent inchanges. */}
          <div className={`inline-block rounded-[var(--radius-panel)] border-2 bg-white p-4 ${data.verified ? "border-menthe opacity-60" : "border-hairline"}`}>
            <img src={data.qrCode} alt="QR Code" className="w-56 h-56" />
          </div>
          <p className="mt-3 font-mono text-sm text-prune-soft">{data.qrToken}</p>
          {data.verified && data.verifiedAt && (
            <p className="mt-2 text-sm text-menthe-deep">
              Vérifié le {new Date(data.verifiedAt).toLocaleDateString("fr-TN", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>

        <div className="my-6 h-px bg-hairline" />

        {/* Details */}
        <div className="space-y-3 text-base">
          <div className="flex justify-between gap-3">
            <span className="text-prune-soft">Salon</span>
            <span className="text-right font-semibold text-prune">{data.booking.salonName}</span>
          </div>
          {data.booking.address && (
            <div className="flex justify-between gap-3">
              <span className="text-prune-soft">Adresse</span>
              <span className="text-right text-prune">
                {data.booking.address}
                {data.booking.city && `, ${data.booking.city}`}
              </span>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <span className="text-prune-soft">Date du rendez-vous</span>
            <span className="text-right text-prune">
              {new Date(data.booking.bookedFor).toLocaleDateString("fr-TN", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
          {/* « A regler au salon » et non « Montant paye » : rien n'a ete
              encaisse ici. La ligne « Paye le » a disparu — `paidAt` reste
              nul, elle affichait « Invalid Date ». */}
          <div className="flex justify-between gap-3">
            <span className="text-prune-soft">À régler au salon</span>
            <span className="ds-display text-xl text-prune">
              {Number(data.booking.totalPrice).toFixed(0)} TND
            </span>
          </div>
        </div>

        <div className="my-6 h-px bg-hairline" />

        <div className="rounded-[var(--radius-panel)] bg-creme p-4 text-center">
          <p className="text-sm leading-relaxed text-prune-soft">
            {data.verified
              ? "Ta visite a été confirmée. Merci de ta confiance."
              : "Montre ce QR code au prestataire à ton arrivée au salon. Il sera scanné pour valider ta réservation."}
          </p>
        </div>
      </div>
    </div>
  );
}
