import { getCurrentEmployee } from "@/lib/employee-session";
import { redirect } from "next/navigation";
import { CommissionsClient } from "@/components/pos/commissions-client";
import { ModuleGate } from "@/components/module-gate";

export const metadata = { title: "Commissions — Salonista" };

export default async function CommissionsPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");
  // Same gate as the employees page: only managers/owners see commissions.
  if (!employee.permissions["employees.manage"]) redirect("/pos/calendar");
  return (
    <ModuleGate module="POS" providerId={employee.providerId}>
      <CommissionsClient />
    </ModuleGate>
  );
}
