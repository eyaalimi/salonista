"use client";

type Provider = {
  salonName: string;
  _count: {
    offers: number;
    products: number;
    employees: number;
    sales: number;
    cashDrawerSessions: number;
  };
};

export function Step6Done({
  provider,
  onFinish,
  onBack,
}: {
  provider: Provider;
  onFinish: () => void;
  onBack: () => void;
}) {
  return (
    <div className="max-w-xl space-y-4">
      <div className="p-5 rounded border border-pos-border bg-pos-card">
        <h3 className="text-lg font-medium mb-3 text-pos-ink">
          Récapitulatif — {provider.salonName}
        </h3>
        <ul className="text-sm space-y-1 text-pos-ink-2">
          <li>{provider._count.offers} services</li>
          <li>{provider._count.products} produits</li>
          <li>{provider._count.employees} employé·e·s</li>
          <li>{provider._count.cashDrawerSessions} session(s) de caisse</li>
        </ul>
      </div>
      <div className="flex justify-between pt-2">
        <button type="button" onClick={onBack} className="text-sm text-pos-ink-3">← Précédent</button>
        <button
          type="button"
          onClick={onFinish}
          className="px-5 py-2 rounded bg-pos-ink text-pos-bg"
        >
          Ouvrir la caisse →
        </button>
      </div>
    </div>
  );
}
