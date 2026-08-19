import { getCurrentEmployee } from "@/lib/employee-session";
import { redirect } from "next/navigation";
import { PosShellClient } from "@/components/pos/pos-shell-client";
import { getActiveModules } from "@/lib/modules";
import { posLandingPath } from "@/lib/pos-access";

export default async function PosPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");

  // Sans le module caisse, `/pos` (l'ecran d'encaissement) n'a pas de sens :
  // on envoie le salon vers son quotidien, ses rendez-vous du jour.
  const landing = posLandingPath(await getActiveModules(employee.providerId));
  if (landing) redirect(landing);
  return (
    <PosShellClient
      employee={{
        id: employee.id,
        displayName: employee.displayName,
        role: employee.role,
        permissions: employee.permissions,
      }}
    />
  );
}
