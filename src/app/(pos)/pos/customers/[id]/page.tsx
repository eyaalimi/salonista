import { getCurrentEmployee } from "@/lib/employee-session";
import { redirect } from "next/navigation";
import { CustomerDetailClient } from "@/components/pos/customer-detail-client";

export const metadata = { title: "Fiche cliente — Salonista" };

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");
  if (!employee.permissions["customers.view"]) redirect("/pos");
  const { id } = await params;
  return (
    <CustomerDetailClient
      id={id}
      canEdit={!!employee.permissions["customers.edit"]}
    />
  );
}
