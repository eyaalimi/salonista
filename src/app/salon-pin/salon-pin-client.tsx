"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Logo } from "@/components/logo";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";

type Employee = {
  id: string;
  displayName: string;
  role: "OWNER" | "MANAGER" | "CASHIER" | "STYLIST";
  hasPin: boolean;
  avatarColor: string;
};

type ResolvedSalon = {
  providerId: string;
  salonName: string;
  employees: Employee[];
};

/**
 * Reponse du POST /resolve pour un appareil NEUF : le nom du salon et un
 * indice sur la boite qui vient de recevoir le code. Jamais la liste des
 * employes — c'est precisement ce que l'ancienne version livrait a un
 * inconnu.
 */
type AppairageDemande = {
  providerId: string;
  salonName: string;
  indiceEmail: string;
};

const ROLE_LABELS: Record<Employee["role"], string> = {
  OWNER: "Propriétaire",
  MANAGER: "Manager",
  CASHIER: "Caissier·ère",
  STYLIST: "Coiffeur·euse",
};

// Only accept path-only redirects. An attacker who plants a salon-pin link
// with `?next=https://evil/` must not be able to bounce a freshly-signed-in
// employee to an external site.
function sanitizeNext(raw: string | null): string {
  if (!raw) return "/pos";
  if (!raw.startsWith("/")) return "/pos";
  if (raw.startsWith("//")) return "/pos"; // protocol-relative
  if (raw.includes("://")) return "/pos";
  return raw;
}

