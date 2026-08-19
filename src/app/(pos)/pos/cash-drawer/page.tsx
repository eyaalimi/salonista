import { CashDrawerListClient } from "@/components/pos/cash-drawer-list-client";
import { getCurrentEmployee } from "@/lib/employee-session";
import { redirect } from "next/navigation";
import { ModuleGate } from "@/components/module-gate";

export const metadata = { title: "Caisse — Salonista" };

export default async function CashDrawerListPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");
  if (!employee.permissions["pos.cash_drawer"]) redirect("/pos/calendar");
  return (
    <ModuleGate module="POS" providerId={employee.providerId}>
      <CashDrawerListClient />
    </ModuleGate>
  );
}
