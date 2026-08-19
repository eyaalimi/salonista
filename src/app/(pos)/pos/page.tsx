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

  // Ce controle vivait dans le layout, qui bloquait tout l'espace : un employe
  // sans `pos.sell` y perdait aussi ses pages metier. Il appartient a l'ecran
  // d'encaissement lui-meme. Inerte aujourd'hui (les quatre roles accordent la
  // permission), il redevient utile des que les permissions par employe seront
  // modifiables.
  if (!employee.permissions["pos.sell"]) redirect("/pos/calendar");
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
