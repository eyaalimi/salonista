"use client";
import { ThermalLayout } from "./thermal/thermal-layout";
import { ReceiptContent } from "./thermal/receipt-content";
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
  rewards?: {
    earned: number;
    redeemed: number;
    welcomeBonus: number;
    birthdayBonus: number;
    newBalance?: number;
  };
};

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
