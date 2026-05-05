"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur");
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-cream px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <Logo className="text-2xl" />
        </div>

        {sent ? (
          <div className="text-center">
            <div className="w-14 h-14 border border-brand-gold/30 flex items-center justify-center mx-auto mb-6">
              <svg className="w-6 h-6 text-brand-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="luxury-heading text-2xl text-brand-ink mb-3">Email envoyé</h1>
            <p className="text-sm text-brand-ink-soft mb-8 leading-relaxed">
              Si un compte existe pour <strong>{email}</strong>, vous recevrez un email avec un lien
              pour réinitialiser votre mot de passe.
            </p>
            <Link
              href="/login"
              className="inline-block px-8 py-3 text-xs tracking-[0.2em] uppercase border border-brand-line text-brand-ink hover:border-brand-gold transition-colors"
            >
              Retour à la connexion
            </Link>
          </div>
        ) : (
          <>
            <p className="luxury-badge mb-6">Mot de passe oublié</p>
            <h1 className="luxury-heading text-3xl text-brand-ink mb-2">Réinitialisation</h1>
            <p className="text-sm text-brand-ink-soft mb-10">
              Entrez votre email et nous vous enverrons un lien pour choisir un nouveau mot de passe.
            </p>

            {error && (
              <div className="mb-6 p-3 text-sm text-red-600 bg-red-50 border border-red-100">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-[10px] tracking-[0.15em] uppercase text-brand-ink-soft mb-2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full px-4 py-3 border border-brand-line bg-white text-brand-ink text-sm focus:outline-none focus:border-brand-gold transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 text-xs tracking-[0.2em] uppercase bg-brand-ink text-white hover:bg-brand-gold transition-colors duration-300 disabled:opacity-50"
              >
                {loading ? "Envoi…" : "Envoyer le lien"}
              </button>
            </form>

            <p className="mt-8 text-center text-xs tracking-[0.15em] uppercase text-brand-ink-soft">
              <Link href="/login" className="hover:text-brand-gold transition-colors">
                ← Retour à la connexion
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
