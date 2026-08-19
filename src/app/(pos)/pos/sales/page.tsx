import { redirect } from "next/navigation";
import { SalesListClient } from "@/components/pos/sales-list-client";
import { getCurrentEmployee } from "@/lib/employee-session";
import { ModuleGate } from "@/components/module-gate";

export const metadata = { title: "Ventes — Salonista" };

export default async function SalesPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");
  // Voir le commentaire dans `pos/page.tsx` : ce controle venait du layout.
  if (!employee.permissions["pos.sell"]) redirect("/pos/calendar");
  return (
    <ModuleGate module="POS" providerId={employee.providerId}>
      <SalesListClient />
    </ModuleGate>
  );
}
