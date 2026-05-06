import { ProductForm } from "@/components/pos/product-form";
import { requirePermission, toResponse } from "@/lib/employee-session";
import { redirect } from "next/navigation";

export const metadata = { title: "Nouveau produit — Salonista" };

export default async function NewProductPage() {
  try {
    await requirePermission("products.manage");
  } catch (err) {
    const r = toResponse(err);
    if (r) redirect("/pos/products");
    throw err;
  }
  return <ProductForm mode="create" />;
}
