import { AnalyticsClient } from "@/components/pos/analytics-client";
import { getCurrentEmployee } from "@/lib/employee-session";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export const metadata = { title: "Analytique — Salonista" };

export default async function AnalyticsPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");
  if (!employee.permissions["analytics.view"]) redirect("/pos/calendar");
  return (
    <Suspense fallback={null}>
      <AnalyticsClient />
    </Suspense>
  );
}
