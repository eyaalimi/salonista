"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Step1Info } from "./step1-info";
import { Step2Services } from "./step2-services";
import { Step3Products } from "./step3-products";
import { Step4Loyalty } from "./step4-loyalty";
import { Step5Team } from "./step5-team";
import type { Provider } from "./types";
import { signalerEvenement } from "@/lib/signaler-evenement";

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

  /*
   * CHAQUE ETAPE AFFICHEE EST ENREGISTREE.
   *
   * C'est ce qui permet de repondre au telephone a « ou vous etes-vous
   * arretee ? » sans la poser : la fiche du cockpit affiche « arretee a
   * l'etape 2 · Services ». Sans cela, un abandon ne laissait AUCUNE trace —
   * on savait seulement que l'assistant n'etait pas termine.
   *
   * `step + 1` : les etapes sont numerotees a partir de 1 pour l'humain,
   * indexees a partir de 0 dans le code.
   *
   * Le signal n'attend pas et ne peut pas faire echouer l'assistant (voir
   * `signalerEvenement`).
   */
  useEffect(() => {
    signalerEvenement({ type: "onboarding_etape", etape: step + 1 });
  }, [step]);

  function updateProvider(patch: Partial<Provider>) {
    setProvider((prev) => ({ ...prev, ...patch }));
  }

  async function finishWizard() {
    signalerEvenement({ type: "onboarding_termine", etape: STEPS.length });
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
                  // L'etape d'abandon est le renseignement le plus utile de
                  // tout l'assistant : elle dit ce qui a decourage.
                  signalerEvenement({ type: "onboarding_quitte", etape: step + 1 });
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

        <h1 className="luxury-heading text-3xl text-brand-ink mb-6">
          {STEPS[step]}
        </h1>

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
