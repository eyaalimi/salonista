"use client";

/**
 * Scanner le QR d'une cliente depuis la caisse.
 *
 * Utilise `BarcodeDetector`, une API native du navigateur : aucune
 * bibliotheque n'est ajoutee au projet. Son support est inegal — Chrome et
 * Edge sur Android la fournissent, Safari sur iOS non a ce jour. D'ou le
 * repli explicite : quand elle manque, on dit quoi faire au lieu d'afficher
 * un ecran mort. L'appareil photo natif du telephone lit le meme QR, puisque
 * celui-ci contient une URL.
 *
 * Le scan n'ecrit rien : il ouvre `/verification?code=…`, ou la caissiere
 * confirme l'arrivee. Un seul chemin de validation, une seule page a
 * maintenir.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { extraireCodeReservation } from "@/lib/qr-code-reservation";

/**
 * `BarcodeDetector` n'est pas dans les types de TypeScript. On declare le
 * strict minimum dont on se sert, plutot que d'ajouter un paquet de types.
 */
type CodeDetecte = { rawValue: string };
type DetecteurCodes = { detect(source: HTMLVideoElement): Promise<CodeDetecte[]> };
type ConstructeurDetecteur = new (options: { formats: string[] }) => DetecteurCodes;

function detecteurDisponible(): ConstructeurDetecteur | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { BarcodeDetector?: ConstructeurDetecteur };
  return w.BarcodeDetector ?? null;
}

