"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { formatDateHeureComplete } from "@/lib/datetime";

interface VerificationData {
  valid: boolean;
  verified: boolean;
  verifiedAt?: string;
  /** `false` si le salon n'a pas le module caisse : pas d'encaissement ici. */
  caisseDisponible?: boolean;
  verifiedBy?: { displayName: string };
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const { data: session, status: sessionStatus } = useSession();

  const [data, setData] = useState<VerificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    if (!code) {
      setError("Aucun code fourni");
      setLoading(false);
      return;
    }
    const r = await fetch(`/api/payment/verify?code=${code}`);
    if (!r.ok) {
      setError("Code invalide ou introuvable");
      setLoading(false);
      return;
    }
    setData(await r.json());
    setError(""); // clear any stale POST error from a previous attempt
    setLoading(false);
  }, [code]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleConfirm() {
    if (!code) return;
    setConfirming(true);
    setError("");
    const r = await fetch("/api/payment/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    setConfirming(false);
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      setError(body.error || "Erreur lors de la vérification");
      return;
    }
    await reload();
  }

  const isSalonSession =
    !!session?.employee ||
    (session?.user as { role?: string } | undefined)?.role === "PROVIDER" ||
    (session?.user as { role?: string } | undefined)?.role === "ADMIN";

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-cream flex items-center justify-center">
        <p className="text-brand-ink-soft text-xs tracking-[0.2em] uppercase">Vérification...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-brand-cream flex items-center justify-center px-6">
        <div className="bg-white p-12 max-w-md w-full text-center border border-red-300">
          <h1 className="luxury-heading text-xl text-brand-ink mb-2">
            {code ? "Code invalide" : "Code manquant"}
          </h1>
          <p className="text-sm text-brand-ink-soft">{error || "Erreur inconnue"}</p>
          {/* Sans code, on arrive ici en tapant l'adresse a la main : c'est le
              moment d'expliquer comment on scanne, puisque rien ailleurs ne le
              dit. Le QR contient une URL — l'appareil photo du telephone
              suffit, aucune application a installer. */}
          {!code && (
            <p className="mt-4 rounded-xl bg-brand-cream p-4 text-left text-sm leading-relaxed text-brand-ink-soft">
              Pour valider une cliente, visez son QR code avec l&apos;appareil
              photo de votre téléphone : le lien s&apos;ouvre tout seul. Depuis
              la caisse, vous pouvez aussi utiliser{" "}
              <Link href="/pos/scan" className="font-semibold text-brand-ink underline">
                Scanner un QR
              </Link>
              .
            </p>
          )}
          <Link href="/" className="inline-block mt-6 text-xs tracking-[0.2em] uppercase text-brand-gold hover:text-brand-ink transition-colors">
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    );
  }

  // La cliente regle au salon : `paymentStatus` reste UNPAID et ne dit rien
  // de la validite du QR. Ce qui compte, c'est que la reservation tienne
  // toujours. Se fier au reglement rendait tout QR non validable.
  const active = data.booking.status !== "CANCELLED";

  return (
    <div className="min-h-screen bg-brand-cream flex items-center justify-center px-6">
      <div className="bg-white p-10 max-w-md w-full border border-brand-gold/20">
        <div className="text-center mb-6">
          <Logo />
        </div>

        <div className="text-center mb-6">
          <h1 className="luxury-heading text-xl text-brand-ink mb-1">
            {active
              ? data.verified
                ? "Client déjà vérifié"
                : "Réservation valide"
              : "Réservation annulée"}
          </h1>
          {data.verified && data.verifiedBy && (
            <p className="text-[10px] tracking-[0.15em] uppercase text-brand-ink-soft mt-1">
              Validé par {data.verifiedBy.displayName}
            </p>
          )}
          {data.verified && data.verifiedAt && (
            <p className="text-[10px] tracking-[0.15em] uppercase text-brand-ink-soft mt-0.5">
              {formatDateHeureComplete(data.verifiedAt)}
            </p>
          )}
        </div>

        <div className="luxury-divider my-6" />

        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-brand-ink-soft">Service</span>
            <span className="text-brand-ink font-medium">{data.booking.offerTitle}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-brand-ink-soft">Salon</span>
            <span className="text-brand-ink">{data.booking.salonName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-brand-ink-soft">Client</span>
            <span className="text-brand-ink">{data.booking.clientName || data.booking.clientEmail}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-brand-ink-soft">Date</span>
            <span className="text-brand-ink">
              {new Date(data.booking.bookedFor).toLocaleDateString("fr-TN", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-brand-ink-soft">À encaisser</span>
            <span className="luxury-heading text-xl text-brand-gold">
              {Number(data.booking.totalPrice).toFixed(0)} TND
            </span>
          </div>
        </div>

        {active && !data.verified && (
          <div className="mt-8">
            {sessionStatus === "loading" ? null : isSalonSession ? (
              <button
                type="button"
                onClick={handleConfirm}
                disabled={confirming}
                className="w-full rounded-2xl bg-brand-ink py-4 text-base font-semibold text-white hover:bg-brand-gold transition-colors disabled:opacity-50"
              >
                {confirming ? "Validation…" : "Confirmer l'arrivée"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => router.push(`/salon-pin?next=${encodeURIComponent(`/verification?code=${code}`)}`)}
                className="w-full rounded-2xl border border-brand-line py-4 text-base font-semibold text-brand-ink hover:border-brand-gold transition-colors"
              >
                S&apos;identifier au salon
              </button>
            )}
          </div>
        )}

        {/* Le chainon manquant : valider l'arrivee et encaisser etaient deux
            gestes sans lien. La caissiere validait ici, puis devait retrouver
            la cliente elle-meme dans l'agenda de la caisse. `/pos?bookingId=`
            remplit le panier tout seul — le meme mecanisme que le bouton
            « Encaisser » de l'agenda. */}
        {active && data.verified && isSalonSession && data.caisseDisponible && (
          <div className="mt-8">
            <a
              href={`/pos?bookingId=${data.booking.id}`}
              className="block w-full rounded-2xl bg-brand-ink py-4 text-center text-base font-semibold text-white hover:bg-brand-gold transition-colors"
            >
              Encaisser maintenant
            </a>
            <p className="mt-3 text-center text-xs text-brand-ink-soft">
              Le panier sera pré-rempli avec les prestations réservées.
            </p>
          </div>
        )}

        {/* Sans le module caisse, l'encaissement detaille n'existe pas — mais
            la visite compte quand meme dans les statistiques du salon. Le dire
            evite de laisser croire que la prestation s'est perdue. */}
        {active && data.verified && isSalonSession && !data.caisseDisponible && (
          <p className="mt-8 rounded-xl bg-brand-cream p-4 text-center text-sm leading-relaxed text-brand-ink-soft">
            Visite enregistrée. Le montant est compté dans les statistiques de
            votre salon — encaissez la cliente au comptoir.
          </p>
        )}
      </div>
    </div>
  );
}
