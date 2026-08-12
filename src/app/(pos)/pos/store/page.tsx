import { redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/employee-session";
import { LockedFeaturePage } from "@/components/pos/locked-feature-page";

export const metadata = { title: "Boutique — Salonista" };

export default async function StorePage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");

  return (
    <LockedFeaturePage
      feature="STORE"
      title="Boutique professionnelle"
      tagline="Commandez vos produits professionnels directement depuis votre caisse, à tarif négocié."
      bullets={[
        "Tarifs négociés auprès des fournisseurs",
        "Réception en un geste : le stock se met à jour tout seul",
        "Livraison suivie partout en Tunisie",
      ]}
    />
  );
}
