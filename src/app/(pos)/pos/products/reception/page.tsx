import { getCurrentEmployee } from "@/lib/employee-session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ReceptionBulkClient } from "@/components/pos/reception-bulk-client";
import { ModuleGate } from "@/components/module-gate";

export const dynamic = "force-dynamic";

export default async function ReceptionBulkPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");
  if (!employee.permissions["products.manage"]) redirect("/pos/calendar");

  const products = await prisma.product.findMany({
    where: { providerId: employee.providerId, active: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      sku: true,
      barcode: true,
      costPrice: true,
    } as never,
  });

  return (
    <ModuleGate module="POS" providerId={employee.providerId}>
      <ReceptionBulkClient products={products as never} />
    </ModuleGate>
  );
}
