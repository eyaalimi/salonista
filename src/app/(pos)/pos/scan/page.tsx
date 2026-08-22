import { getCurrentEmployee } from "@/lib/employee-session";
import { redirect } from "next/navigation";
import { ScanClient } from "./scan-client";

export default async function PosScanPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");

  // Meme permission que la validation elle-meme : scanner ne sert qu'a
  // ouvrir la page de verification, qui exige `bookings.edit` pour confirmer.
  // Afficher le scanner a qui ne peut pas valider serait une impasse.
  if (!employee.permissions["bookings.edit"]) {
    return (
      <div className="p-6">
        <p className="text-sm text-pos-ink-3">
          Vous n&apos;avez pas la permission de valider les arrivées.
        </p>
      </div>
    );
  }

  return <ScanClient />;
}