export default function SalonPinClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = sanitizeNext(searchParams.get("next"));
  const [step, setStep] = useState<"identify" | "code" | "pin">("identify");
  const [identifier, setIdentifier] = useState("");
  const [salon, setSalon] = useState<ResolvedSalon | null>(null);
  // Appareil neuf : un code part vers la boite du proprietaire.
  const [appairage, setAppairage] = useState<AppairageDemande | null>(null);
  const [code, setCode] = useState("");
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/salon-pin/resolve", { method: "GET" });
        if (!cancelled && res.ok) {
          const data = await res.json();
          setSalon(data);
        }
      } catch {
        // pas de salon mémorisé — on tombe sur le flow email
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function forgetSalon() {
    try {
      await fetch("/api/salon-pin/resolve", { method: "DELETE" });
    } catch {
      // ignore
    }
    setSalon(null);
    setIdentifier("");
    setError(null);
  }

  const handleResolve = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setLoading(true);
      try {
        const res = await fetch("/api/salon-pin/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Salon introuvable");
          return;
        }
        // Appareil neuf : passer par le code recu par mail. Un appareil deja
        // appaire recoit directement ses tuiles.
        if (data.appairage === "code-envoye") {
          setAppairage(data);
          setCode("");
          setStep("code");
          return;
        }
        setSalon(data);
      } catch {
        setError("Erreur de connexion");
      } finally {
        setLoading(false);
      }
    },
    [identifier],
  );

  /** Valide le code d'appairage : l'appareil est alors autorise. */
  const handleAppairage = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!appairage) return;
      setError(null);
      setLoading(true);
      try {
        const res = await fetch("/api/salon-pin/resolve/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ providerId: appairage.providerId, code }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Code incorrect");
          return;
        }
        setSalon(data);
        setAppairage(null);
        setStep("identify");
      } catch {
        setError("Erreur de connexion");
      } finally {
        setLoading(false);
      }
    },
    [appairage, code],
  );

  const submitPin = useCallback(
    async (currentPin: string) => {
      if (!employee) return;
      if (currentPin.length < 4) return;
      setLoading(true);
      setError(null);
      try {
        const result = await signIn("salon-pin", {
          employeeId: employee.id,
          pin: currentPin,
          redirect: false,
        });
        if (result?.error) {
          setError("PIN incorrect");
          setPin("");
        } else if (result?.ok) {
          router.push(next);
        }
      } finally {
        setLoading(false);
      }
    },
    [employee, router, next],
  );

  function selectEmployee(emp: Employee) {
    if (!emp.hasPin) {
      // No PIN set yet — fall back to the email/password login. After
      // logging in the owner can set a PIN from their dashboard.
      router.push(`/login?callbackUrl=${encodeURIComponent(next)}`);
      return;
    }
    setEmployee(emp);
    setPin("");
    setError(null);
    setStep("pin");
  }

  function pressKey(k: string) {
    if (loading) return;
    if (k === "←") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (pin.length >= 4) return;
    const next = pin + k;
    setPin(next);
    // Auto-submit dès que 4 chiffres sont saisis — pas besoin de confirmer.
    if (next.length === 4) {
      submitPin(next);
    }
  }

  return (
    <div className="min-h-screen bg-brand-cream flex flex-col items-center justify-start py-10 px-4">
      <header className="mb-10">
        <Logo href="/" />
      </header>

      <PwaInstallPrompt />

      {bootstrapping && (
        <p className="text-sm text-brand-ink-soft">Chargement…</p>
      )}

      {step === "identify" && !bootstrapping && !salon && (
        <section className="w-full max-w-md rounded-3xl border border-brand-line bg-brand-sand p-10 shadow-sm">
          <p className="luxury-badge mb-3">Caisse</p>
          <h1 className="luxury-heading text-3xl text-brand-ink">Connexion salon</h1>
          <p className="mt-3 text-sm text-brand-ink-soft">
            Entrez l&apos;email ou le téléphone du propriétaire pour accéder à la caisse.
          </p>
          <form onSubmit={handleResolve} className="mt-8 space-y-4">
            <input
              type="text"
              autoFocus
              autoComplete="off"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="email@salon.tn ou +216 22 345 678"
              className="w-full rounded-xl border border-brand-line bg-white px-5 py-4 text-base text-brand-ink placeholder:text-brand-ink-soft focus:border-brand-gold focus:outline-none"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading || !identifier.trim()}
              className="w-full rounded-xl bg-brand-ink py-4 text-sm uppercase tracking-[0.18em] text-brand-cream hover:bg-brand-ink-soft disabled:opacity-50"
            >
              {loading ? "..." : "Continuer"}
            </button>
          </form>
        </section>
      )}

      {/* Appareil neuf : le code recu par mail prouve l'acces a la boite du
          proprietaire. Sans lui, un inconnu obtenait la liste des employes
          avec le seul email du salon. */}
      {step === "code" && appairage && (
        <section className="w-full max-w-md rounded-3xl border border-brand-line bg-brand-sand p-10 shadow-sm">
          <p className="luxury-badge mb-3">{appairage.salonName}</p>
          <h1 className="luxury-heading text-3xl text-brand-ink">
            Autoriser cet appareil
          </h1>
          <p className="mt-3 text-sm text-brand-ink-soft">
            Un code à 6 chiffres vient d&apos;être envoyé à{" "}
            <strong className="text-brand-ink">{appairage.indiceEmail}</strong>.
            Saisissez-le pour utiliser la caisse sur cet appareil.
          </p>
          <form onSubmit={handleAppairage} className="mt-8 space-y-4">
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="w-full rounded-xl border border-brand-line bg-white px-5 py-4 text-center text-2xl tracking-[0.4em] text-brand-ink placeholder:text-brand-ink-soft focus:border-brand-gold focus:outline-none"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full rounded-xl bg-brand-ink py-4 text-sm uppercase tracking-[0.18em] text-brand-cream hover:bg-brand-ink-soft disabled:opacity-50"
            >
              {loading ? "..." : "Autoriser"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAppairage(null);
                setCode("");
                setError(null);
                setStep("identify");
              }}
              className="w-full text-sm text-brand-ink-soft underline"
            >
              Changer de salon
            </button>
          </form>
          <p className="mt-6 text-xs leading-relaxed text-brand-ink-soft">
            Ce code expire dans 15 minutes. L&apos;appareil restera autorisé
            30 jours.
          </p>
        </section>
      )}

      {step === "identify" && salon && !bootstrapping && (
        <section className="mt-8 w-full max-w-2xl rounded-3xl border border-brand-line bg-brand-sand p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="luxury-badge mb-2">{salon.salonName}</p>
              <h2 className="luxury-heading text-2xl text-brand-ink">Sélectionnez votre profil pour commencer</h2>
            </div>
            <button
              type="button"
              onClick={forgetSalon}
              className="text-xs uppercase tracking-[0.18em] text-brand-ink-soft hover:text-brand-ink"
            >
              Changer de salon
            </button>
          </div>
          <ul className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
            {salon.employees.map((emp) => (
              <li key={emp.id}>
                <button
                  type="button"
                  onClick={() => selectEmployee(emp)}
                  className="group flex w-full flex-col items-center gap-3 rounded-2xl border border-brand-line bg-white p-5 text-center transition hover:border-brand-gold"
                >
                  <span
                    className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold text-brand-cream"
                    style={{ backgroundColor: emp.avatarColor }}
                  >
                    {emp.displayName.charAt(0).toUpperCase()}
                  </span>
                  <span className="luxury-heading text-lg text-brand-ink">{emp.displayName}</span>
                  <span className="text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft">
                    {ROLE_LABELS[emp.role]}
                  </span>
                  {!emp.hasPin && (
                    <span className="text-xs text-brand-ink-soft">Connexion par email</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {step === "pin" && employee && (
        <section className="w-full max-w-md rounded-3xl border border-brand-line bg-brand-sand p-10">
          <button
            type="button"
            onClick={() => {
              setStep("identify");
              setEmployee(null);
              setPin("");
              setError(null);
            }}
            className="mb-4 text-xs uppercase tracking-[0.18em] text-brand-ink-soft hover:text-brand-ink"
          >
            ← Retour
          </button>
          <p className="luxury-badge mb-2">{ROLE_LABELS[employee.role]}</p>
          <h1 className="luxury-heading text-3xl text-brand-ink">{employee.displayName}</h1>
          <p className="mt-2 text-sm text-brand-ink-soft">Entrez votre PIN pour continuer.</p>

          <div className="mt-8 flex justify-center gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <span
                key={i}
                className={`h-5 w-5 rounded-full border-2 transition ${
                  i < pin.length
                    ? "border-brand-gold bg-brand-gold scale-110"
                    : "border-brand-line bg-transparent"
                }`}
              />
            ))}
          </div>

          {error && <p className="mt-4 text-center text-sm text-red-600">{error}</p>}

          <div className="mt-8 grid grid-cols-3 gap-3">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "←"].map((k, i) =>
              k === "" ? (
                <span key={`empty-${i}`} aria-hidden="true" />
              ) : (
                <button
                  key={k}
                  type="button"
                  onClick={() => pressKey(k)}
                  disabled={loading}
                  className="aspect-square rounded-2xl border border-brand-line bg-white text-2xl font-semibold text-brand-ink hover:border-brand-gold disabled:opacity-40"
                  style={{ minHeight: 64 }}
                >
                  {k}
                </button>
              ),
            )}
          </div>
        </section>
      )}
    </div>
  );
}
