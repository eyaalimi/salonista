import { SaleDetailClient } from "@/components/pos/sale-detail-client";
import { getCurrentEmployee } from "@/lib/employee-session";
import { redirect } from "next/navigation";
import { ModuleGate } from "@/components/module-gate";

export const metadata = { title: "Détail vente — Salonista" };

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");
  // Voir le commentaire dans `pos/page.tsx` : ce controle venait du layout.
  if (!employee.permissions["pos.sell"]) redirect("/pos/calendar");

  return (
    <ModuleGate module="POS" providerId={employee.providerId}>
      <SaleDetailClient
        saleId={id}
        canRefund={!!employee.permissions["pos.refund"]}
      />
    </ModuleGate>
  );
}
