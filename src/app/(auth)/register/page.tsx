"use client";

import { signIn } from "next-auth/react";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/logo";

const roles = [
  {
    value: "CLIENT",
    label: "Cliente",
    description: "Je cherche des offres beauté",
  },
  {
    value: "PROVIDER",
    label: "Prestataire",
    description: "Je propose des services beauté",
  },
  {
    value: "INFLUENCER",
    label: "Influenceuse",
    description: "Je partage des bons plans beauté",
  },
];

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-brand-cream" />}>
      <RegisterPageInner />
    </Suspense>
  );
}

function RegisterPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name, phone, role, instagramHandle }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        setLoading(false);
        return;
      }

      if (data.needsVerification) {
        setNeedsVerification(true);
        setLoading(false);
        return;
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        const dest = callbackUrl ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/login";
        router.push(dest);
      } else {
        router.push(callbackUrl || "/api/auth/redirect");
        router.refresh();
      }
    } catch {
      setError("Une erreur est survenue");
      setLoading(false);
    }
  }

  if (needsVerification) {
    return (
      <div className="min-h-screen bg-brand-cream flex items-center justify-center px-6">
        <div className="bg-white p-12 max-w-md w-full text-center border border-brand-gold/20">
          <div className="w-16 h-16 mx-auto mb-6 border-2 border-brand-gold flex items-center justify-center">
            <svg className="w-8 h-8 text-brand-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="luxury-heading text-2xl text-brand-bordeaux mb-3">Verifiez votre email</h2>
          <p className="text-sm text-brand-bordeaux/50 leading-relaxed mb-2">
            Un email de verification a ete envoye a
          </p>
          <p className="text-sm text-brand-bordeaux font-medium mb-6">{email}</p>
          <p className="text-xs text-brand-bordeaux/40 mb-8">
            Cliquez sur le lien dans l&apos;email pour activer votre compte. Le lien expire dans 24 heures.
          </p>
          <Link
            href={callbackUrl ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/login"}
            className="inline-block px-8 py-4 text-xs tracking-[0.2em] uppercase bg-brand-bordeaux text-white hover:bg-brand-gold transition-colors duration-500"
          >
            Aller a la connexion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-brand-cream">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-ink to-brand-ink/90 items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-1/3 right-1/4 w-96 h-96 rounded-full bg-brand-gold blur-3xl" />
          <div className="absolute bottom-1/3 left-1/4 w-64 h-64 rounded-full bg-brand-gold-soft blur-3xl" />
        </div>
        <div className="relative text-center px-12">
          <Logo tone="light" className="text-5xl mb-4" href={null} />
          <div className="luxury-divider !bg-brand-gold/50 mt-6 mb-6" />
          <p className="text-white/50 text-sm tracking-wider max-w-sm mx-auto">
            Rejoignez la marketplace beauté en Tunisie
          </p>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-10 text-center">
            <Logo className="text-2xl" href={null} />
          </div>

          <p className="luxury-badge mb-6">Nouveau compte</p>
          <h1 className="luxury-heading text-3xl text-brand-bordeaux mb-2">Inscription</h1>
          <p className="text-sm text-brand-bordeaux/40 mb-10">
            {step === 1 ? "Choisissez votre profil" : "Créez votre compte"}
          </p>

          {error && (
            <div className="mb-6 p-3 text-sm text-red-600 bg-red-50 border border-red-100">
              {error}
            </div>
          )}

          {step === 1 ? (
            <div className="space-y-3">
              {roles.map((r) => (
                <button
                  key={r.value}
                  onClick={() => {
                    setRole(r.value);
                    setStep(2);
                  }}
                  className="w-full p-5 border border-brand-gold/20 text-left hover:border-brand-gold transition-all duration-500 group"
                >
                  <p className="text-sm font-medium text-brand-bordeaux group-hover:text-brand-gold transition-colors duration-500">
                    {r.label}
                  </p>
                  <p className="text-xs text-brand-bordeaux/40 mt-1">{r.description}</p>
                </button>
              ))}

              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-brand-gold/15" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-brand-cream px-4 text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/30">ou</span>
                </div>
              </div>

              <button
                onClick={() => signIn("google", { callbackUrl: "/api/auth/redirect" })}
                className="w-full py-3.5 border border-brand-gold/20 text-brand-bordeaux text-xs tracking-[0.15em] uppercase hover:border-brand-gold transition-colors duration-500 flex items-center justify-center gap-3"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continuer avec Google
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="p-4 border border-brand-gold/20 flex items-center justify-between mb-2">
                <span className="text-xs text-brand-bordeaux/60">
                  Profil : <strong className="text-brand-bordeaux">{roles.find((r) => r.value === role)?.label}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-[10px] tracking-[0.15em] uppercase text-brand-gold hover:text-brand-bordeaux transition-colors"
                >
                  Changer
                </button>
              </div>

              <div>
                <label htmlFor="name" className="block text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/60 mb-2">
                  Nom complet
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-brand-gold/20 bg-transparent text-brand-bordeaux text-sm placeholder:text-brand-bordeaux/30 focus:outline-none focus:border-brand-gold transition-colors"
                  placeholder="Votre nom"
                />
              </div>

              <div>
                <label htmlFor="reg-email" className="block text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/60 mb-2">
                  Email
                </label>
                <input
                  id="reg-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-brand-gold/20 bg-transparent text-brand-bordeaux text-sm placeholder:text-brand-bordeaux/30 focus:outline-none focus:border-brand-gold transition-colors"
                  placeholder="votre@email.com"
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/60 mb-2">
                  Téléphone <span className="text-brand-bordeaux/30">(optionnel)</span>
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3 border border-brand-gold/20 bg-transparent text-brand-bordeaux text-sm placeholder:text-brand-bordeaux/30 focus:outline-none focus:border-brand-gold transition-colors"
                  placeholder="+216 XX XXX XXX"
                />
              </div>

              {role === "INFLUENCER" && (
                <div>
                  <label htmlFor="instagram" className="block text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/60 mb-2">
                    Pseudo Instagram
                  </label>
                  <input
                    id="instagram"
                    type="text"
                    value={instagramHandle}
                    onChange={(e) => setInstagramHandle(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-brand-gold/20 bg-transparent text-brand-bordeaux text-sm placeholder:text-brand-bordeaux/30 focus:outline-none focus:border-brand-gold transition-colors"
                    placeholder="@votrepseudo"
                  />
                </div>
              )}

              <div>
                <label htmlFor="reg-password" className="block text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/60 mb-2">
                  Mot de passe
                </label>
                <input
                  id="reg-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-4 py-3 border border-brand-gold/20 bg-transparent text-brand-bordeaux text-sm placeholder:text-brand-bordeaux/30 focus:outline-none focus:border-brand-gold transition-colors"
                  placeholder="Min. 8 caractères"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 text-xs tracking-[0.2em] uppercase bg-brand-bordeaux text-white hover:bg-brand-gold transition-colors duration-500 disabled:opacity-50"
              >
                {loading ? "Création..." : "Créer mon compte"}
              </button>
            </form>
          )}

          <p className="text-center text-xs text-brand-bordeaux/40 mt-8 tracking-wider">
            Déjà un compte ?{" "}
            <Link href="/login" className="text-brand-gold hover:text-brand-bordeaux transition-colors duration-300">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
