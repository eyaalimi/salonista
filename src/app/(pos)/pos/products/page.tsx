import { ProductsListClient } from "@/components/pos/products-list-client";
import { getCurrentEmployee } from "@/lib/employee-session";
import { redirect } from "next/navigation";

export const metadata = { title: "Produits — Salonista" };

export default async function ProductsPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");
  return (
    <ProductsListClient
      canManage={!!employee.permissions["products.manage"]}
    />
  );
}
