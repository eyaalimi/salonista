import { SaleDetailClient } from "@/components/pos/sale-detail-client";
import { getCurrentEmployee } from "@/lib/employee-session";
import { redirect } from "next/navigation";

export const metadata = { title: "Détail vente — Salonista" };

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");

  return (
    <SaleDetailClient
      saleId={id}
      canRefund={!!employee.permissions["pos.refund"]}
    />
  );
}
