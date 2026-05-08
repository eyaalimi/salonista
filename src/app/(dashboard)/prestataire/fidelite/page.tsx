import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ModuleGate } from "@/components/module-gate";
import { FideliteClient } from "./fidelite-client";

export default async function PrestataireFidelitePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const provider = await prisma.providerProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!provider) redirect("/");

  return (
    <ModuleGate module="REWARDS" providerId={provider.id}>
      <FideliteClient />
    </ModuleGate>
  );
}
