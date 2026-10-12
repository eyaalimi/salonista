import { redirect } from "next/navigation";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { SwRegister } from "@/components/sw-register";
import { SuiviInstallation } from "@/components/suivi-installation";
import { BandeauConsultation } from "@/components/pos/bandeau-consultation";
import { employeeToujoursActive, getCurrentEmployee } from "@/lib/employee-session";
import { appliquerLimiteEquipe, choixEquipeAConfirmer } from "@/lib/plan-equipe";
import { FenetreChoixEquipe } from "@/components/pos/premium/fenetre-choix-equipe";
import { BandeauPremium, type BandeauPremiumProps } from "@/components/pos/premium/bandeau-premium";
import { chiffresFinEssai, getPlan } from "@/lib/plan-serveur";
import {
  ALERTE_FIN_ESSAI_JOURS,
  dateCourteFr,
  joindreFr,
  lignesPerteFinEssai,
  PRIX_PREMIUM_DT,
} from "@/lib/plan";
import { getActiveModules } from "@/lib/modules";
import { prisma } from "@/lib/prisma";
import { OnlineStatusProvider } from "@/components/pos/online-status";
import { PosTopbar } from "@/components/pos/topbar";
import { Rail } from "@/components/pos/rail";
import { IdleLock } from "@/components/pos/idle-lock";

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

  // Ouverture de la caisse : en version gratuite, l'equipe est ramenee a la
  // gerante + 1 employee (idempotent, sans effet sinon). Une employee mise en
  // pause — maintenant ou plus tot — ne garde pas la main sur la caisse.
  await appliquerLimiteEquipe(employee.providerId);
  if (!(await employeeToujoursActive(employee.id))) redirect("/salon-pin?pause=1");

  // Les modules ne bloquent plus l'acces a la PWA : un salon sans le module
  // caisse garde son espace metier (RDV, clientes, services, profil). Le
  // blocage est porte page par page, par les seules pages de caisse.
  const activeModules = await getActiveModules(employee.providerId);

  // La gerante confirme qui garde son acces apres la fin de l'essai.
  const gerante = !!employee.permissions["employees.manage"];
  const choixEquipe = gerante ? await choixEquipeAConfirmer(employee.providerId) : null;
  const bandeau = gerante ? await bandeauPremium(employee.providerId) : null;

  const provider = await prisma.providerProfile.findUnique({
    where: { id: employee.providerId },
    select: { salonName: true, city: true, matriculeFiscal: true },
  });

  return (
    <div data-pos-theme className={`${plexSans.variable} ${plexMono.variable}`}>
      <OnlineStatusProvider>
        <div className="h-dvh flex flex-col overflow-hidden">
          {/* Rien si personne ne consulte. Informe seulement : la lecture
              seule est garantie dans requirePermission, cote serveur. */}
          <BandeauConsultation />
          {bandeau && <BandeauPremium {...bandeau} />}
          <div className="h-12 shrink-0">
            <PosTopbar
              provider={provider ? { salonName: provider.salonName, city: provider.city } : null}
              employee={{
                id: employee.id,
                displayName: employee.displayName,
                role: employee.role,
                permissions: employee.permissions,
              }}
              hasPos={activeModules.includes("POS")}
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
        {/* Verrouille l'ecran apres 4 minutes sans activite. Ne deconnecte
            pas : le panier en cours est conserve. */}
        <IdleLock displayName={employee.displayName} />
        {choixEquipe && <FenetreChoixEquipe choix={choixEquipe} />}
        {!provider?.matriculeFiscal && (
          <div className="hidden">
            {/* matricule banner moved to settings page in Design 2 */}
          </div>
        )}
        <SwRegister />
        {/* `appinstalled` n'etait ecoute nulle part : sw-register n'ecoute
            que `beforeinstallprompt`, qui dit que l'installation est
            POSSIBLE, pas qu'elle a eu lieu. */}
        <SuiviInstallation />
      </OnlineStatusProvider>
    </div>
  );
}

/**
 * Quel bandeau Premium montrer a la gerante ? Aucun avant la premiere vente
 * (rien ne court encore) ni en Premium.
 */
async function bandeauPremium(providerId: string): Promise<BandeauPremiumProps | null> {
  const plan = await getPlan(providerId);
  if (plan.etat === "GRATUIT") return { variante: "gratuit" };
  if (plan.etat !== "ESSAI") return null;
  if (plan.joursRestants > ALERTE_FIN_ESSAI_JOURS) {
    return { variante: "essai", joursRestants: plan.joursRestants };
  }
  const lignes = lignesPerteFinEssai(await chiffresFinEssai(providerId));
  const debut = `Votre essai Premium se termine le ${dateCourteFr(plan.finEssai)}.`;
  const pertes = lignes.length > 0 ? ` Sans Premium : ${joindreFr(lignes)}.` : "";
  return {
    variante: "fin-essai",
    texte: `${debut}${pertes} Passer au Premium : ${PRIX_PREMIUM_DT} DT/mois.`,
  };
}
