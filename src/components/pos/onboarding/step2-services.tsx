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

export function Step2Services({
  provider: _provider,
  onAdded: _onAdded,
  onNext,
  onBack,
}: {
  provider: Provider;
  onAdded: (p: Provider) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-pos-ink-3">Étape 2 — Services (à implémenter dans T2.6)</p>
      <div className="flex justify-between">
        <button onClick={onBack} className="text-sm text-pos-ink-3">← Précédent</button>
        <button onClick={onNext} className="px-5 py-2 rounded bg-pos-ink text-pos-bg text-sm">Suivant →</button>
      </div>
    </div>
  );
}
