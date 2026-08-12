import { redirect } from "next/navigation";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { SwRegister } from "@/components/sw-register";
import { getCurrentEmployee } from "@/lib/employee-session";
import { hasModule } from "@/lib/modules";
import { prisma } from "@/lib/prisma";
import { OnlineStatusProvider } from "@/components/pos/online-status";
import { PosTopbar } from "@/components/pos/topbar";
import { Rail } from "@/components/pos/rail";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-pos-sans",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-pos-mono",
});

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
            Le module POS n&apos;est pas activé pour ce salon.
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
        </div>
      </div>
    );
  }

  const provider = await prisma.providerProfile.findUnique({
    where: { id: employee.providerId },
    select: { salonName: true, city: true, matriculeFiscal: true },
  });

  return (
    <div data-pos-theme className={`${plexSans.variable} ${plexMono.variable}`}>
      <OnlineStatusProvider>
        <div className="h-dvh flex flex-col overflow-hidden">
          <div className="h-12 shrink-0">
            <PosTopbar
              provider={provider ? { salonName: provider.salonName, city: provider.city } : null}
              employee={{
                id: employee.id,
                displayName: employee.displayName,
                role: employee.role,
                permissions: employee.permissions,
              }}
            />
          </div>
          {/* Rail lateral a toutes les tailles : 56px sur mobile, 80px sur
              desktop. La bottom-bar mobile a ete abandonnee apres test sur
              iPhone — elle n'etait pas confortable a l'usage. */}
          <div className="flex-1 min-h-0 flex flex-row overflow-hidden">
            <Rail permissions={employee.permissions} />
            <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
              {children}
            </main>
          </div>
        </div>
        {!provider?.matriculeFiscal && (
          <div className="hidden">
            {/* matricule banner moved to settings page in Design 2 */}
          </div>
        )}
        <SwRegister />
      </OnlineStatusProvider>
    </div>
  );
}
