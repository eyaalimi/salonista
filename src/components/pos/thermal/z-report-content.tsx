"use client";
import { useEffect } from "react";
import {
  ThermalLayout,
  ThermalHeader,
  ThermalSeparator,
  ThermalRow,
  ThermalTotal,
} from "./thermal-layout";
import { formatDT } from "@/lib/money";

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

const METHOD_LABELS: Record<string, string> = {
  CASH: "Espèces",
  CARD: "Carte",
  TRANSFER: "Virement",
  OTHER: "Autre",
  LOYALTY_POINTS: "Points",
};

const CATEGORY_LABELS: Record<string, string> = {
  FOURNISSEUR: "Fournisseur",
  LIVRAISON: "Livraison",
  AVANCE_SALAIRE: "Avance",
  ENTRETIEN: "Entretien",
  AUTRE: "Autre",
};

export function ZReportPrintFrame({ data }: { data: ZReportData }) {
  useEffect(() => {
    const id = setTimeout(() => {
      window.print();
    }, 200);
    return () => clearTimeout(id);
  }, []);

  const openedAtDate = new Date(data.openedAt);
  const closedAtDate = data.closedAt ? new Date(data.closedAt) : null;

  return (
    <ThermalLayout>
      <ThermalHeader provider={data.provider} title="RAPPORT Z" />
      <ThermalSeparator />
      <div>
        {openedAtDate.toLocaleDateString("fr-FR")} — Session #{data.sessionNumber}
      </div>
      <div>
        Ouverte {openedAtDate.toLocaleTimeString("fr-FR")} par {data.openedBy}
      </div>
      {closedAtDate && (
        <div>
          Fermée {closedAtDate.toLocaleTimeString("fr-FR")} par {data.openedBy}
        </div>
      )}
      <ThermalSeparator />

      <ThermalRow label="Ventes" value={String(data.salesCount)} />
      <ThermalRow label="Brut TTC" value={formatDT(data.grossTotal)} />
      {Number(data.discountsTotal) > 0 && (
        <ThermalRow label="Remises" value={`-${formatDT(data.discountsTotal)}`} />
      )}
      {Number(data.tipsTotal) > 0 && (
        <ThermalRow label="Pourboires" value={`+${formatDT(data.tipsTotal)}`} />
      )}
      {Number(data.refundsTotal) > 0 && (
        <ThermalRow label="Remboursements" value={`-${formatDT(data.refundsTotal)}`} />
      )}
      <ThermalSeparator />

      <div style={{ fontWeight: "bold" }}>Paiements</div>
      {data.paymentsByMethod.length === 0 ? (
        <div>—</div>
      ) : (
        data.paymentsByMethod.map((p, i) => (
          <ThermalRow
            key={i}
            label={METHOD_LABELS[p.method] ?? p.method}
            value={formatDT(p.amount)}
          />
        ))
      )}
      <ThermalSeparator />

      <div style={{ fontWeight: "bold" }}>TVA</div>
      {data.taxBreakdown.length === 0 ? (
        <div>—</div>
      ) : (
        data.taxBreakdown.map((t, i) => (
          <ThermalRow
            key={i}
            label={`${Number(t.rate).toFixed(0)}% sur ${formatDT(t.base)}`}
            value={formatDT(t.tax)}
          />
        ))
      )}
      <ThermalSeparator />

      <div style={{ fontWeight: "bold" }}>Tiroir espèces</div>
      <ThermalRow label="Fond ouverture" value={formatDT(data.openingFloat)} />
      {Number(data.expensesTotal) > 0 && (
        <>
          <ThermalRow label="− Dépenses" value={formatDT(data.expensesTotal)} />
          {data.expenses.map((e) => (
            <div key={e.id} style={{ paddingLeft: "4mm", fontSize: 9 }}>
              {CATEGORY_LABELS[e.category] ?? e.category} {formatDT(e.amount)} — {e.reason}
            </div>
          ))}
        </>
      )}
      {data.expectedCash && (
        <ThermalRow label="Attendu" value={formatDT(data.expectedCash)} />
      )}
      {data.closingCount && (
        <ThermalRow label="Compté" value={formatDT(data.closingCount)} />
      )}
      {data.variance && (
        <ThermalTotal label="ÉCART" value={formatDT(data.variance)} />
      )}
      <ThermalSeparator />

      <div style={{ textAlign: "center", fontSize: 9 }}>
        Rapport Z — Salonista
      </div>
    </ThermalLayout>
  );
}
