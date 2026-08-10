import { getCurrentEmployee } from "@/lib/employee-session";
import { redirect } from "next/navigation";
import { CommissionsClient } from "@/components/pos/commissions-client";

export const metadata = { title: "Commissions — Salonista" };

export default async function CommissionsPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");
  // Same gate as the employees page: only managers/owners see commissions.
  if (!employee.permissions["employees.manage"]) redirect("/pos");
  return <CommissionsClient />;
}
