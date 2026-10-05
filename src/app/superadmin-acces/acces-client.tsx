"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Etape = "chargement" | "enroler" | "valider";

/**
 * Enrolement et validation de la double authentification du superadmin.
 *
 * Deux usages pour un seul ecran :
 *   - PREMIER ACCES : le compte n'a pas de secret, on affiche le QR a scanner
 *     puis on demande un premier code pour prouver qu'il est bien enregistre ;
 *   - ACCES COURANT : le secret existe, on demande simplement le code — a la
 *     connexion, et toutes les 30 minutes quand la fraicheur expire.
 *
 * Le jeton est date via `update({ totpValideeA })` : c'est le seul moyen
 * d'ecrire dans un JWT NextAuth deja emis. La route a deja valide le code
 * cote serveur ; cet appel ne fait que reporter l'horodatage qu'elle a rendu.
 */
export function AccesClient({ dejaEnrole }: { dejaEnrole: boolean }) {
  const router = useRouter();
  const { update } = useSession();
  const [etape, setEtape] = useState<Etape>(dejaEnrole ? "valider" : "chargement");
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Premier acces : on demande le QR des l'affichage.
  useEffect(() => {
    if (dejaEnrole) return;
    let annule = false;
    (async () => {
      const res = await fetch("/api/superadmin/totp/enroll", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (annule) return;
      if (!res.ok) {
        setErreur(data?.error ?? "Impossible de démarrer l'enrôlement.");
        setEtape("valider");
        return;
      }
      setQr(data.qr);
      setSecret(data.secret);
      setEtape("enroler");
    })();
    return () => {
      annule = true;
    };
  }, [dejaEnrole]);

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErreur(null);

    // L'enrolement confirme le secret ; ensuite on ne fait que valider.
    const url =
      etape === "enroler"
        ? "/api/superadmin/totp/confirm"
        : "/api/superadmin/totp/verify";

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      setErreur(data?.error ?? "Code incorrect");
      setCode("");
      setBusy(false);
      return;
    }

    // Date la session, puis entre. `router.refresh()` force le layout serveur
    // a relire le jeton mis a jour.
    await update({ totpValideeA: data.totpValideeA });
    router.replace("/superadmin");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-creme flex flex-col items-center justify-center gap-8 px-5 py-10">
      <div className="flex flex-col items-center gap-2">
        <span className="ds-display text-3xl text-prune">
          Salonista<span className="text-rose-fonce">.</span>
        </span>
        <span className="rounded-[var(--radius-pill)] bg-prune px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-creme">
          Superadmin
        </span>
      </div>

      <div className="w-full max-w-[420px] rounded-[var(--radius-card)] bg-white p-6 sm:p-8 flex flex-col gap-6">
        {etape === "chargement" && (
          <p className="text-sm text-prune-soft">Préparation de l&apos;enrôlement…</p>
        )}

        {etape === "enroler" && (
          <>
            <div className="flex flex-col gap-2">
              <h1 className="ds-display text-xl text-prune">
                Activer la double authentification
              </h1>
              <p className="text-sm text-prune-soft">
                Scanne ce QR avec Google Authenticator, Authy ou 1Password, puis
                saisis le code affiché.
              </p>
            </div>
            {qr && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={qr}
                alt="QR code d'enrôlement de la double authentification"
                className="mx-auto h-[220px] w-[220px] rounded-[var(--radius-panel)] border border-hairline"
              />
            )}
            {secret && (
              <details className="text-xs text-prune-soft">
                <summary className="cursor-pointer font-semibold">
                  Le QR ne se lit pas ?
                </summary>
                <p className="mt-2">
                  Saisis cette clé à la main dans ton application :
                </p>
                <code className="mt-1 block break-all rounded-[var(--radius-panel)] bg-creme px-3 py-2 font-mono text-[11px] text-prune">
                  {secret}
                </code>
              </details>
            )}
          </>
        )}

        {etape === "valider" && (
          <div className="flex flex-col gap-2">
            <h1 className="ds-display text-xl text-prune">Code de vérification</h1>
            <p className="text-sm text-prune-soft">
              Saisis le code à 6 chiffres de ton application
              d&apos;authentification.
            </p>
          </div>
        )}

        {erreur && (
          <p
            role="alert"
            className="rounded-[var(--radius-panel)] bg-rose-soft px-4 py-3 text-sm text-prune"
          >
            {erreur}
          </p>
        )}

        {etape !== "chargement" && (
          <form onSubmit={soumettre} className="flex flex-col gap-5">
            <Input
              id="code"
              label="Code à 6 chiffres"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
            />
            <Button type="submit" fullWidth disabled={busy || code.length !== 6}>
              {busy ? "Vérification…" : "Valider"}
            </Button>
          </form>
        )}
      </div>

      <p className="max-w-[420px] text-center text-xs text-prune-soft">
        Téléphone perdu ? La réinitialisation passe par le serveur :
        <code className="mx-1 font-mono">scripts/superadmin.ts reset-totp</code>
      </p>
    </div>
  );
}
