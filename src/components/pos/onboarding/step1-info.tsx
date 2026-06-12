"use client";

type Provider = {
  id: string;
  salonName: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  matriculeFiscal: string | null;
  receiptFooter: string | null;
};

export function Step1Info({
  provider: _provider,
  onSaved: _onSaved,
  onNext,
}: {
  provider: Provider;
  onSaved: (p: Provider) => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-pos-ink-3">Étape 1 — Infos salon (à implémenter dans T2.5)</p>
      <button
        onClick={onNext}
        className="px-5 py-2 rounded bg-pos-ink text-pos-bg text-sm"
      >
        Suivant →
      </button>
    </div>
  );
}
