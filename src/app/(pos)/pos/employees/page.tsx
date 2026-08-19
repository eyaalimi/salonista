import { getCurrentEmployee } from "@/lib/employee-session";
import { redirect } from "next/navigation";
import { EmployeesListClient } from "@/components/pos/employees-list-client";
import { ModuleGate } from "@/components/module-gate";

export const metadata = { title: "Équipe — Salonista" };

export default async function EmployeesPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");
  if (!employee.permissions["employees.manage"]) redirect("/pos/calendar");
  return (
    <ModuleGate module="POS" providerId={employee.providerId}>
      <EmployeesListClient />
    </ModuleGate>
  );
}
