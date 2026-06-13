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

export function Step4Team({
  provider,
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
    <div className="max-w-2xl space-y-4">
      <div className="p-4 rounded border border-pos-border bg-pos-card">
        <h3 className="text-base font-medium mb-2 text-pos-ink">Votre équipe</h3>
        <p className="text-sm text-pos-ink-2">
          Vous pourrez ajouter vos employés après le wizard depuis le tableau de bord.
          Pour l&apos;instant, vous pouvez utiliser la caisse en tant que propriétaire.
        </p>
        <p className="text-xs text-pos-ink-3 mt-2">
          {provider._count.employees > 0
            ? `Employés actuels : ${provider._count.employees}`
            : "Aucun employé encore — vous pouvez commencer seul·e."}
        </p>
      </div>

      <div className="flex justify-between pt-4">
        <button type="button" onClick={onBack} className="text-sm text-pos-ink-3">← Précédent</button>
        <button
          type="button"
          onClick={onNext}
          className="px-5 py-2 rounded bg-pos-ink text-pos-bg"
        >
          Continuer →
        </button>
      </div>
    </div>
  );
}
