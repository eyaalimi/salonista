import { prisma } from "@/lib/prisma";
import type { SubscriptionModule } from "@/generated/prisma/enums";

const ACTIVE_STATUSES = ["ACTIVE", "TRIAL"] as const;

export async function hasModule(
  providerId: string,
  module: SubscriptionModule,
): Promise<boolean> {
  const sub = await prisma.salonSubscription.findUnique({
    where: { providerId_module: { providerId, module } },
    select: { status: true, expiresAt: true },
  });
  if (!sub) return false;
  if (!ACTIVE_STATUSES.includes(sub.status as (typeof ACTIVE_STATUSES)[number])) {
    return false;
  }
  if (sub.expiresAt && sub.expiresAt.getTime() <= Date.now()) {
    return false;
  }
  return true;
}

export class ModuleNotActiveError extends Error {
  constructor(public module: SubscriptionModule) {
    super("Module non activé");
    this.name = "ModuleNotActiveError";
  }
}

export async function requireModule(
  providerId: string,
  module: SubscriptionModule,
): Promise<void> {
  if (!(await hasModule(providerId, module))) {
    throw new ModuleNotActiveError(module);
  }
}

export async function getActiveModules(
  providerId: string,
): Promise<SubscriptionModule[]> {
  const subs = await prisma.salonSubscription.findMany({
    where: { providerId },
    select: { module: true, status: true, expiresAt: true },
  });
  const now = Date.now();
  return subs
    .filter(
      (s) =>
        ACTIVE_STATUSES.includes(s.status as (typeof ACTIVE_STATUSES)[number]) &&
        (!s.expiresAt || s.expiresAt.getTime() > now),
    )
    .map((s) => s.module);
}
