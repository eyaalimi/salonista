import { getCurrentEmployee } from "@/lib/employee-session";
import { redirect } from "next/navigation";
import { PosCalendarClient } from "./calendar-client";

export default async function PosCalendarPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");
  if (!employee.permissions["bookings.view"]) {
    return (
      <div className="p-6">
        <p className="text-sm text-pos-ink-3">Permission insuffisante.</p>
      </div>
    );
  }
  return <PosCalendarClient defaultEmployeeId={employee.id} />;
}
