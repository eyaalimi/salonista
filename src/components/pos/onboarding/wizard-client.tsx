"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Step1Info } from "./step1-info";
import { Step2Services } from "./step2-services";
import { Step3Products } from "./step3-products";
import { Step4Loyalty } from "./step4-loyalty";
import { Step5Team } from "./step5-team";

type Provider = {
  id: string;
  salonName: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  category?: string;
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
  "Votre salon",
  "Vos services",
  "Vos produits",
  "Fidélité",
  "Équipe & PIN",
];

export function WizardClient({
  initialProvider,
  employeeId: _employeeId,
}: {
  initialProvider: Provider;
  employeeId: string;
}) {
  const router = useRouter();
  const [provider, setProvider] = useState(initialProvider);
  const [step, setStep] = useState(0);

  function updateProvider(patch: Partial<Provider>) {
    setProvider((prev) => ({ ...prev, ...patch }));
  }

  async function finishWizard() {
    try {
      await fetch("/api/pos/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finish: true }),
      });
    } catch {
      // ignore
    }
    router.replace("/pos");
  }

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-brand-cream" data-pos-theme>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Progress bar + step indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft">
              Étape {step + 1} sur {STEPS.length}
            </p>
            <button
              type="button"
              onClick={() => {
                if (
                  confirm(
                    "Voulez-vous vraiment quitter ? Vous pourrez reprendre plus tard.",
                  )
                ) {
                  router.replace("/pos");
                }
              }}
              className="text-xs text-brand-ink-soft hover:text-brand-ink"
            >
              Quitter
            </button>
          </div>
          <div className="h-1.5 bg-brand-line rounded-full overflow-hidden">
            <div
              className="h-full bg-pos-accent transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <h1 className="luxury-heading text-3xl text-brand-ink mb-1">
          {STEPS[step]}
        </h1>
        <p className="text-sm text-brand-ink-soft mb-6">
          {step === 0 && "Commençons par les informations de votre salon."}
          {step === 1 && "Choisissez les services que vous proposez."}
          {step === 2 && "Ajoutez vos produits à la vente. Étape facultative."}
          {step === 3 && "Récompensez la fidélité de vos clients."}
          {step === 4 && "Créez les comptes de votre équipe avec un code PIN."}
        </p>

        <div className="bg-white rounded-3xl border border-brand-line shadow-sm p-6 sm:p-8">
          {step === 0 && (
            <Step1Info
              provider={provider}
              onSaved={updateProvider}
              onNext={() => setStep(1)}
            />
          )}
          {step === 1 && (
            <Step2Services
              provider={provider}
              onAdded={updateProvider}
              onNext={() => setStep(2)}
              onBack={() => setStep(0)}
            />
          )}
          {step === 2 && (
            <Step3Products
              provider={provider}
              onAdded={updateProvider}
              onNext={() => setStep(3)}
              onSkip={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <Step4Loyalty
              providerId={provider.id}
              onNext={() => setStep(4)}
              onBack={() => setStep(2)}
            />
          )}
          {step === 4 && (
            <Step5Team
              provider={provider}
              onAdded={updateProvider}
              onFinish={finishWizard}
              onBack={() => setStep(3)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
