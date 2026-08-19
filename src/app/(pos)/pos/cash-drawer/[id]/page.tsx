import { CashDrawerDetailClient } from "@/components/pos/cash-drawer-detail-client";
import { getCurrentEmployee } from "@/lib/employee-session";
import { redirect } from "next/navigation";
import { ModuleGate } from "@/components/module-gate";

export const metadata = { title: "Détail caisse — Salonista" };

export default async function CashDrawerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");
  if (!employee.permissions["pos.cash_drawer"]) redirect("/pos");
  const { id } = await params;
  return (
    <ModuleGate module="POS" providerId={employee.providerId}>
      <CashDrawerDetailClient
        sessionId={id}
        canReconcile={employee.role === "OWNER" || employee.role === "MANAGER"}
      />
    </ModuleGate>
  );
}
