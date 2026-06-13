import { getCurrentEmployee } from "@/lib/employee-session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { WizardClient } from "@/components/pos/onboarding/wizard-client";

export const dynamic = "force-dynamic";

export default async function BienvenuePage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");
  if (employee.role !== "OWNER") redirect("/pos");

  const provider = await prisma.providerProfile.findUnique({
    where: { id: employee.providerId },
    select: {
      id: true,
      salonName: true,
      phone: true,
      address: true,
      city: true,
      matriculeFiscal: true,
      receiptFooter: true,
      onboardingDismissedAt: true,
      _count: {
        select: {
          offers: true,
          products: true,
          employees: true,
          sales: true,
          cashDrawerSessions: true,
        },
      },
    } as never,
  });
  if (!provider) redirect("/pos");

  return <WizardClient initialProvider={provider as never} employeeId={employee.id} />;
}
