import { redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/employee-session";
import { prisma } from "@/lib/prisma";
import { ModuleGate } from "@/components/module-gate";
import { CreditsClient } from "@/components/pos/credits-client";

export const metadata = { title: "Crédits clientes — Salonista" };

export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");
  // Encaisser un credit, c'est encaisser : `pos.sell`. `pos.credit` seul
  // suffit aussi a consulter — c'est la meme regle que GET /api/pos/credits.
  if (!employee.permissions["pos.sell"] && !employee.permissions["pos.credit"]) {
    redirect("/pos/calendar");
  }
  const { client } = await searchParams;

  const provider = await prisma.providerProfile.findUnique({
    where: { id: employee.providerId },
    select: {
      id: true,
      salonName: true,
      address: true,
      city: true,
      phone: true,
      matriculeFiscal: true,
      receiptFooter: true,
    },
  });

  return (
    <ModuleGate module="POS" providerId={employee.providerId}>
      <CreditsClient
        provider={provider}
        employeeName={employee.displayName}
        peutEncaisser={employee.permissions["pos.sell"] === true}
        peutEffacer={employee.permissions["pos.void"] === true}
        clientInitial={client ?? null}
      />
    </ModuleGate>
  );
}
