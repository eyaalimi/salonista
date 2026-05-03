import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Playfair_Display } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || "https://beaute.tn"),
  title: {
    default: "Beauté.tn — Marketplace Beauté N°1 en Tunisie",
    template: "%s | Beauté.tn",
  },
  description:
    "Découvrez les meilleures offres beauté en Tunisie : coiffure, esthétique, onglerie, massage. Réservez en ligne, payez en toute sécurité et présentez votre QR code au salon.",
  keywords: [
    "beauté tunisie", "salon de beauté", "coiffure tunis", "esthétique tunisie",
    "offres beauté", "réservation salon", "marketplace beauté", "beaute.tn",
    "onglerie", "massage tunisie", "soins beauté", "influenceuse beauté tunisie",
  ],
  authors: [{ name: "Beauté.tn" }],
  openGraph: {
    type: "website",
    locale: "fr_TN",
    siteName: "Beauté.tn",
    title: "Beauté.tn — Marketplace Beauté N°1 en Tunisie",
    description:
      "Les meilleures offres beauté en Tunisie, sélectionnées par vos influenceuses préférées. Réservez en un clic.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Beauté.tn — Marketplace Beauté N°1 en Tunisie",
    description:
      "Les meilleures offres beauté en Tunisie. Coiffure, esthétique, onglerie, massage. Réservez en ligne.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${playfair.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-brand-cream text-brand-bordeaux">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
