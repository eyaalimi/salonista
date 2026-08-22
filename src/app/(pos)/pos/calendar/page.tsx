import { getCurrentEmployee } from "@/lib/employee-session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { etapesDemarrage, demarrageTermine } from "@/lib/onboarding-salon";
import { hasModule } from "@/lib/modules";
import { DemarrageCard } from "@/components/pos/demarrage-card";
import { PosCalendarClient } from "./calendar-client";

export default async function PosCalendarPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");
  if (!employee.permissions["bookings.view"]) {
    return (
      <div className="p-6">
        <p className="text-sm text-pos-ink-3">Permission insuffisante.</p>
      </div>
    );
  }

  const profil = await prisma.providerProfile.findUnique({
    where: { id: employee.providerId },
    select: {
      address: true,
      city: true,
      photos: true,
      openingHours: true,
      onboardingDismissedAt: true,
    },
  });

  // `photos: { isEmpty: false }` n'est pas un detail : TOUTES les surfaces
  // publiques l'exigent (accueil, /offres, fiche salon, sitemap). Une offre
  // sans photo est publiee mais introuvable. Sans ce filtre, l'etape se
  // cochait, la carte disparaissait, et le salon se croyait en ligne alors
  // qu'aucune cliente ne pouvait le trouver — exactement le piege que ce
  // guide existe pour eviter.
  const nombreOffres = await prisma.offer.count({
    where: {
      providerId: employee.providerId,
      publishedToMarketplace: true,
      photos: { isEmpty: false },
    },
  });

  // La carte ne s'affiche ni pour un salon qui l'a masquee, ni pour un salon
  // deja installe : le calcul vient des donnees, donc un salon arrive avant
  // ce guide voit ses etapes deja cochees et la carte disparait d'elle-meme.
  const afficherGuide =
    profil !== null &&
    profil.onboardingDismissedAt === null &&
    !demarrageTermine(profil, nombreOffres);

  return (
    <>
      {afficherGuide && profil && (
        <DemarrageCard etapes={etapesDemarrage(profil, nombreOffres)} />
      )}
      <PosCalendarClient
        defaultEmployeeId={employee.id}
        // Sans le module, `POST /api/pos/sales` repond 403 : le bouton
        // « Encaisser » ouvrait un panier qui ne pouvait pas etre valide.
        // La visite est comptee autrement, en validant le QR de la cliente.
        peutEncaisser={await hasModule(employee.providerId, "POS")}
      />
    </>
  );
}