/** Camera ET lecture de QR : les deux sont necessaires pour scanner. */
function scanPossible(): boolean {
  return (
    detecteurDisponible() !== null &&
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}

type Etat =
  | { nom: "demarrage" }
  | { nom: "scan" }
  | { nom: "non-supporte" }
  | { nom: "refus" }
  | { nom: "erreur"; message: string };

export function ScanClient() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // Le support du navigateur ne change pas en cours de route : on le tranche
  // au premier rendu plutot que dans l'effet, ce qui evite un aller-retour
  // « demarrage » -> « non-supporte » visible a l'ecran.
  const [etat, setEtat] = useState<Etat>(() =>
    scanPossible() ? { nom: "demarrage" } : { nom: "non-supporte" },
  );
  const [inconnu, setInconnu] = useState(false);

  // Un scan reussi peut arriver plusieurs fois avant que la navigation
  // n'aboutisse : sans ce garde, on empile les `router.push`.
  const trouve = useRef(false);

  const [saisie, setSaisie] = useState("");

  const ouvrirVerification = useCallback(
    (code: string) => {
      if (trouve.current) return;
      trouve.current = true;
      router.push(`/verification?code=${encodeURIComponent(code)}`);
    },
    [router],
  );

  useEffect(() => {
    // Deja tranche a l'initialisation de `etat` : ici on ne fait que sortir.
    const Detecteur = detecteurDisponible();
    if (!Detecteur || !scanPossible()) return;

    let flux: MediaStream | null = null;
    let timer: number | null = null;
    let arrete = false;

    // Passe en parametre : dans une fonction asynchrone, TypeScript perd
    // l'affinement fait plus haut sur la variable capturee.
    async function demarrer(Detecteur: ConstructeurDetecteur) {
      try {
        flux = await navigator.mediaDevices.getUserMedia({
          // `environment` : la camera arriere, celle qu'on pointe vers le
          // telephone de la cliente.
          video: { facingMode: "environment" },
        });
      } catch (e) {
        // Le refus de permission est un cas normal, pas une panne.
        const nom = e instanceof DOMException ? e.name : "";
        setEtat(
          nom === "NotAllowedError" || nom === "SecurityError"
            ? { nom: "refus" }
            : { nom: "erreur", message: "Impossible d'ouvrir la caméra." },
        );
        return;
      }

      if (arrete) {
        flux.getTracks().forEach((t) => t.stop());
        return;
      }

      const video = videoRef.current;
      if (!video) return;
      video.srcObject = flux;
      await video.play().catch(() => undefined);
      setEtat({ nom: "scan" });

      const detecteur = new Detecteur({ formats: ["qr_code"] });

      const lire = async () => {
        if (arrete || trouve.current || !videoRef.current) return;
        try {
          const codes = await detecteur.detect(videoRef.current);
          for (const c of codes) {
            const code = extraireCodeReservation(c.rawValue);
            if (code) {
              ouvrirVerification(code);
              return;
            }
          }
          // Un QR lu mais etranger a Salonista : on le signale sans arreter
          // le scan, la caissiere vise peut-etre le mauvais ecran.
          if (codes.length > 0) setInconnu(true);
        } catch {
          // Une image illisible n'est pas une erreur : on retentera.
        }
        timer = window.setTimeout(lire, 400);
      };

      lire();
    }

    demarrer(Detecteur);

    return () => {
      arrete = true;
      if (timer !== null) window.clearTimeout(timer);
      flux?.getTracks().forEach((t) => t.stop());
    };
  }, [ouvrirVerification]);

  function validerSaisie(e: React.FormEvent) {
    e.preventDefault();
    const code = extraireCodeReservation(saisie);
    if (code) {
      ouvrirVerification(code);
    } else {
      setEtat({
        nom: "erreur",
        message: "Ce code ne correspond à aucune réservation.",
      });
    }
  }

  return (
    <div className="mx-auto max-w-lg p-4">
      <h1 className="mb-1 text-lg font-semibold text-pos-ink">Scanner un QR code</h1>
      <p className="mb-4 text-sm text-pos-ink-3">
        Visez le QR code de la cliente. La validation s&apos;ouvre toute seule.
      </p>

      {etat.nom === "scan" || etat.nom === "demarrage" ? (
        <div className="overflow-hidden rounded-xl border border-pos-border bg-black">
          <video
            ref={videoRef}
            className="aspect-square w-full object-cover"
            muted
            playsInline
          />
        </div>
      ) : null}

      {etat.nom === "demarrage" && (
        <p className="mt-3 text-sm text-pos-ink-3">Ouverture de la caméra…</p>
      )}

      {inconnu && etat.nom === "scan" && (
        <p className="mt-3 rounded-lg bg-pos-highlight px-3 py-2 text-sm text-pos-ink-2">
          Ce QR code n&apos;est pas une réservation Salonista.
        </p>
      )}

      {etat.nom === "non-supporte" && (
        <div className="rounded-xl border border-pos-border bg-pos-bg p-4">
          <p className="text-sm text-pos-ink-2">
            Ce navigateur ne sait pas ouvrir la caméra pour lire un QR code.
          </p>
          <p className="mt-2 text-sm text-pos-ink-3">
            Visez le QR code avec l&apos;appareil photo de votre téléphone : le
            lien s&apos;ouvre tout seul. Vous pouvez aussi saisir le code
            ci-dessous.
          </p>
        </div>
      )}

      {etat.nom === "refus" && (
        <div className="rounded-xl border border-pos-border bg-pos-bg p-4">
          <p className="text-sm text-pos-ink-2">Accès à la caméra refusé.</p>
          <p className="mt-2 text-sm text-pos-ink-3">
            Autorisez la caméra dans les réglages du navigateur, ou saisissez le
            code ci-dessous.
          </p>
        </div>
      )}

      {etat.nom === "erreur" && (
        <div className="rounded-xl border border-pos-border bg-pos-danger-soft p-4">
          <p className="text-sm text-pos-danger">{etat.message}</p>
        </div>
      )}

      {/* La saisie manuelle reste toujours disponible : une camera sale, un
          ecran fissure ou une cliente sans batterie ne doivent pas bloquer la
          validation. Le code est imprime sous le QR dans le mail. */}
      <form onSubmit={validerSaisie} className="mt-6">
        <label
          htmlFor="code-manuel"
          className="mb-1 block text-xs uppercase tracking-wider text-pos-ink-3"
        >
          Ou saisir le code
        </label>
        <div className="flex gap-2">
          <input
            id="code-manuel"
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            placeholder="BT-…"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="min-h-[48px] flex-1 rounded-lg border border-pos-border bg-white px-3 text-base text-pos-ink"
          />
          <button
            type="submit"
            disabled={!saisie.trim()}
            className="min-h-[48px] rounded-lg bg-pos-ink px-4 text-sm font-semibold text-pos-bg disabled:opacity-50"
          >
            Valider
          </button>
        </div>
      </form>

      <Link
        href="/pos/calendar"
        className="mt-6 inline-block text-sm text-pos-ink-3 underline"
      >
        Retour à l&apos;agenda
      </Link>
    </div>
  );
}
