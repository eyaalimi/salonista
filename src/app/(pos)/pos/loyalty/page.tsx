import { getCurrentEmployee } from "@/lib/employee-session";
import { redirect } from "next/navigation";
import { LoyaltyClient } from "@/components/pos/loyalty-client";

export const metadata = { title: "Fidélité — Salonista" };

export default async function LoyaltyPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");
  if (!employee.permissions["rewards.adjust"]) redirect("/pos/calendar");
  return (
    <LoyaltyClient
      canEditSettings={!!employee.permissions["rewards.settings"]}
    />
  );
}
