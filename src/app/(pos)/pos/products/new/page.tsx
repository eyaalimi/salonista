import { ProductForm } from "@/components/pos/product-form";
import { requirePermission, toResponse } from "@/lib/employee-session";
import { redirect } from "next/navigation";
import { ModuleGate } from "@/components/module-gate";

export const metadata = { title: "Nouveau produit — Salonista" };

export default async function NewProductPage() {
  let employee;
  try {
    employee = await requirePermission("products.manage");
  } catch (err) {
    const r = toResponse(err);
    if (r) redirect("/pos/products");
    throw err;
  }
  return (
    <ModuleGate module="POS" providerId={employee.providerId}>
      <ProductForm mode="create" />
    </ModuleGate>
  );
}
