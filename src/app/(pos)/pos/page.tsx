import { getCurrentEmployee } from "@/lib/employee-session";
import { redirect } from "next/navigation";
import { PosClient } from "@/components/pos/pos-client";

export default async function PosPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");
  return (
    <PosClient
      employee={{
        id: employee.id,
        displayName: employee.displayName,
        role: employee.role,
        permissions: employee.permissions,
      }}
    />
  );
}
