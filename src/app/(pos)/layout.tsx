import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { SwRegister } from "@/components/sw-register";
import { getCurrentEmployee } from "@/lib/employee-session";
import { hasModule } from "@/lib/modules";
import { prisma } from "@/lib/prisma";
import { OnlineStatusBadge } from "@/components/pos/online-status-badge";
import { OnlineStatusProvider } from "@/components/pos/online-status";

export const metadata = {
  title: "Caisse — Salonista",
};

export default async function PosLayout({ children }: { children: React.ReactNode }) {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");

  const moduleActive = await hasModule(employee.providerId, "POS");
  if (!moduleActive) {
    return (
      <div className="min-h-dvh bg-brand-cream flex items-center justify-center p-8">
        <div className="max-w-md rounded-2xl border border-brand-line bg-brand-sand p-10 text-center">
          <p className="luxury-badge mb-3">Caisse</p>
          <h2 className="luxury-heading text-2xl text-brand-ink">Module non activé</h2>
          <p className="mt-4 text-sm text-brand-ink-soft">
            Le module POS n&apos;est pas activé pour ce salon. Contactez l&apos;administrateur.
          </p>
        </div>
      </div>
    );
  }

  if (!employee.permissions["pos.sell"]) {
    return (
      <div className="min-h-dvh bg-brand-cream flex items-center justify-center p-8">
        <div className="max-w-md rounded-2xl border border-brand-line bg-brand-sand p-10 text-center">
          <p className="luxury-badge mb-3">Accès refusé</p>
          <h2 className="luxury-heading text-2xl text-brand-ink">Permission insuffisante</h2>
          <p className="mt-4 text-sm text-brand-ink-soft">
            Vous n&apos;avez pas la permission d&apos;accéder à la caisse.
          </p>
        </div>
      </div>
    );
  }

  const provider = await prisma.providerProfile.findUnique({
    where: { id: employee.providerId },
    select: { salonName: true, matriculeFiscal: true },
  });

  return (
    <OnlineStatusProvider>
      <div className="min-h-dvh bg-brand-cream flex flex-col">
        <header className="h-14 bg-brand-ink text-brand-cream flex items-center px-5 gap-6 shrink-0">
          <div className="flex items-center gap-3">
            <Logo tone="light" href="/pos" />
            <span className="text-[10px] uppercase tracking-[0.18em] text-brand-cream/60 hidden sm:inline">
              {provider?.salonName}
            </span>
          </div>
          <nav className="hidden sm:flex items-center gap-4 text-[10px] uppercase tracking-[0.18em] text-brand-cream/70">
            <Link href="/pos" className="hover:text-brand-cream">Caisse</Link>
            <Link href="/pos/sales" className="hover:text-brand-cream">Ventes</Link>
            <Link href="/pos/products" className="hover:text-brand-cream">Produits</Link>
          </nav>
          <div className="flex-1 text-center text-sm">
            <span className="font-medium">{employee.displayName}</span>
            <span className="ml-2 text-[10px] uppercase tracking-[0.18em] text-brand-cream/60">
              {employee.role}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <OnlineStatusBadge />
          </div>
        </header>

        {!provider?.matriculeFiscal && (
          <div className="bg-amber-50 border-b border-amber-200 px-5 py-2 text-xs text-amber-900">
            Renseignez votre matricule fiscal dans les paramètres pour le faire apparaître
            sur les reçus.
          </div>
        )}

        <main className="flex-1 overflow-hidden">{children}</main>
        <SwRegister />
      </div>
    </OnlineStatusProvider>
  );
}
