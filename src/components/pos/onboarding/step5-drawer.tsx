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

export function Step5Drawer({
  provider: _provider,
  employeeId: _employeeId,
  onDone,
  onBack,
}: {
  provider: Provider;
  employeeId: string;
  onDone: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-pos-ink-3">Étape 5 — Tiroir &amp; ticket (à implémenter dans T2.7)</p>
      <div className="flex justify-between">
        <button onClick={onBack} className="text-sm text-pos-ink-3">← Précédent</button>
        <button onClick={onDone} className="px-5 py-2 rounded bg-pos-ink text-pos-bg text-sm">Suivant →</button>
      </div>
    </div>
  );
}
