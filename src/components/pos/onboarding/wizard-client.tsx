"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Step1Info } from "./step1-info";
import { Step2Services } from "./step2-services";
import { Step3Products } from "./step3-products";
import { Step4Team } from "./step4-team";
import { Step5Drawer } from "./step5-drawer";
import { Step6Done } from "./step6-done";

type Provider = {
  id: string;
  salonName: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  matriculeFiscal: string | null;
  receiptFooter: string | null;
  onboardingDismissedAt: Date | null;
  _count: {
    offers: number;
    products: number;
    employees: number;
    sales: number;
    cashDrawerSessions: number;
  };
};

const STEPS = [
  "Infos salon",
  "Services",
  "Produits",
  "Équipe",
  "Tiroir & ticket",
  "Terminé",
];

function localStorageGetSafe(key: string): string | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(key); } catch { return null; }
}

export function WizardClient({
  initialProvider,
  employeeId,
}: {
  initialProvider: Provider;
  employeeId: string;
}) {
  const router = useRouter();
  const [provider, setProvider] = useState(initialProvider);
  const [forcedStep, setForcedStep] = useState<number | null>(null);

  const productsSkipped = localStorageGetSafe(
    `onboarding.productsSkipped.${provider.id}`,
  );
  const testTicketPrintedAt = localStorageGetSafe(
    `onboarding.testTicketPrintedAt.${provider.id}`,
  );

  const currentStep = useMemo(() => {
    if (forcedStep !== null) return forcedStep;
    if (!provider.salonName || !provider.phone) return 0;
    if (provider._count.offers === 0) return 1;
    if (provider._count.products === 0 && !productsSkipped) return 2;
    if (provider._count.employees === 0) return 3;
    if (
      provider._count.cashDrawerSessions === 0 ||
      !testTicketPrintedAt
    )
      return 4;
    return 5;
  }, [provider, productsSkipped, testTicketPrintedAt, forcedStep]);

  async function dismiss() {
    await fetch("/api/provider/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboardingDismissedAt: new Date().toISOString() }),
    });
    router.replace("/pos");
  }

  return (
    <div className="min-h-screen bg-pos-bg p-6" data-pos-theme>
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-pos-ink">
          Bienvenue sur Salonista
        </h1>
        <button
          onClick={() => {
            if (
              confirm(
                "Vous pourrez revenir plus tard, ou rouvrir le wizard depuis /pos/bienvenue.",
              )
            ) {
              dismiss();
            }
          }}
          className="text-sm text-pos-ink-3 hover:text-pos-ink"
        >
          Quitter sans terminer
        </button>
      </header>

      <div className="mb-8 flex gap-1">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`flex-1 h-1 rounded ${
              i < currentStep
                ? "bg-pos-accent"
                : i === currentStep
                  ? "bg-pos-ink"
                  : "bg-pos-border"
            }`}
            title={label}
          />
        ))}
      </div>

      <p className="text-xs uppercase tracking-wider text-pos-ink-3 mb-2">
        Étape {currentStep + 1}/6
      </p>
      <h2 className="text-xl font-semibold mb-6 text-pos-ink">
        {STEPS[currentStep]}
      </h2>

      {currentStep === 0 && (
        <Step1Info
          provider={provider}
          onSaved={setProvider}
          onNext={() => setForcedStep(1)}
        />
      )}
      {currentStep === 1 && (
        <Step2Services
          provider={provider}
          onAdded={setProvider}
          onNext={() => setForcedStep(2)}
          onBack={() => setForcedStep(0)}
        />
      )}
      {currentStep === 2 && (
        <Step3Products
          provider={provider}
          onAdded={setProvider}
          onNext={() => setForcedStep(3)}
          onSkip={() => setForcedStep(3)}
          onBack={() => setForcedStep(1)}
        />
      )}
      {currentStep === 3 && (
        <Step4Team
          provider={provider}
          onAdded={setProvider}
          onNext={() => setForcedStep(4)}
          onBack={() => setForcedStep(2)}
        />
      )}
      {currentStep === 4 && (
        <Step5Drawer
          provider={provider}
          employeeId={employeeId}
          onDone={() => setForcedStep(5)}
          onBack={() => setForcedStep(3)}
        />
      )}
      {currentStep === 5 && (
        <Step6Done
          provider={provider}
          onFinish={dismiss}
          onBack={() => setForcedStep(4)}
        />
      )}
    </div>
  );
}
