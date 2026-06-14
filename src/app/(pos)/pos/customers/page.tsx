import { getCurrentEmployee } from "@/lib/employee-session";
import { redirect } from "next/navigation";
import { CustomersListClient } from "@/components/pos/customers-list-client";

export const metadata = { title: "Clients — Salonista" };

export default async function CustomersPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");
  if (!employee.permissions["customers.view"]) redirect("/pos");
  return (
    <CustomersListClient
      canEdit={!!employee.permissions["customers.edit"]}
    />
  );
}
