"use client";

import { signIn } from "next-auth/react";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RoleTabs, ROLE_OPTIONS, type RoleKey } from "@/components/ui/role-tabs";

export default function LoginClient() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-creme" />}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/api/auth/redirect";
  const [role, setRole] = useState<RoleKey>("CLIENT");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const current = ROLE_OPTIONS.find((o) => o.key === role) ?? ROLE_OPTIONS[0];

  // Inchange : signIn ne prend aucun role, la redirection se fait apres coup
  // selon session.user.role.
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });

    setLoading(false);

    if (result?.error) {
      setError("Email ou mot de passe incorrect");
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-creme flex flex-col items-center justify-center px-5 py-10 gap-8">
      <div className="flex flex-col items-center gap-3">
        <Link href="/" className="ds-display text-4xl text-prune">
          Salonista<span className="text-rose">.</span>
        </Link>
        <p className="text-base text-prune-soft">{current.tagline}</p>
      </div>

      <div className="w-full max-w-[420px] rounded-[var(--radius-card)] bg-white p-6 sm:p-8 flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-prune-soft">
            Je suis
          </span>
          <RoleTabs value={role} onChange={setRole} />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-[var(--radius-panel)] bg-rose-soft px-4 py-3 text-sm text-prune"
          >
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Input
            id="email"
            label="E-mail"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="toi@exemple.com"
          />

          <Input
            id="password"
            label="Mot de passe"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={
                  showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"
                }
                className="ds-focus text-sm font-semibold text-prune-soft px-2 py-1 rounded-[var(--radius-pill)]"
              >
                {showPassword ? "Masquer" : "Voir"}
              </button>
            }
          />

          <Button type="submit" fullWidth disabled={loading}>
            {loading ? "Connexion…" : "Se connecter"}
          </Button>
        </form>

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-hairline" />
          <span className="text-sm text-prune-soft">ou</span>
          <span className="h-px flex-1 bg-hairline" />
        </div>

        <Button
          type="button"
          variant="ghost"
          fullWidth
          onClick={() => signIn("google", { callbackUrl })}
        >
          Continuer avec Google
        </Button>
      </div>

      <div className="flex flex-col items-center gap-2 text-sm">
        <Link href="/forgot-password" className="text-prune-soft underline underline-offset-4">
          Mot de passe oublié ?
        </Link>
        <p className="text-prune-soft">
          Pas encore de compte ?{" "}
          <Link href={current.registerHref} className="font-semibold text-rose">
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  );
}
