"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/logo";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-brand-cream" />}>
      <ResetPasswordInner />
    </Suspense>
  );
}

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }
    if (password.length < 6) {
      setError("Mot de passe trop court (min. 6 caractères)");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur");
      }
      setDone(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-cream px-6">
        <div className="text-center max-w-sm">
          <div className="text-center mb-10">
            <Logo className="text-2xl" />
          </div>
          <h1 className="luxury-heading text-2xl text-brand-ink mb-3">Lien invalide</h1>
          <p className="text-sm text-brand-ink-soft mb-8">
            Ce lien de réinitialisation est invalide ou incomplet.
          </p>
          <Link
            href="/forgot-password"
            className="inline-block px-8 py-3 text-xs tracking-[0.2em] uppercase bg-brand-ink text-white hover:bg-brand-gold transition-colors"
          >
            Demander un nouveau lien
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-cream px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <Logo className="text-2xl" />
        </div>

        {done ? (
          <div className="text-center">
            <div className="w-14 h-14 border border-brand-gold/30 flex items-center justify-center mx-auto mb-6">
              <svg className="w-6 h-6 text-brand-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="luxury-heading text-2xl text-brand-ink mb-3">Mot de passe modifié</h1>
            <p className="text-sm text-brand-ink-soft mb-2">
              Redirection vers la connexion…
            </p>
          </div>
        ) : (
          <>
            <p className="luxury-badge mb-6">Nouveau mot de passe</p>
            <h1 className="luxury-heading text-3xl text-brand-ink mb-2">Choisir un mot de passe</h1>
            <p className="text-sm text-brand-ink-soft mb-10">
              Au moins 6 caractères.
            </p>

            {error && (
              <div className="mb-6 p-3 text-sm text-red-600 bg-red-50 border border-red-100">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="password" className="block text-[10px] tracking-[0.15em] uppercase text-brand-ink-soft mb-2">
                  Nouveau mot de passe
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="w-full px-4 py-3 border border-brand-line bg-white text-brand-ink text-sm focus:outline-none focus:border-brand-gold transition-colors"
                />
              </div>
              <div>
                <label htmlFor="confirm" className="block text-[10px] tracking-[0.15em] uppercase text-brand-ink-soft mb-2">
                  Confirmer
                </label>
                <input
                  id="confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="w-full px-4 py-3 border border-brand-line bg-white text-brand-ink text-sm focus:outline-none focus:border-brand-gold transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 text-xs tracking-[0.2em] uppercase bg-brand-ink text-white hover:bg-brand-gold transition-colors duration-300 disabled:opacity-50"
              >
                {loading ? "Modification…" : "Modifier le mot de passe"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
