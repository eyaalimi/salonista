import { getCurrentEmployee } from "@/lib/employee-session";
import { redirect } from "next/navigation";
import { FideliteClient } from "@/components/pos/fidelite/fidelite-client";
import { hasFeature } from "@/lib/plan-serveur";
import { PageVerrouilleePremium } from "@/components/pos/premium/page-verrouillee";

export const metadata = { title: "Fidélité — Salonista" };

export default async function LoyaltyPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");
  if (!employee.permissions["rewards.adjust"]) redirect("/pos/calendar");

  // Version gratuite : page fermee, comme celle des commissions. Le refus
  // reel est porte par les routes /api/rewards et par la vente (paiement par
  // points refuse, aucun point gagne) ; cette page ne fait que le montrer.
  if (!(await hasFeature(employee.providerId, "FIDELITE"))) {
    return (
      <PageVerrouilleePremium
        titre="Fidélité"
        explication="Le programme fidélité est en pause : vos clientes ne gagnent plus de points et ne peuvent plus les utiliser. Leurs soldes sont conservés et tout reprend dès le passage au Premium."
        points={[
          "Des points gagnés à chaque visite, utilisables pour payer",
          "Bonus de bienvenue et d'anniversaire",
          "Le solde de chaque cliente et ses statistiques",
        ]}
      />
    );
  }

  return (
    <FideliteClient
      canEditSettings={!!employee.permissions["rewards.settings"]}
    />
  );
}
