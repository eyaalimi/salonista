import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveModules } from "@/lib/modules";
import type { SubscriptionModule } from "@/generated/prisma/enums";
import DashboardLayoutClient from "./dashboard-layout-client";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  let activeModules: SubscriptionModule[] = [];
  if (session?.user?.role === "PROVIDER") {
    const provider = await prisma.providerProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (provider) {
      activeModules = await getActiveModules(provider.id);
    }
  }

  return (
    <DashboardLayoutClient activeModules={activeModules}>{children}</DashboardLayoutClient>
  );
}
