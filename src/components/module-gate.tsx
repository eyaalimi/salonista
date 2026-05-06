import type { SubscriptionModule } from "@/generated/prisma/enums";
import { hasModule } from "@/lib/modules";

const MODULE_LABELS: Record<SubscriptionModule, string> = {
  POS: "Caisse",
  REWARDS: "Fidélité",
};

type ModuleGateProps = {
  module: SubscriptionModule;
  providerId: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

export async function ModuleGate({
  module,
  providerId,
  children,
  fallback,
}: ModuleGateProps) {
  const active = await hasModule(providerId, module);
  if (active) return <>{children}</>;
  if (fallback) return <>{fallback}</>;
  return (
    <div className="mx-auto max-w-md mt-12 rounded-2xl border border-brand-line bg-brand-sand p-10 text-center">
      <p className="luxury-badge mb-3">{MODULE_LABELS[module]}</p>
      <h2 className="luxury-heading text-2xl text-brand-ink">Module non activé</h2>
      <p className="mt-4 text-sm text-brand-ink-soft">
        Ce module n&apos;est pas activé pour votre salon. Contactez l&apos;administrateur
        pour l&apos;activer.
      </p>
    </div>
  );
}
