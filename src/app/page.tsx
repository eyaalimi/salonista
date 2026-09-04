import type { Metadata } from "next";
import LandingClient from "@/components/landing/landing-client";
import "@/components/landing/landing.css";

/**
 * Racine du site.
 *
 * Tant que la place de marche n'est pas ouverte (voir src/lib/flags.ts), "/"
 * sert la landing de la caisse gratuite. L'ancienne accueil est conservee
 * intacte dans src/components/legacy/marketplace-home.tsx : la rallumer
 * consiste a la redeplacer ici.
 */
export const metadata: Metadata = {
  title: "Salonista — la caisse gratuite des salons de beauté",
  description:
    "Encaissement, agenda, clientes, stock et statistiques dans un seul écran. Gratuit, sans engagement, et fonctionne même sans internet. Pour les salons de beauté en Tunisie.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_TN",
    siteName: "Salonista",
    title: "Salonista — la caisse gratuite des salons de beauté",
    description:
      "Encaissement, agenda, clientes, stock et statistiques dans un seul écran. Gratuit, sans engagement.",
  },
};

export default function Home() {
  return <LandingClient />;
}
