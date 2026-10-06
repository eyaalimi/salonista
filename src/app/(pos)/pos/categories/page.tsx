import { redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/employee-session";
import { prisma } from "@/lib/prisma";
import { trierCategories } from "@/lib/categorie-service";
import { CategoriesClient } from "@/components/pos/categories-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Catégories — Salonista" };

/**
 * Gestion des categories de services.
 *
 * Page SEPAREE de /pos/services, a dessein : l'ecran des services gere deja
 * le prix, la duree, la TVA, les photos et la publication. Y greffer la
 * creation de categories en ferait un formulaire que plus personne ne lit.
 */
export default async function CategoriesPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");
  if (!employee.permissions["products.manage"]) redirect("/pos/calendar");

  const [categories, services] = await Promise.all([
    prisma.serviceCategory.findMany({
      where: { providerId: employee.providerId },
      select: {
        id: true,
        nom: true,
        position: true,
        _count: { select: { offers: true } },
      },
    }),
    prisma.offer.findMany({
      where: { providerId: employee.providerId, active: true },
      orderBy: { title: "asc" },
      select: { id: true, title: true, categoryId: true },
    }),
  ]);

  return (
    <CategoriesClient
      categoriesInitiales={trierCategories(categories).map((c) => ({
        id: c.id,
        nom: c.nom,
        position: c.position,
        nbServices: c._count.offers,
      }))}
      servicesInitiaux={services}
    />
  );
}
