"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Logo } from "@/components/logo";

export default function StartClient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [salonName, setSalonName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ownerPin, setOwnerPin] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/pos/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          salonName: salonName.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Erreur lors de l'activation");
        return;
      }
      setOwnerPin(data.ownerPin);
      setEmployeeId(data.employeeId);
    } finally {
      setBusy(false);
    }
  }

  async function enterPos() {
    if (!employeeId || !ownerPin) return;
    setBusy(true);
    const result = await signIn("salon-pin", {
      employeeId,
      pin: ownerPin,
      redirect: false,
    });
    setBusy(false);
    if (result?.ok) {
      router.push("/pos/bienvenue");
    } else {
      setError("Impossible de se connecter automatiquement. Allez à /salon-pin.");
    }
  }

  // Success view — show the PIN once, then proceed.
  if (ownerPin && employeeId) {
    return (
      <div className="min-h-screen bg-brand-cream flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-3xl border border-brand-line p-8 text-center shadow-sm">
          <div className="mb-6">
            <Logo className="text-2xl" href={null} />
          </div>
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 text-2xl mb-4">
            ✓
          </div>
          <h1 className="luxury-heading text-2xl text-brand-ink mb-2">
            Votre caisse est prête !
          </h1>
          <p className="text-sm text-brand-ink-soft mb-6">
            Notez votre code PIN propriétaire — il vous permettra de revenir à
            la caisse à tout moment.
          </p>

          <div className="bg-brand-sand rounded-2xl p-6 mb-6">
            <div className="text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft mb-2">
              Votre PIN
            </div>
            <div className="text-5xl font-bold pos-mono tracking-[0.3em] text-brand-ink">
              {ownerPin}
            </div>
            <div className="text-[11px] text-brand-ink-soft mt-3">
              Conservez-le précieusement. Pas de SMS — c&apos;est le seul
              écran où il s&apos;affiche.
            </div>
          </div>

          {/* Sans cette mention, le salon ignore qu'un second acces existe et
              se croit perdu s'il oublie son PIN. */}
          <div className="bg-brand-cream rounded-2xl p-4 mb-6 text-left">
            <div className="text-[11px] text-brand-ink-soft leading-relaxed">
              Un e-mail vient de partir à{" "}
              <span className="font-semibold text-brand-ink">{email}</span>{" "}
              pour choisir votre mot de passe. Il vous permettra d&apos;ouvrir
              votre espace depuis n&apos;importe quel navigateur, même sans
              votre PIN.
            </div>
          </div>

          <button
            type="button"
            onClick={enterPos}
            disabled={busy}
            className="w-full py-4 rounded-xl bg-emerald-600 text-white text-base font-semibold hover:bg-emerald-700 disabled:opacity-50 shadow-md shadow-emerald-600/30"
          >
            {busy ? "Connexion…" : "Continuer la configuration →"}
          </button>
          {error && <p className="text-sm text-red-600 mt-4">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-cream flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-3xl border border-brand-line p-8 shadow-sm">
        <div className="mb-8 text-center">
          <Logo className="text-2xl" href={null} />
        </div>

        <p className="luxury-badge mb-3">Caisse · Gratuit</p>
        <h1 className="luxury-heading text-3xl text-brand-ink leading-tight">
          Démarrez votre caisse
          <br />
          en 5 minutes.
        </h1>
        <p className="mt-3 text-sm text-brand-ink-soft">
          Encaissez vos clientes, suivez votre stock, fidélisez votre clientèle.
          <strong className="text-brand-ink"> 100% gratuit, sans engagement.</strong>
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label
              htmlFor="salon-name"
              className="block text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft mb-1.5"
            >
              Nom de votre salon
            </label>
            <input
              id="salon-name"
              type="text"
              autoFocus
              value={salonName}
              onChange={(e) => setSalonName(e.target.value)}
              placeholder="Ex: Salon Fatma"
              className="w-full rounded-xl border border-brand-line bg-brand-cream/50 px-4 py-3 text-base text-brand-ink placeholder:text-brand-ink-soft/60 focus:border-brand-gold focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft mb-1.5"
            >
              Votre email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.tn"
              className="w-full rounded-xl border border-brand-line bg-brand-cream/50 px-4 py-3 text-base text-brand-ink placeholder:text-brand-ink-soft/60 focus:border-brand-gold focus:outline-none"
            />
            <p className="text-[11px] text-brand-ink-soft mt-1.5">
              Pour vous reconnecter depuis n&apos;importe quel appareil. Pas de
              mot de passe à retenir.
            </p>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !email.trim()}
            className="w-full py-4 rounded-xl bg-brand-ink text-white text-base font-semibold hover:bg-brand-ink-soft disabled:opacity-50"
          >
            {busy ? "Activation…" : "Activer ma caisse gratuite →"}
          </button>
        </form>

        <ul className="mt-8 space-y-2 text-xs text-brand-ink-soft">
          <li className="flex items-center gap-2">
            <span className="text-emerald-600">✓</span>
            Aucune carte bancaire requise
          </li>
          <li className="flex items-center gap-2">
            <span className="text-emerald-600">✓</span>
            Fonctionne hors ligne
          </li>
          <li className="flex items-center gap-2">
            <span className="text-emerald-600">✓</span>
            Sauvegarde automatique
          </li>
        </ul>
      </div>
    </div>
  );
}
