import { SyncIssuesClient } from "@/components/pos/sync-issues-client";
import { getCurrentEmployee } from "@/lib/employee-session";
import { redirect } from "next/navigation";

export const metadata = { title: "Conflits de sync — Salonista" };

export default async function SyncIssuesPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");
  if (!employee.permissions["pos.refund"]) {
    redirect("/pos");
  }
  return <SyncIssuesClient />;
}
