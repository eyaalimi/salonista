import { redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/employee-session";
import { LockedFeaturePage } from "@/components/pos/locked-feature-page";

export const metadata = { title: "Collaborations — Salonista" };

export default async function CollabPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");

  return (
    <LockedFeaturePage
      feature="COLLAB"
      title="Collaborations influenceuses"
      tagline="Recevez des propositions de créatrices de contenu locales et ne payez qu'à la réservation effective."
      bullets={[
        "Une seule commission par conversion, jamais d'avance",
        "Suivi des clics et des réservations générées",
        "Aucun engagement mensuel",
      ]}
    />
  );
}
