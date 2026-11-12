import { redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/employee-session";
import { ModuleGate } from "@/components/module-gate";
import { PromosClient } from "@/components/pos/promos-client";

export const metadata = { title: "Promos WhatsApp — Salonista" };

/**
 * Promos par WhatsApp. Hors Premium (decision du 12/11/2026) : la page est
 * ouverte des que les fondateurs ont connecte le salon ; avant, elle
 * s'affiche quand meme avec un encart « pas encore connecte ».
 */
export default async function PromosPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");
  if (!employee.permissions["promos.send"]) redirect("/pos/calendar");
  return (
    <ModuleGate module="POS" providerId={employee.providerId}>
      <PromosClient />
    </ModuleGate>
  );
}
