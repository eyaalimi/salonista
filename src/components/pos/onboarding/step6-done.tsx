"use client";

type Provider = {
  id: string;
  salonName: string;
};

export function Step6Done({
  provider: _provider,
  onFinish,
  onBack,
}: {
  provider: Provider;
  onFinish: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-pos-ink-3">Étape 6 — Terminé (à implémenter dans T2.7)</p>
      <div className="flex justify-between">
        <button onClick={onBack} className="text-sm text-pos-ink-3">← Précédent</button>
        <button onClick={onFinish} className="px-5 py-2 rounded bg-pos-accent text-white text-sm">Terminer</button>
      </div>
    </div>
  );
}
