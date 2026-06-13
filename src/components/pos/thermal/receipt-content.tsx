"use client";
import type { ReceiptData } from "@/components/pos/receipt";
import {
  ThermalHeader,
  ThermalSeparator,
  ThermalRow,
  ThermalTotal,
  ThermalFooter,
} from "./thermal-layout";
import { formatDT } from "@/lib/money";

const METHOD_LABELS: Record<string, string> = {
  CASH: "Espèces",
  CARD: "Carte",
  TRANSFER: "Virement",
  OTHER: "Autre",
  LOYALTY_POINTS: "Points fidélité",
};

export function ReceiptContent({ data }: { data: ReceiptData }) {
  const cashPaid = data.payments
    .filter((p) => p.method === "CASH")
    .reduce((s, p) => s + Number(p.amount), 0);
  const change = cashPaid - Number(data.total);

  return (
    <>
      <ThermalHeader provider={data.provider} />
      <ThermalSeparator />
      <div>Reçu N° {data.receiptNumber}</div>
      <div>{new Date(data.date).toLocaleString("fr-FR")}</div>
      <div>Caissier·ère : {data.employee.displayName}</div>
      {data.customerName && <div>Client : {data.customerName}</div>}
      {data.offline && (
        <>
          <div>(Hors ligne — sera synchronisé)</div>
          <div style={{ fontSize: 9 }}>
            N° définitif attribué à la synchronisation
          </div>
        </>
      )}
      <ThermalSeparator />
      {data.items.map((it, i) => (
        <div key={i}>
          <ThermalRow
            label={`${it.quantity}× ${it.name}`}
            value={formatDT(it.lineTotal)}
          />
          {it.assignedEmployee && (
            <div style={{ paddingLeft: "4mm", fontSize: 10 }}>
              par {it.assignedEmployee}
            </div>
          )}
        </div>
      ))}
      <ThermalSeparator />
      <ThermalRow label="Sous-total TTC" value={formatDT(data.subtotal)} />
      {Number(data.discountAmount) > 0 && (
        <ThermalRow label="Remise" value={`-${formatDT(data.discountAmount)}`} />
      )}
      {data.taxBreakdown.map((b, i) => (
        <ThermalRow
          key={i}
          label={`TVA ${b.rate}% sur ${formatDT(b.base)}`}
          value={formatDT(b.tax)}
        />
      ))}
      {Number(data.tipTotal) > 0 && (
        <ThermalRow label="Pourboire" value={formatDT(data.tipTotal)} />
      )}
      <ThermalTotal label="TOTAL" value={formatDT(data.total)} />
      <ThermalSeparator />
      {data.payments.map((p, i) => (
        <ThermalRow
          key={i}
          label={`${METHOD_LABELS[p.method] ?? p.method}${
            p.pointsRedeemed ? ` (${p.pointsRedeemed} pts)` : ""
          }`}
          value={formatDT(p.amount)}
        />
      ))}
      {change > 0 && (
        <ThermalRow label="Rendu" value={formatDT(change.toFixed(3))} />
      )}
      {data.rewards &&
        (data.rewards.earned > 0 ||
          data.rewards.redeemed > 0 ||
          data.rewards.welcomeBonus > 0 ||
          data.rewards.birthdayBonus > 0) && (
          <>
            <ThermalSeparator />
            <div className="thermal-center" style={{ fontWeight: "bold" }}>
              Fidélité
            </div>
            {data.rewards.redeemed > 0 && (
              <ThermalRow
                label="Points utilisés"
                value={`-${data.rewards.redeemed} pts`}
              />
            )}
            {data.rewards.earned > 0 && (
              <ThermalRow
                label="Points gagnés"
                value={`+${data.rewards.earned} pts`}
              />
            )}
            {data.rewards.welcomeBonus > 0 && (
              <ThermalRow
                label="Bonus de bienvenue"
                value={`+${data.rewards.welcomeBonus} pts`}
              />
            )}
            {data.rewards.birthdayBonus > 0 && (
              <ThermalRow
                label="Bonus anniversaire"
                value={`+${data.rewards.birthdayBonus} pts`}
              />
            )}
            {data.rewards.newBalance !== undefined && (
              <div className="thermal-row thermal-total">
                <span>Nouveau solde</span>
                <span>{data.rewards.newBalance} pts</span>
              </div>
            )}
          </>
        )}
      {data.provider?.receiptFooter && (
        <>
          <ThermalSeparator />
          <ThermalFooter text={data.provider.receiptFooter} />
        </>
      )}
      <ThermalFooter text="Merci de votre visite !" />
    </>
  );
}
