import { getCurrentEmployee } from "@/lib/employee-session";
import { redirect } from "next/navigation";
import { FideliteClient } from "@/components/pos/fidelite/fidelite-client";

export const metadata = { title: "Fidélité — Salonista" };

export default async function LoyaltyPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");
  if (!employee.permissions["rewards.adjust"]) redirect("/pos/calendar");
  return (
    <FideliteClient
      canEditSettings={!!employee.permissions["rewards.settings"]}
    />
  );
}
