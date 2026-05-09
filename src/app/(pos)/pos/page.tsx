import { getCurrentEmployee } from "@/lib/employee-session";
import { redirect } from "next/navigation";
import { PosShellClient } from "@/components/pos/pos-shell-client";

export default async function PosPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");
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
