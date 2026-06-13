import { getCurrentEmployee } from "@/lib/employee-session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ReceptionBulkClient } from "@/components/pos/reception-bulk-client";

export const dynamic = "force-dynamic";

export default async function ReceptionBulkPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");
  if (!employee.permissions["products.manage"]) redirect("/pos");

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

  return <ReceptionBulkClient products={products as never} />;
}
