import { ModuleGate } from "@/components/module-gate";
import { requirePermission, toResponse } from "@/lib/employee-session";

export default async function PosPage() {
  let employee;
  try {
    employee = await requirePermission("pos.sell");
  } catch (err) {
    const r = toResponse(err);
    if (r) {
      return (
        <div className="p-12">
          <p className="luxury-badge mb-3">Caisse</p>
          <h1 className="luxury-heading text-3xl text-brand-ink">Accès refusé</h1>
          <p className="mt-4 text-sm text-brand-ink-soft">
            Vous n&apos;avez pas la permission d&apos;accéder à la caisse.
          </p>
        </div>
      );
    }
    throw err;
  }

  return (
    <ModuleGate module="POS" providerId={employee.providerId}>
      <div className="p-12">
        <p className="luxury-badge mb-3">Caisse</p>
        <h1 className="luxury-heading text-3xl text-brand-ink">
          Bienvenue, {employee.displayName}
        </h1>
        <p className="text-sm text-brand-ink-soft mt-4">
          L&apos;interface de caisse est en cours de développement (Phase 2).
        </p>
      </div>
    </ModuleGate>
  );
}
