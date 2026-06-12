"use client";

type Provider = {
  id: string;
  _count: {
    offers: number;
    products: number;
    employees: number;
    sales: number;
    cashDrawerSessions: number;
  };
};

export function Step3Products({
  provider: _provider,
  onAdded: _onAdded,
  onNext,
  onSkip,
  onBack,
}: {
  provider: Provider;
  onAdded: (p: Provider) => void;
  onNext: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-pos-ink-3">Étape 3 — Produits (à implémenter dans T2.7)</p>
      <div className="flex justify-between">
        <button onClick={onBack} className="text-sm text-pos-ink-3">← Précédent</button>
        <div className="flex gap-3">
          <button onClick={onSkip} className="text-sm text-pos-ink-3">Passer</button>
          <button onClick={onNext} className="px-5 py-2 rounded bg-pos-ink text-pos-bg text-sm">Suivant →</button>
        </div>
      </div>
    </div>
  );
}
