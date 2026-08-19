import { redirect } from "next/navigation";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { SwRegister } from "@/components/sw-register";
import { getCurrentEmployee } from "@/lib/employee-session";
import { getActiveModules } from "@/lib/modules";
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

  // Les modules ne bloquent plus l'acces a la PWA : un salon sans le module
  // caisse garde son espace metier (RDV, clientes, services, profil). Le
  // blocage est porte page par page, par les seules pages de caisse.
  const activeModules = await getActiveModules(employee.providerId);

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
            <Rail permissions={employee.permissions} activeModules={activeModules} />
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
