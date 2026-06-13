"use client";

type ZReportData = {
  provider: {
    salonName: string | null;
    address: string | null;
    city: string | null;
    phone: string | null;
    matriculeFiscal: string | null;
    receiptFooter: string | null;
  } | null;
  sessionNumber: string;
  openedAt: Date | string;
  closedAt: Date | string | null;
  openedBy: string;
  salesCount: number;
  grossTotal: string;
  discountsTotal: string;
  tipsTotal: string;
  refundsTotal: string;
  refundsCashTotal: string;
  paymentsByMethod: Array<{ method: string; amount: string }>;
  taxBreakdown: Array<{ rate: string; base: string; tax: string }>;
  expenses: Array<{ id: string; amount: string; reason: string; category: string }>;
  expensesTotal: string;
  openingFloat: string;
  expectedCash: string | null;
  closingCount: string | null;
  variance: string | null;
};

/**
 * Temporary plain-HTML Z report frame.
 *
 * T5.4 will replace this with the 80mm thermal layout sharing
 * `<ThermalLayout>` primitives. Until then this renders the same data
 * in a basic HTML table so the page is reviewable end-to-end.
 */
export function ZReportPrintFrame({ data }: { data: ZReportData }) {
  return (
    <div style={{ padding: 24, fontFamily: "monospace", maxWidth: 600 }}>
      <h1 style={{ fontSize: 18, marginBottom: 4 }}>
        {data.provider?.salonName ?? "Salon"} — Rapport Z
      </h1>
      <p style={{ fontSize: 12, color: "#666" }}>
        Session #{data.sessionNumber} · Ouverte par {data.openedBy}
      </p>
      <p style={{ fontSize: 12, color: "#666" }}>
        {new Date(data.openedAt).toLocaleString("fr-FR")}
        {data.closedAt ? ` → ${new Date(data.closedAt).toLocaleString("fr-FR")}` : " (en cours)"}
      </p>

      <h2 style={{ fontSize: 14, marginTop: 16 }}>Ventes</h2>
      <ul style={{ fontSize: 13 }}>
        <li>Nombre : {data.salesCount}</li>
        <li>Brut TTC : {data.grossTotal} DT</li>
        <li>Remises : {data.discountsTotal} DT</li>
        <li>Pourboires : {data.tipsTotal} DT</li>
        <li>Remboursements (tous) : {data.refundsTotal} DT</li>
        <li>Remboursements cash : {data.refundsCashTotal} DT</li>
      </ul>

      <h2 style={{ fontSize: 14, marginTop: 16 }}>Paiements par méthode</h2>
      <ul style={{ fontSize: 13 }}>
        {data.paymentsByMethod.length === 0 && <li>Aucun paiement</li>}
        {data.paymentsByMethod.map((p, i) => (
          <li key={i}>{p.method} : {p.amount} DT</li>
        ))}
      </ul>

      <h2 style={{ fontSize: 14, marginTop: 16 }}>TVA par taux</h2>
      <ul style={{ fontSize: 13 }}>
        {data.taxBreakdown.length === 0 && <li>Aucune ligne</li>}
        {data.taxBreakdown.map((t, i) => (
          <li key={i}>{t.rate}% — base {t.base} DT, TVA {t.tax} DT</li>
        ))}
      </ul>

      <h2 style={{ fontSize: 14, marginTop: 16 }}>Dépenses</h2>
      <p style={{ fontSize: 13 }}>Total : {data.expensesTotal} DT</p>
      <ul style={{ fontSize: 13 }}>
        {data.expenses.length === 0 && <li>Aucune dépense</li>}
        {data.expenses.map((e) => (
          <li key={e.id}>
            {e.category} · {e.amount} DT · {e.reason}
          </li>
        ))}
      </ul>

      <h2 style={{ fontSize: 14, marginTop: 16 }}>Caisse</h2>
      <ul style={{ fontSize: 13 }}>
        <li>Fond initial : {data.openingFloat} DT</li>
        <li>Attendu : {data.expectedCash ?? "—"} DT</li>
        <li>Compté : {data.closingCount ?? "—"} DT</li>
        <li>Variance : {data.variance ?? "—"} DT</li>
      </ul>

      {data.provider?.receiptFooter && (
        <p style={{ marginTop: 16, fontSize: 12, fontStyle: "italic", textAlign: "center" }}>
          {data.provider.receiptFooter}
        </p>
      )}
    </div>
  );
}
