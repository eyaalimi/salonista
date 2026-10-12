import { getCurrentEmployee } from "@/lib/employee-session";
import { redirect } from "next/navigation";
import { CommissionsClient } from "@/components/pos/commissions-client";
import { ModuleGate } from "@/components/module-gate";
import { hasFeature } from "@/lib/plan-serveur";
import { PageVerrouilleePremium } from "@/components/pos/premium/page-verrouillee";

export const metadata = { title: "Commissions — Salonista" };

export default async function CommissionsPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");
  // Same gate as the employees page: only managers/owners see commissions.
  if (!employee.permissions["employees.manage"]) redirect("/pos/calendar");
  if (!(await hasFeature(employee.providerId, "COMMISSIONS"))) {
    return (
      <PageVerrouilleePremium
        titre="Commissions"
        explication="La caisse calcule ce que gagne chaque employée sur ses services. Avec le Premium, vous voyez ces montants et vous les réglez en un geste."
        points={[
          "Le montant dû à chaque employée, par période",
          "Les commissions réglées et celles qui restent à payer",
          "Un taux de commission par employée",
        ]}
      />
    );
  }
  return (
    <ModuleGate module="POS" providerId={employee.providerId}>
      <CommissionsClient />
    </ModuleGate>
  );
}
