"use client";
import { ThermalLayout } from "./thermal/thermal-layout";
import { ReceiptContent, ReglementCreditContent } from "./thermal/receipt-content";
import type { CachedCatalogProvider } from "@/lib/pos-offline-db";

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
  payments: Array<{ method: string; amount: string; pointsRedeemed?: number }>;
  date: string;
  offline: boolean;
  /** Vente a credit : ce qui a ete paye le jour meme et ce qui reste du. */
  credit?: { paye: string; reste: string; dueDate: string | null };
  rewards?: {
    earned: number;
    redeemed: number;
    welcomeBonus: number;
    birthdayBonus: number;
    newBalance?: number;
  };
};

/**
 * Recu d'un REGLEMENT de credit — un versement recu apres coup, qui peut
 * solder plusieurs ventes (la plus ancienne d'abord). Ce n'est pas un recu de
 * vente : il ne repete pas les prestations, il dit quelles ventes ont ete
 * reglees, combien, et ce qui reste du.
 */
export type ReglementCreditData = {
  provider: CachedCatalogProvider | null;
  employee: { displayName: string };
  customerName: string | null;
  date: string;
  montant: string;
  methode: string;
  ventes: Array<{ receiptNumber: string; montantImpute: string; resteApres: string }>;
  resteDuApres: string;
  pointsGagnes: number;
};

export function ReglementCreditPrintFrame({ data }: { data: ReglementCreditData }) {
  return (
    <ThermalLayout>
      <ReglementCreditContent data={data} />
    </ThermalLayout>
  );
}

/**
 * Hidden, print-only frame for thermal receipts.
 *
 * Refactored to use the shared <ThermalLayout> + primitives. All call sites
 * mount this component and trigger window.print() — the layout's @media
 * print rules hide everything else.
 */
export function ReceiptPrintFrame({ data }: { data: ReceiptData }) {
  return (
    <ThermalLayout>
      <ReceiptContent data={data} />
    </ThermalLayout>
  );
}
