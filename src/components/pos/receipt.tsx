"use client";

import { formatDT } from "@/lib/money";
import type { CachedCatalogProvider } from "@/lib/pos-offline-db";

const METHOD_LABELS: Record<string, string> = {
  CASH: "Espèces",
  CARD: "Carte",
  TRANSFER: "Virement",
  OTHER: "Autre",
};

export type ReceiptData = {
  receiptNumber: string;
  provider: CachedCatalogProvider | null;
  employee: { displayName: string };
  customerName: string | null;
  items: Array<{
    name: string;
    quantity: number;
    assignedEmployee: string | null;
    lineTotal: string;
    taxRate: string;
  }>;
  subtotal: string;
  discountAmount: string;
  taxBreakdown: Array<{ rate: string; base: string; tax: string }>;
  tipTotal: string;
  total: string;
  payments: Array<{ method: string; amount: string }>;
  date: string;
  offline: boolean;
};

/**
 * Hidden, print-only frame for thermal receipts. The page-level CSS hides
 * everything else when window.print() fires.
 */
export function ReceiptPrintFrame({ data }: { data: ReceiptData }) {
  return (
    <>
      <style jsx global>{`
        @page {
          size: 80mm auto;
          margin: 0;
        }
        @media print {
          body > *:not(.receipt-print) {
            display: none !important;
          }
          .receipt-print {
            display: block !important;
          }
        }
        .receipt-print {
          display: none;
          width: 80mm;
          padding: 5mm;
          font-family: ui-monospace, "Courier New", monospace;
          font-size: 11px;
          color: #000;
          background: #fff;
        }
        .receipt-print h1 {
          font-size: 14px;
          margin: 0;
          text-align: center;
        }
        .receipt-print .center {
          text-align: center;
        }
        .receipt-print .row {
          display: flex;
          justify-content: space-between;
        }
        .receipt-print hr {
          border: none;
          border-top: 1px dashed #000;
          margin: 4mm 0;
        }
      `}</style>
      <div className="receipt-print">
        <div className="center">
          <h1>{data.provider?.salonName ?? "Salonista"}</h1>
          {data.provider?.address && <div>{data.provider.address}</div>}
          {data.provider?.city && <div>{data.provider.city}</div>}
          {data.provider?.phone && <div>Tél: {data.provider.phone}</div>}
          {data.provider?.matriculeFiscal && (
            <div>Matricule fiscal: {data.provider.matriculeFiscal}</div>
          )}
        </div>
        <hr />
        <div>Reçu N° {data.receiptNumber}</div>
        <div>{new Date(data.date).toLocaleString("fr-FR")}</div>
        <div>Caissier·ère: {data.employee.displayName}</div>
        {data.customerName && <div>Client: {data.customerName}</div>}
        {data.offline && <div>(Hors ligne — sera synchronisé)</div>}
        <hr />
        {data.items.map((it, i) => (
          <div key={i}>
            <div className="row">
              <span>
                {it.quantity}× {it.name}
              </span>
              <span>{formatDT(it.lineTotal)}</span>
            </div>
            {it.assignedEmployee && (
              <div style={{ paddingLeft: "4mm", fontSize: "10px" }}>
                par {it.assignedEmployee}
              </div>
            )}
          </div>
        ))}
        <hr />
        <div className="row">
          <span>Sous-total TTC</span>
          <span>{formatDT(data.subtotal)}</span>
        </div>
        {Number(data.discountAmount) > 0 && (
          <div className="row">
            <span>Remise</span>
            <span>-{formatDT(data.discountAmount)}</span>
          </div>
        )}
        {data.taxBreakdown.map((b, i) => (
          <div className="row" key={i}>
            <span>
              TVA {b.rate}% sur {formatDT(b.base)}
            </span>
            <span>{formatDT(b.tax)}</span>
          </div>
        ))}
        {Number(data.tipTotal) > 0 && (
          <div className="row">
            <span>Pourboire</span>
            <span>{formatDT(data.tipTotal)}</span>
          </div>
        )}
        <div className="row" style={{ fontWeight: "bold", fontSize: "13px" }}>
          <span>TOTAL</span>
          <span>{formatDT(data.total)}</span>
        </div>
        <hr />
        {data.payments.map((p, i) => (
          <div className="row" key={i}>
            <span>{METHOD_LABELS[p.method] ?? p.method}</span>
            <span>{formatDT(p.amount)}</span>
          </div>
        ))}
        {data.provider?.receiptFooter && (
          <>
            <hr />
            <div className="center">{data.provider.receiptFooter}</div>
          </>
        )}
        <div className="center" style={{ marginTop: "4mm", fontSize: "10px" }}>
          Merci de votre visite !
        </div>
      </div>
    </>
  );
}
