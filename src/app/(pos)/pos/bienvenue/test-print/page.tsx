import { getCurrentEmployee } from "@/lib/employee-session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { TestTicketPrintFrame } from "@/components/pos/thermal/test-ticket-frame";

export const dynamic = "force-dynamic";

export default async function TestPrintPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");

  const provider = await prisma.providerProfile.findUnique({
    where: { id: employee.providerId },
    select: {
      salonName: true,
      address: true,
      city: true,
      phone: true,
      matriculeFiscal: true,
    },
  });

  return (
    <TestTicketPrintFrame
      provider={provider}
      employeeName={employee.displayName}
    />
  );
}
