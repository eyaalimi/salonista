"use client";

import { signIn } from "next-auth/react";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

export default function RegisterClient() {
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
  // Le role venant de l'URL est valide plus bas ; on saute l'etape 1 quand il
  // l'est, sinon l'onglet de la page de connexion menait a un ecran ou il
  // fallait re-cliquer le profil deja choisi. Le bouton « Changer » de
  // l'etape 2 permet de revenir en arriere.
  const roleFromUrl = searchParams.get("role");
  const validRoleFromUrl =
    roleFromUrl === "CLIENT" || roleFromUrl === "PROVIDER" || roleFromUrl === "INFLUENCER"
      ? roleFromUrl
      : "";
  const [step, setStep] = useState<1 | 2>(validRoleFromUrl ? 2 : 1);
  // Pre-selection depuis /register?role=… (les onglets de la page de
  // connexion). Une valeur inconnue est ignoree : on retombe sur le
  // comportement actuel, l'utilisateur choisit lui-meme.
  const [role, setRole] = useState(validRoleFromUrl);
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
      <div className="min-h-screen bg-creme flex flex-col items-center justify-center px-5 py-10 gap-8">
        <Link href="/" className="ds-display text-4xl text-prune">
          Salonista<span className="text-rose">.</span>
        </Link>

        <div className="w-full max-w-[420px] rounded-[var(--radius-card)] bg-white p-6 sm:p-8 flex flex-col gap-5 text-center">
          <h2 className="ds-display text-2xl text-prune">Vérifie ton e-mail</h2>

          <div className="flex flex-col gap-1">
            <p className="text-base text-prune-soft">Un e-mail a été envoyé à</p>
            <p className="text-base font-semibold text-prune">{email}</p>
          </div>

          <p className="text-sm text-prune-soft">
            Clique sur le lien pour activer ton compte. Il expire dans 24 heures.
          </p>

          <Link
            href={callbackUrl ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/login"}
            className="ds-press ds-focus inline-flex items-center justify-center min-h-[48px] px-6 rounded-[var(--radius-pill)] bg-rose text-white text-base font-semibold hover:bg-[#F04A79]"
          >
            Aller à la connexion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-creme flex flex-col items-center justify-center px-5 py-10 gap-8">
      <div className="flex flex-col items-center gap-3">
        <Link href="/" className="ds-display text-4xl text-prune">
          Salonista<span className="text-rose">.</span>
        </Link>
        <p className="text-base text-prune-soft">
          {step === 1 ? "Choisis ton profil." : "Crée ton compte."}
        </p>
      </div>

      <div className="w-full max-w-[420px] rounded-[var(--radius-card)] bg-white p-6 sm:p-8 flex flex-col gap-6">
        {error && (
          <p
            role="alert"
            className="rounded-[var(--radius-panel)] bg-rose-soft px-4 py-3 text-sm text-prune"
          >
            {error}
          </p>
        )}

          {step === 1 ? (
            <div className="flex flex-col gap-3">
              {roles.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => {
                    setRole(r.value);
                    setStep(2);
                  }}
                  className="ds-press ds-focus w-full text-left p-5 rounded-[var(--radius-card)] border-2 border-hairline bg-white hover:border-rose"
                >
                  <p className="text-base font-semibold text-prune">{r.label}</p>
                  <p className="text-sm text-prune-soft mt-1">{r.description}</p>
                </button>
              ))}

              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-hairline" />
                <span className="text-sm text-prune-soft">ou</span>
                <span className="h-px flex-1 bg-hairline" />
              </div>

              <Button
                type="button"
                variant="ghost"
                fullWidth
                onClick={() => signIn("google", { callbackUrl: "/api/auth/redirect" })}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continuer avec Google
              </Button>
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
      </div>

      <p className="text-center text-xs text-brand-bordeaux/40 mt-8 tracking-wider">
        Déjà un compte ?{" "}
        <Link href="/login" className="text-brand-gold hover:text-brand-bordeaux transition-colors duration-300">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
