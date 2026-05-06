"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "pwa_install_dismissed_until";
const DISMISS_DAYS = 30;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIosUa = /iPad|iPhone|iPod/.test(ua);
  const isStandalone =
    "standalone" in navigator && (navigator as unknown as { standalone?: boolean }).standalone;
  return isIosUa && !isStandalone;
}

function dismissedRecently(): boolean {
  try {
    const until = Number(localStorage.getItem(DISMISS_KEY) ?? "0");
    return Date.now() < until;
  } catch {
    return false;
  }
}

export function PwaInstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState<boolean | null>(null);

  useEffect(() => {
    if (dismissedRecently()) {
      setHidden(true);
      return;
    }
    setHidden(!isIos());

    const handler = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const showIos = hidden === false && !event && isIos();

  function dismiss() {
    try {
      const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
      localStorage.setItem(DISMISS_KEY, String(until));
    } catch {
      // ignore
    }
    setHidden(true);
  }

  async function install() {
    if (!event) return;
    await event.prompt();
    await event.userChoice;
    setEvent(null);
    setHidden(true);
  }

  if (hidden !== false) return null;

  return (
    <div className="mb-6 w-full max-w-md rounded-2xl border border-brand-line bg-white p-5">
      {showIos ? (
        <>
          <p className="text-sm text-brand-ink">
            Pour installer : appuyez sur l&apos;icône de partage puis « Sur l&apos;écran
            d&apos;accueil ».
          </p>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={dismiss}
              className="text-xs uppercase tracking-[0.18em] text-brand-ink-soft hover:text-brand-ink"
            >
              Fermer
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="luxury-heading text-base text-brand-ink">
            Ajouter Salonista à l&apos;écran d&apos;accueil
          </p>
          <p className="mt-1 text-sm text-brand-ink-soft">Accès rapide au POS.</p>
          <div className="mt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={dismiss}
              className="text-xs uppercase tracking-[0.18em] text-brand-ink-soft hover:text-brand-ink"
            >
              Plus tard
            </button>
            <button
              type="button"
              onClick={install}
              className="rounded-lg bg-brand-ink px-4 py-2 text-xs uppercase tracking-[0.18em] text-brand-cream hover:bg-brand-ink-soft"
            >
              Installer
            </button>
          </div>
        </>
      )}
    </div>
  );
}
