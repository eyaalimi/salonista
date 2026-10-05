import StartClient from "./start-client";
import { SuiviVisite } from "@/components/suivi-visite";

export const metadata = {
  title: "Démarrer ma caisse — Salonista",
  description:
    "Active ta caisse Salonista gratuitement en 5 minutes. Sans carte bancaire, sans engagement.",
};

export default function PosStartPage() {
  return (
    <>
      {/* Arriver sur cette page, c'est commencer une inscription. */}
      <SuiviVisite type="INSCRIPTION_DEBUT" />
      <StartClient />
    </>
  );
}
