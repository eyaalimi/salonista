"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "already" | "error" | "expired">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Aucun token fourni");
      return;
    }

    fetch(`/api/verify-email?token=${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setStatus(data.alreadyVerified ? "already" : "success");
        } else if (res.status === 410) {
          setStatus("expired");
        } else {
          setStatus("error");
          setMessage(data.error || "Token invalide");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Erreur de connexion");
      });
  }, [token]);

  const icons = {
    loading: null,
    success: (
      <div className="w-16 h-16 mx-auto mb-6 border-2 border-emerald-500 flex items-center justify-center">
        <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    ),
    already: (
      <div className="w-16 h-16 mx-auto mb-6 border-2 border-blue-400 flex items-center justify-center">
        <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
        </svg>
      </div>
    ),
    expired: (
      <div className="w-16 h-16 mx-auto mb-6 border-2 border-amber-400 flex items-center justify-center">
        <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    ),
    error: (
      <div className="w-16 h-16 mx-auto mb-6 border-2 border-red-400 flex items-center justify-center">
        <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    ),
  };

  const titles = {
    loading: "Verification...",
    success: "Email verifie",
    already: "Deja verifie",
    expired: "Lien expire",
    error: "Erreur",
  };

  const descriptions = {
    loading: "",
    success: "Votre adresse email a ete verifiee. Vous pouvez maintenant vous connecter.",
    already: "Votre email est deja verifie. Connectez-vous pour continuer.",
    expired: "Ce lien de verification a expire. Reconnectez-vous pour recevoir un nouveau lien.",
    error: message || "Token invalide ou introuvable.",
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-brand-cream flex items-center justify-center">
        <p className="text-brand-bordeaux/40 text-xs tracking-[0.2em] uppercase">Verification...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-cream flex items-center justify-center px-6">
      <div className="bg-white p-12 max-w-md w-full text-center border border-brand-gold/20">
        <div className="mb-6">
          <Link href="/" className="luxury-heading text-xl text-brand-bordeaux">
            Beaute<span className="text-brand-gold">.</span>tn
          </Link>
        </div>

        {icons[status]}

        <h1 className="luxury-heading text-xl text-brand-bordeaux mb-2">{titles[status]}</h1>
        <p className="text-sm text-brand-bordeaux/50 mb-8">{descriptions[status]}</p>

        <Link
          href="/login"
          className="inline-block px-8 py-4 text-xs tracking-[0.2em] uppercase bg-brand-bordeaux text-white hover:bg-brand-gold transition-colors duration-500"
        >
          Se connecter
        </Link>
      </div>
    </div>
  );
}
