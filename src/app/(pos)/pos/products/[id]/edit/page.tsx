import { ProductForm } from "@/components/pos/product-form";
import { prisma } from "@/lib/prisma";
import { requirePermission, toResponse } from "@/lib/employee-session";
import { notFound, redirect } from "next/navigation";

export const metadata = { title: "Modifier produit — Salonista" };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  let employee;
  try {
    employee = await requirePermission("products.manage");
  } catch (err) {
    const r = toResponse(err);
    if (r) redirect("/pos/products");
    throw err;
  }

  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product || product.providerId !== employee.providerId) notFound();

  return (
    <ProductForm
      mode="edit"
      initial={{
        id: product.id,
        name: product.name,
        description: product.description,
        category: product.category,
        sku: product.sku,
        barcode: product.barcode,
        purchasePrice: String(product.purchasePrice),
        costPrice: product.costPrice != null ? String(product.costPrice) : "",
        salePrice: String(product.salePrice),
        taxRate: String(product.taxRate),
        stockQuantity: product.stockQuantity,
        lowStockThreshold: product.lowStockThreshold,
        photo: product.photo,
        active: product.active,
      }}
    />
  );
}
